import asyncio
import base64
import hashlib
import hmac
import json as _json
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
from sqlalchemy import select
from sqlalchemy import update as sa_update
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
from travel_planner.models.trip import TripMember
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
    # Known travel sender domains
    "(from:(airbnb.com OR booking.com OR vrbo.com OR homeaway.com"
    " OR expedia.com OR hotels.com OR tripadvisor.com"
    " OR united.com OR delta.com OR aa.com OR southwest.com"
    " OR jetblue.com OR alaskaair.com OR ryanair.com OR easyjet.com"
    " OR lufthansa.com OR britishairways.com OR qantas.com"
    " OR marriott.com OR hilton.com OR hyatt.com OR ihg.com"
    " OR hertz.com OR enterprise.com OR avis.com OR budget.com"
    " OR airportshuttles.com OR viator.com OR getyourguide.com)"
    # OR subject keywords for senders not listed above
    ' OR subject:("booking confirmation" OR "reservation confirmation"'
    ' OR "itinerary" OR "e-ticket" OR "eticket"'
    ' OR "check-in" OR "check in" OR "hotel confirmation"'
    ' OR "flight confirmation" OR "your trip" OR "trip confirmation"'
    ' OR "order confirmation" OR "booking reference"))'
)

# Sender domains to skip — not travel bookings, just noise from broad search
_SKIP_SENDER_DOMAINS = {
    "doordash.com",  # food delivery
    "opentable.com",  # restaurant reservations
    "rocketmoney.com",  # finance app
    "email.rocketmoney.com",
    "garmin.com",  # electronics orders
    "orders.garmin.com",
    "rapha.cc",  # cycling clothing
    "mail.rapha.cc",
    "roka.com",  # eyewear
}


def _sender_is_blocked(sender: str) -> bool:
    """Check if the sender's domain is in the blocklist."""
    # Extract email from "Name <email@domain>" format
    import re

    match = re.search(r"<([^>]+)>", sender)
    email = match.group(1) if match else sender
    domain = email.split("@")[-1].lower().strip()
    return domain in _SKIP_SENDER_DOMAINS


