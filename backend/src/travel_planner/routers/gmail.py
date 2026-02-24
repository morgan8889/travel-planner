import asyncio
import base64
import hashlib
import hmac
import json as _json
import logging
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
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.config import settings
from travel_planner.db import get_db
from travel_planner.models.gmail import GmailConnection

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


