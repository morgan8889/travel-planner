import asyncio
import base64
import hashlib
import hmac
import json as _json
import json as _json_mod
import logging
import uuid as _uuid
from datetime import UTC, datetime
from uuid import UUID

import anthropic as _anthropic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from travel_planner.auth import CurrentUserId
from travel_planner.config import settings
from travel_planner.db import get_db
from travel_planner.models.gmail import (
    GmailConnection,
    ScanEvent,
    ScanEventSkipReason,
    ScanEventStatus,
    ScanRun,
    ScanRunStatus,
    UnmatchedImport,
)
from travel_planner.schemas.gmail import (
    AssignUnmatchedBody,
    GmailScanStart,
    ScanRunResponse,
    ScanStartResponse,
    UnmatchedImportResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gmail", tags=["gmail"])
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _make_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uris": [settings.google_oauth_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_oauth_redirect_uri,
    )


@router.get("/status")
async def gmail_status(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        return {"connected": False, "last_sync_at": None}
    return {
        "connected": True,
        "last_sync_at": conn.last_sync_at.isoformat() if conn.last_sync_at else None,
    }


def _sign_state(payload: str) -> str:
    """Return base64url(payload) + '.' + HMAC-SHA256(payload) as hex digest."""
    key = settings.google_client_secret.encode()
    sig = hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"{encoded}.{sig}"


def _verify_and_decode_state(state: str) -> dict:
    """Verify HMAC signature and return the decoded state dict, or raise 400."""
    try:
        encoded, sig = state.rsplit(".", 1)
        payload = base64.urlsafe_b64decode(encoded + "==").decode()
        key = settings.google_client_secret.encode()
        expected = hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        return _json.loads(payload)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc


@router.get("/auth-url")
async def gmail_auth_url(
    user_id: CurrentUserId,
    trip_id: UUID | None = None,
) -> dict:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    flow = _make_flow()
    payload = _json.dumps(
        {"user_id": str(user_id), "trip_id": str(trip_id) if trip_id else None}
    )
    state = _sign_state(payload)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
    )
    return {"url": auth_url}


@router.get("/callback")
async def gmail_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    state_data = _verify_and_decode_state(state)
    user_id = UUID(state_data["user_id"])
    trip_id = state_data.get("trip_id")

    flow = _make_flow()
    await asyncio.to_thread(lambda: flow.fetch_token(code=code))
    creds = flow.credentials

    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        conn = GmailConnection(user_id=user_id)
        db.add(conn)

    if creds.token:
        conn.access_token = creds.token
    if creds.refresh_token:
        conn.refresh_token = creds.refresh_token
    conn.token_expiry = (
        datetime.fromtimestamp(creds.expiry.timestamp(), tz=UTC)
        if creds.expiry is not None
        else datetime.now(tz=UTC)
    )
    await db.commit()

    redirect = (
        f"{settings.app_frontend_url}/trips/{trip_id}"
        if trip_id
        else f"{settings.app_frontend_url}/settings"
    )
    return RedirectResponse(url=redirect)