PARSE_PROMPT = """Extract travel booking details from this email.

TRAVEL emails include:
- Flight bookings (PNR/booking codes, flight numbers, airports)
- Hotel/Airbnb/VRBO reservations (check-in, property, booking ref)
- Car rental confirmations (pick-up date, location, conf number)
- Train/bus/ferry tickets
- Tour/activity bookings with a specific date and location

NOT TRAVEL: schedule changes, flight credits, status updates,
security alerts, TOS emails, loyalty programs,
recurring gym/fitness class reservations
(e.g. yoga, spin, pilates at a local gym),
food delivery orders, restaurant reservations,
or anything without a specific booking date.
Exception: special one-off events at venues like Life Time
(concerts, competitions, races) ARE travel/activity.

For travel emails, return ONLY valid JSON with these fields:
- title: string (e.g. "Flight UA1234 DEN→AUS" or "Airbnb Boulder 3-night stay")
- category: "transport", "lodging", or "activity"
- date: "YYYY-MM-DD" for the travel/check-in/departure date
- start_time: "HH:MM" or null
- end_time: "HH:MM" or null
- location: destination city, hotel name, or airport code
- confirmation_number: PNR, booking reference, or confirmation number (or null)
- notes: any extra relevant details or null

If this is NOT a travel booking confirmation, return exactly: {{"not_travel": true}}

Subject: {subject}
From: {sender}

Email body:
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
    """Extract text body from a Gmail message.

    Prefers plain text, falls back to stripped HTML.
    """
    import base64
    import re

    def _decode_data(data: str) -> str:
        if not data:
            return ""
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    def _walk(part: dict, mime_type: str) -> str:
        if part.get("mimeType") == mime_type:
            return _decode_data(part.get("body", {}).get("data", ""))
        for sub in part.get("parts", []):
            result = _walk(sub, mime_type)
            if result:
                return result
        return ""

    def _strip_html(html: str) -> str:
        """Rough HTML-to-text: remove tags, decode common entities."""
        text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.S)
        text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.S)
        text = re.sub(r"<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", text, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        text = text.replace("&nbsp;", " ").replace("&#39;", "'").replace("&quot;", '"')
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    payload = msg.get("payload", {})

    # 1. Try text/plain first
    text = _walk(payload, "text/plain")
    if not text:
        text = _decode_data(payload.get("body", {}).get("data", ""))

    # 2. Fall back to text/html (strip tags)
    if not text:
        html = _walk(payload, "text/html")
        if html:
            text = _strip_html(html)

    return text


async def _parse_with_claude(
    content: str,
    subject: str | None = None,
    sender: str = "",
) -> dict | None:
    """Use Claude Haiku to extract structured booking data from email text."""
    client = _anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": PARSE_PROMPT.format(
                    subject=subject or "(no subject)",
                    sender=sender or "(unknown)",
                    content=content[:6000],
                ),
            }
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
            from travel_planner.models.gmail import ImportRecord

            imp_result = await db.execute(
                select(ImportRecord.email_id).where(ImportRecord.user_id == user_id)
            )
            already_imported: set[str] = set(imp_result.scalars().all())

            if rescan_rejected:
                already_imported = set()

            # Build date-bounded search query — start 90 days before earliest trip
            from datetime import timedelta

            if trips:
                earliest = min(t.start_date for t in trips)
                cutoff = earliest - timedelta(days=90)
            else:
                from datetime import date as _today_date

                cutoff = _today_date.today() - timedelta(days=365)
            search_query = f"{TRAVEL_SEARCH} after:{cutoff.strftime('%Y/%m/%d')}"

            # Fetch all emails from Gmail (paginated, up to 500 per page)
            service = await _build_service(conn)
            messages: list[dict] = []
            page_token: str | None = None
            while True:
                kwargs: dict = {"userId": "me", "q": search_query, "maxResults": 500}
                if page_token:
                    kwargs["pageToken"] = page_token
                msgs_result = await asyncio.to_thread(
                    lambda kw=kwargs: service.users().messages().list(**kw).execute()
                )
                messages.extend(msgs_result.get("messages", []))
                page_token = msgs_result.get("nextPageToken")
                if not page_token:
                    break
            scan_run.emails_found = len(messages)
            await db.commit()
            logger.info(
                "Scan %s: search=%r found %d emails",
                scan_run_id,
                search_query,
                len(messages),
            )

            imported = skipped = unmatched = 0

            for meta in messages:
                # Check cancellation
                await db.refresh(scan_run)
                if scan_run.status == ScanRunStatus.cancelled:
                    break

                email_id = meta["id"]

                if email_id in already_imported:
                    skipped += 1
                    db.add(
                        ScanEvent(
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            status=ScanEventStatus.skipped,
                            skip_reason=ScanEventSkipReason.already_imported,
                        )
                    )
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

                # Extract subject, sender, and date for display/logging
                headers = {
                    h["name"].lower(): h["value"]
                    for h in msg.get("payload", {}).get("headers", [])
                }
                subject = headers.get("subject")
                sender = headers.get("from", "")
                email_date_str: str | None = None
                if raw_date := headers.get("date"):
                    import contextlib
                    from email.utils import parsedate_to_datetime

                    with contextlib.suppress(ValueError, TypeError):
                        email_date_str = parsedate_to_datetime(raw_date).strftime(
                            "%Y-%m-%d"
                        )

                # Skip known non-travel senders (gym, food delivery, etc.)
                if _sender_is_blocked(sender):
                    skipped += 1
                    logger.info(
                        "  [blocked_sender] %s from=%s",
                        subject,
                        sender,
                    )
                    db.add(
                        ScanEvent(
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            gmail_subject=subject,
                            status=ScanEventStatus.skipped,
                            skip_reason=ScanEventSkipReason.not_travel,
                        )
                    )
                    await db.commit()
                    continue

                content = _extract_text(msg)
                if not content:
                    skipped += 1
                    logger.info(
                        "  [no_text] %s from=%s",
                        subject,
                        sender,
                    )
                    db.add(
                        ScanEvent(
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            gmail_subject=subject,
                            status=ScanEventStatus.skipped,
                            skip_reason=ScanEventSkipReason.no_text,
                        )
                    )
                    await db.commit()
                    continue

                try:
                    parsed = await _parse_with_claude(content, subject, sender)
                except Exception:
                    skipped += 1
                    logger.exception(
                        "  [claude_error] %s from=%s",
                        subject,
                        sender,
                    )
                    db.add(
                        ScanEvent(
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            gmail_subject=subject,
                            status=ScanEventStatus.skipped,
                            skip_reason=ScanEventSkipReason.claude_error,
                        )
                    )
                    await db.commit()
                    continue

                if parsed is None:
                    skipped += 1
                    logger.info(
                        "  [not_travel] %s from=%s",
                        subject,
                        sender,
                    )
                    db.add(
                        ScanEvent(
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            gmail_subject=subject,
                            status=ScanEventStatus.skipped,
                            skip_reason=ScanEventSkipReason.not_travel,
                        )
                    )
                    await db.commit()
                    continue

                try:
                    activity_date = _date.fromisoformat(parsed.get("date", ""))
                except (ValueError, TypeError):
                    activity_date = None

                if activity_date is None:
                    # No date — save as unmatched with email date fallback
                    if email_date_str:
                        parsed["email_date"] = email_date_str
                    logger.info(
                        "  [no_date→unmatched] %s from=%s parsed=%s",
                        subject,
                        sender,
                        parsed,
                    )
                    unmatched += 1
                    db.add(
                        UnmatchedImport(
                            user_id=user_id,
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            parsed_data=parsed,
                        )
                    )
                    await db.commit()
                    continue

                matched_trip_id = match_to_trip(
                    parsed_date=activity_date,
                    parsed_location=parsed.get("location") or "",
                    trips=trips,
                )

                if matched_trip_id is None:
                    logger.info(
                        "  [unmatched] %s from=%s date=%s loc=%s",
                        subject,
                        sender,
                        activity_date,
                        parsed.get("location"),
                    )
                    unmatched += 1
                    db.add(
                        UnmatchedImport(
                            user_id=user_id,
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            parsed_data=parsed,
                        )
                    )
                    db.add(
                        ScanEvent(
                            scan_run_id=scan_run_id,
                            email_id=email_id,
                            gmail_subject=subject,
                            status=ScanEventStatus.unmatched,
                            raw_claude_json=parsed,
                        )
                    )
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

                db.add(
                    ImportRecord(
                        user_id=user_id,
                        email_id=email_id,
                        parsed_data=parsed,
                    )
                )
                db.add(
                    Activity(
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
                    )
                )
                db.add(
                    ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.imported,
                        trip_id=_uuid.UUID(matched_trip_id),
                        raw_claude_json=parsed,
                    )
                )
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
                scan_run_id,
                imported,
                skipped,
                unmatched,
            )

        except Exception:
            logger.exception("Scan %s failed", scan_run_id)
            try:
                await db.execute(
                    sa_update(ScanRun)
                    .where(ScanRun.id == scan_run_id)
                    .values(
                        status=ScanRunStatus.failed,
                        finished_at=datetime.now(tz=UTC),
                    )
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
                query = select(ScanEvent).where(ScanEvent.scan_run_id == scan_id)
                if sent_ids:
                    query = query.where(ScanEvent.id.not_in(sent_ids))
                query = query.order_by(ScanEvent.created_at)
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
                    yield {"event": "progress", "data": _json.dumps(payload)}

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
                    yield {"event": "done", "data": _json.dumps(summary)}
                    break

                await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@router.get("/scan/latest", response_model=ScanRunResponse | None)
async def get_latest_scan(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> ScanRun | None:
    result = await db.execute(
        select(ScanRun)
        .where(ScanRun.user_id == user_id)
        .order_by(ScanRun.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/inbox")
async def get_inbox(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from collections import defaultdict

    from travel_planner.models.itinerary import Activity, ImportStatus, ItineraryDay
    from travel_planner.models.trip import Trip
    from travel_planner.schemas.itinerary import ActivityResponse

    # Pending activities with trip info
    result = await db.execute(
        select(Activity, ItineraryDay.trip_id, Trip.destination)
        .join(ItineraryDay, Activity.itinerary_day_id == ItineraryDay.id)
        .join(Trip, ItineraryDay.trip_id == Trip.id)
        .join(TripMember, TripMember.trip_id == Trip.id)
        .where(
            TripMember.user_id == user_id,
            Activity.import_status == ImportStatus.pending_review,
        )
        .order_by(Trip.id, Activity.sort_order)
    )
    rows = result.all()

    # Group by trip
    def _empty_group() -> dict:
        return {"trip_destination": "", "activities": []}

    grouped: dict[str, dict] = defaultdict(_empty_group)
    for activity, trip_id, destination in rows:
        key = str(trip_id)
        grouped[key]["trip_id"] = key
        grouped[key]["trip_destination"] = destination
        grouped[key]["activities"].append(
            ActivityResponse.model_validate(activity).model_dump(mode="json")
        )

    # Unmatched — deduplicate by (date, location), keeping the latest
    unmatched_result = await db.execute(
        select(UnmatchedImport)
        .where(
            UnmatchedImport.user_id == user_id,
            UnmatchedImport.assigned_trip_id.is_(None),
            UnmatchedImport.dismissed_at.is_(None),
        )
        .order_by(UnmatchedImport.created_at.desc())
    )
    seen_keys: set[str] = set()
    unmatched: list[dict] = []
    for u in unmatched_result.scalars().all():
        pd = u.parsed_data or {}
        loc = (pd.get("location") or "").lower().strip()
        dedup_key = f"{pd.get('date') or ''}|{loc}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        unmatched.append(
            UnmatchedImportResponse.model_validate(u).model_dump(mode="json")
        )

    return {"pending": list(grouped.values()), "unmatched": unmatched}


@router.post("/inbox/unmatched/{unmatched_id}/assign", status_code=201)
async def assign_unmatched(
    unmatched_id: _uuid.UUID,
    body: AssignUnmatchedBody,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from datetime import date as _date

    from travel_planner.deps import verify_trip_member
    from travel_planner.models.itinerary import (
        Activity,
        ActivityCategory,
        ActivitySource,
        ImportStatus,
        ItineraryDay,
    )

    result = await db.execute(
        select(UnmatchedImport).where(
            UnmatchedImport.id == unmatched_id,
            UnmatchedImport.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")

    await verify_trip_member(body.trip_id, db, user_id)

    parsed = item.parsed_data
    try:
        activity_date = _date.fromisoformat(parsed.get("date", ""))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=400, detail="Cannot determine activity date"
        ) from exc

    day_result = await db.execute(
        select(ItineraryDay).where(
            ItineraryDay.trip_id == body.trip_id,
            ItineraryDay.date == activity_date,
        )
    )
    day = day_result.scalar_one_or_none()
    if day is None:
        day = ItineraryDay(trip_id=body.trip_id, date=activity_date)
        db.add(day)
        await db.flush()

    try:
        category = ActivityCategory(parsed.get("category", "activity"))
    except ValueError:
        category = ActivityCategory.activity

    from travel_planner.models.gmail import ImportRecord

    db.add(ImportRecord(user_id=user_id, email_id=item.email_id, parsed_data=parsed))
    db.add(
        Activity(
            itinerary_day_id=day.id,
            title=parsed.get("title", "Imported booking"),
            category=category,
            location=parsed.get("location"),
            confirmation_number=parsed.get("confirmation_number"),
            notes=parsed.get("notes"),
            source=ActivitySource.gmail_import,
            source_ref=item.email_id,
            import_status=ImportStatus.pending_review,
            sort_order=999,
        )
    )

    item.assigned_trip_id = body.trip_id
    await db.commit()
    return {"status": "assigned"}


@router.delete("/inbox/unmatched/{unmatched_id}", status_code=204)
async def dismiss_unmatched(
    unmatched_id: _uuid.UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(UnmatchedImport).where(
            UnmatchedImport.id == unmatched_id,
            UnmatchedImport.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")

    from travel_planner.models.gmail import ImportRecord

    # Check if already imported (e.g. from a previous scan)
    existing = await db.execute(
        select(ImportRecord).where(ImportRecord.email_id == item.email_id)
    )
    if existing.scalar_one_or_none() is None:
        db.add(
            ImportRecord(
                user_id=user_id, email_id=item.email_id, parsed_data=item.parsed_data
            )
        )
    item.dismissed_at = datetime.now(tz=UTC)

    # Also dismiss duplicates sharing the same dedup key (date+location)
    # so they don't surface after this item is removed from the dedup set
    pd = item.parsed_data or {}
    dedup_date = pd.get("date") or pd.get("email_date") or ""
    dedup_loc = (pd.get("location") or "").lower().strip()
    if dedup_date or dedup_loc:
        dupes_result = await db.execute(
            select(UnmatchedImport).where(
                UnmatchedImport.user_id == user_id,
                UnmatchedImport.id != item.id,
                UnmatchedImport.assigned_trip_id.is_(None),
                UnmatchedImport.dismissed_at.is_(None),
            )
        )
        now = datetime.now(tz=UTC)
        for dupe in dupes_result.scalars().all():
            dpd = dupe.parsed_data or {}
            d_date = dpd.get("date") or dpd.get("email_date") or ""
            d_loc = (dpd.get("location") or "").lower().strip()
            if d_date == dedup_date and d_loc == dedup_loc:
                dupe.dismissed_at = now

    await db.commit()


@router.delete("/inbox/unmatched", status_code=204)
async def dismiss_all_unmatched(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        sa_update(UnmatchedImport)
        .where(
            UnmatchedImport.user_id == user_id,
            UnmatchedImport.assigned_trip_id.is_(None),
            UnmatchedImport.dismissed_at.is_(None),
        )
        .values(dismissed_at=datetime.now(tz=UTC))
    )
    await db.commit()
