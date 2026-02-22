import base64
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.config import settings
from travel_planner.db import get_db
from travel_planner.models.gmail import GmailConnection

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


@router.get("/auth-url")
async def gmail_auth_url(
    user_id: CurrentUserId,
    trip_id: str | None = None,
) -> dict:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    flow = _make_flow()
    state = base64.urlsafe_b64encode(
        json.dumps({"user_id": str(user_id), "trip_id": trip_id}).encode()
    ).decode()
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
    state_data = json.loads(base64.urlsafe_b64decode(state + "==").decode())
    user_id = UUID(state_data["user_id"])
    trip_id = state_data.get("trip_id")

    flow = _make_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        conn = GmailConnection(user_id=user_id)
        db.add(conn)

    conn.access_token = creds.token
    if creds.refresh_token:
        conn.refresh_token = creds.refresh_token
    conn.token_expiry = datetime.fromtimestamp(creds.expiry.timestamp(), tz=timezone.utc)
    await db.commit()

    redirect = (
        f"http://localhost:5173/trips/{trip_id}" if trip_id else "http://localhost:5173/trips"
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