@router.delete("/disconnect", status_code=204)
async def gmail_disconnect(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Gmail not connected")
    await db.delete(conn)
    await db.commit()


# ---------------------------------------------------------------------------
# Scan helpers
# ---------------------------------------------------------------------------

TRAVEL_SEARCH = (
    "subject:(booking confirmation OR reservation OR itinerary "
    "OR e-ticket OR hotel confirmation OR flight confirmation)"
)

PARSE_PROMPT = """Extract travel booking details from this email.
Return ONLY valid JSON with these fields:
- title: string (e.g. "Flight AA123 JFK→LAX" or "Marriott hotel check-in")
- category: "transport", "lodging", or "activity"
- date: "YYYY-MM-DD" for the travel/check-in date
- start_time: "HH:MM" or null
- end_time: "HH:MM" or null
- location: city, hotel name, or airport code
- confirmation_number: booking reference or null
- notes: any extra relevant details or null

If this is NOT a travel confirmation email, return exactly: {{"not_travel": true}}

Email:
{content}"""


async def _build_service(conn: GmailConnection):
    """Build authenticated Gmail service, auto-refreshing token if expired."""
    # google.auth uses naive UTC datetimes for expiry comparison; strip tzinfo
    expiry = conn.token_expiry
    if expiry is not None and expiry.tzinfo is not None:
        expiry = expiry.astimezone(UTC).replace(tzinfo=None)
    creds = Credentials(
        token=conn.access_token,
        refresh_token=conn.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        expiry=expiry,
    )
    if creds.expired and creds.refresh_token:
        await asyncio.to_thread(creds.refresh, Request())
        conn.access_token = creds.token
        if creds.expiry is not None:
            # Store as naive UTC (google.auth expiry is naive UTC by convention)
            raw = creds.expiry
            conn.token_expiry = (
                raw.replace(tzinfo=None)
                if raw.tzinfo is None
                else raw.astimezone(UTC).replace(tzinfo=None)
            )
    return build("gmail", "v1", credentials=creds)


def _extract_text(msg: dict) -> str:
    """Extract plain text body from a Gmail message."""
    import base64

    def _walk(part: dict) -> str:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                decoded = base64.urlsafe_b64decode(data + "==")
                return decoded.decode("utf-8", errors="replace")
        for sub in part.get("parts", []):
            result = _walk(sub)
            if result:
                return result
        return ""

    payload = msg.get("payload", {})
    text = _walk(payload)
    if not text:
        import base64

        data = payload.get("body", {}).get("data", "")
        if data:
            decoded = base64.urlsafe_b64decode(data + "==")
            text = decoded.decode("utf-8", errors="replace")
    return text


async def _parse_with_claude(content: str) -> dict | None:
    """Use Claude Haiku to extract structured booking data from email text."""
    client = _anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[
            {"role": "user", "content": PARSE_PROMPT.format(content=content[:3000])}
        ],
    )
    block = msg.content[0]
    if not isinstance(block, _anthropic.types.TextBlock):
        return None
    text = block.text.strip()
    start, end = text.find("{"), text.rfind("}") + 1
    if start == -1 or end == 0:
        return None
    try:
        data = _json.loads(text[start:end])
        return None if data.get("not_travel") else data
    except _json.JSONDecodeError:
        return None


@router.post("/scan", response_model=ScanStartResponse)
async def start_scan(
    body: GmailScanStart,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> ScanStartResponse:
    """Start a background Gmail scan for all trips. Returns scan_id immediately."""
    # Verify Gmail connected
    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=400, detail="Gmail not connected")

    # 409 if already running
    result = await db.execute(
        select(ScanRun).where(
            ScanRun.user_id == user_id,
            ScanRun.status == ScanRunStatus.running,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"scan_id": str(existing.id)},
        )

    scan_run = ScanRun(
        user_id=user_id,
        rescan_rejected=body.rescan_rejected,
    )
    db.add(scan_run)
    await db.commit()
    await db.refresh(scan_run)

    # Spawn background task (runs in the same event loop)
    asyncio.create_task(
        _run_scan_background(scan_run.id, user_id, body.rescan_rejected)
    )

    return ScanStartResponse(scan_id=scan_run.id)


async def _run_scan_background(
    scan_run_id: _uuid.UUID,
    user_id: _uuid.UUID,
    rescan_rejected: bool,
) -> None:
    """Background task: scan Gmail and write scan_events to DB."""
    from datetime import date as _date

    from travel_planner.db import async_session
    from travel_planner.models.itinerary import (
        Activity,
        ActivityCategory,
        ActivitySource,
        ImportStatus,
        ItineraryDay,
    )
    from travel_planner.models.trip import Trip, TripMember
    from travel_planner.routers._gmail_matching import match_to_trip

    async with async_session() as db:
        try:
            # Load scan_run
            result = await db.execute(select(ScanRun).where(ScanRun.id == scan_run_id))
            scan_run = result.scalar_one()

            # Load Gmail connection
            result = await db.execute(
                select(GmailConnection).where(GmailConnection.user_id == user_id)
            )
            conn = result.scalar_one_or_none()
            if conn is None:
                scan_run.status = ScanRunStatus.failed
                await db.commit()
                return

            # Load all user trips with date ranges
            result = await db.execute(
                select(Trip)
                .join(TripMember, TripMember.trip_id == Trip.id)
                .where(
                    TripMember.user_id == user_id,
                    Trip.start_date.isnot(None),
                    Trip.end_date.isnot(None),
                )
            )
            trips = result.scalars().all()

            # Load all itinerary days for those trips
            trip_ids = [t.id for t in trips]
            days_result = await db.execute(
                select(ItineraryDay).where(ItineraryDay.trip_id.in_(trip_ids))
            )
            all_days = days_result.scalars().all()
            days_by_trip_date: dict[tuple, ItineraryDay] = {
                (str(d.trip_id), d.date): d for d in all_days
            }

            # Load already-imported email IDs
            imp_result = await db.execute(
                select(GmailConnection.__class__).where(False)  # placeholder
            )
            from travel_planner.models.gmail import ImportRecord
            imp_result = await db.execute(
                select(ImportRecord.email_id).where(ImportRecord.user_id == user_id)
            )
            already_imported: set[str] = set(imp_result.scalars().all())

            if rescan_rejected:
                already_imported = set()

            # Fetch emails from Gmail
            service = await _build_service(conn)
            msgs_result = await asyncio.to_thread(
                lambda: (
                    service.users()
                    .messages()
                    .list(userId="me", q=TRAVEL_SEARCH, maxResults=50)
                    .execute()
                )
            )
            messages = msgs_result.get("messages", [])
            scan_run.emails_found = len(messages)
            await db.commit()

            imported = skipped = unmatched = 0

            for meta in messages:
                # Check cancellation
                await db.refresh(scan_run)
                if scan_run.status == ScanRunStatus.cancelled:
                    break

                email_id = meta["id"]

                if email_id in already_imported:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.not_travel,
                    ))
                    await db.commit()
                    continue

                # Fetch full message
                try:
                    msg = await asyncio.to_thread(
                        lambda eid=email_id: (
                            service.users()
                            .messages()
                            .get(userId="me", id=eid, format="full")
                            .execute()
                        )
                    )
                except Exception:
                    skipped += 1
                    continue

                # Extract subject for display
                headers = {
                    h["name"].lower(): h["value"]
                    for h in msg.get("payload", {}).get("headers", [])
                }
                subject = headers.get("subject")

                content = _extract_text(msg)
                if not content:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.no_text,
                    ))
                    await db.commit()
                    continue

                try:
                    parsed = await _parse_with_claude(content)
                except Exception:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.claude_error,
                    ))
                    await db.commit()
                    continue

                if parsed is None:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.not_travel,
                    ))
                    await db.commit()
                    continue

                try:
                    activity_date = _date.fromisoformat(parsed.get("date", ""))
                except (ValueError, TypeError):
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.no_date,
                        raw_claude_json=parsed,
                    ))
                    await db.commit()
                    continue

                matched_trip_id = match_to_trip(
                    parsed_date=activity_date,
                    parsed_location=parsed.get("location") or "",
                    trips=trips,
                )

                if matched_trip_id is None:
                    unmatched += 1
                    db.add(UnmatchedImport(
                        user_id=user_id,
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        parsed_data=parsed,
                    ))
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.unmatched,
                        raw_claude_json=parsed,
                    ))
                    await db.commit()
                    continue

                # Find the itinerary day for this trip + date
                day = days_by_trip_date.get((matched_trip_id, activity_date))
                if day is None:
                    day = ItineraryDay(
                        trip_id=_uuid.UUID(matched_trip_id),
                        date=activity_date,
                    )
                    db.add(day)
                    await db.flush()

                try:
                    category = ActivityCategory(parsed.get("category", "activity"))
                except ValueError:
                    category = ActivityCategory.activity

                db.add(ImportRecord(
                    user_id=user_id,
                    email_id=email_id,
                    parsed_data=parsed,
                ))
                db.add(Activity(
                    itinerary_day_id=day.id,
                    title=parsed.get("title", "Imported booking"),
                    category=category,
                    location=parsed.get("location"),
                    confirmation_number=parsed.get("confirmation_number"),
                    notes=parsed.get("notes"),
                    source=ActivitySource.gmail_import,
                    source_ref=email_id,
                    import_status=ImportStatus.pending_review,
                    sort_order=999,
                ))
                db.add(ScanEvent(
                    scan_run_id=scan_run_id,
                    email_id=email_id,
                    gmail_subject=subject,
                    status=ScanEventStatus.imported,
                    trip_id=_uuid.UUID(matched_trip_id),
                    raw_claude_json=parsed,
                ))
                imported += 1
                await db.commit()

            # Finalize scan_run
            scan_run.imported_count = imported
            scan_run.skipped_count = skipped
            scan_run.unmatched_count = unmatched
            if scan_run.status != ScanRunStatus.cancelled:
                scan_run.status = ScanRunStatus.completed
            scan_run.finished_at = datetime.now(tz=UTC)
            await db.commit()
            logger.info(
                "Scan %s complete: imported=%d skipped=%d unmatched=%d",
                scan_run_id, imported, skipped, unmatched,
            )

        except Exception:
            logger.exception("Scan %s failed", scan_run_id)
            try:
                await db.execute(
                    sa_update(ScanRun)
                    .where(ScanRun.id == scan_run_id)
                    .values(status=ScanRunStatus.failed, finished_at=datetime.now(tz=UTC))
                )
                await db.commit()
            except Exception:
                pass


@router.get("/scan/{scan_id}/stream")
async def stream_scan(
    scan_id: _uuid.UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """SSE stream of scan_events for a running or completed scan."""
    from travel_planner.db import async_session

    # Verify scan belongs to user before starting the SSE stream so that
    # a missing/unauthorised scan_id returns a proper 404 HTTP status.
    result = await db.execute(
        select(ScanRun).where(
            ScanRun.id == scan_id,
            ScanRun.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    async def event_generator():
        sent_ids: set[str] = set()

        async with async_session() as stream_db:
            result = await stream_db.execute(
                select(ScanRun).where(ScanRun.id == scan_id)
            )
            scan_run = result.scalar_one_or_none()
            if scan_run is None:
                return

            while True:
                await stream_db.refresh(scan_run)

                # Fetch new events
                query = select(ScanEvent).where(
                    ScanEvent.scan_run_id == scan_id,
                    ScanEvent.id.not_in(sent_ids) if sent_ids else True,
                ).order_by(ScanEvent.created_at)
                result = await stream_db.execute(query)
                new_events = result.scalars().all()

                for ev in new_events:
                    sent_ids.add(str(ev.id))
                    payload = {
                        "email_id": ev.email_id,
                        "subject": ev.gmail_subject,
                        "status": ev.status,
                        "skip_reason": ev.skip_reason,
                        "trip_id": str(ev.trip_id) if ev.trip_id else None,
                        "raw_claude_json": ev.raw_claude_json,
                    }
                    yield {"event": "progress", "data": _json_mod.dumps(payload)}

                if scan_run.status in (
                    ScanRunStatus.completed,
                    ScanRunStatus.failed,
                    ScanRunStatus.cancelled,
                ):
                    summary = {
                        "imported": scan_run.imported_count,
                        "skipped": scan_run.skipped_count,
                        "unmatched": scan_run.unmatched_count,
                        "status": scan_run.status,
                    }
                    yield {"event": "done", "data": _json_mod.dumps(summary)}
                    break

                await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
