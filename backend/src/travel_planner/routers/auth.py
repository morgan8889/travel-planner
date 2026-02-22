import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUser, CurrentUserId
from travel_planner.config import settings
from travel_planner.db import get_db
from travel_planner.models.calendar import CustomDay, HolidayCalendar
from travel_planner.models.gmail import GmailConnection, ImportRecord
from travel_planner.models.trip import MemberRole, Trip, TripMember
from travel_planner.models.user import UserProfile
from travel_planner.schemas.auth import ProfileCreate, ProfileResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/profile", response_model=ProfileResponse)
async def create_or_update_profile(
    profile_data: ProfileCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    stmt = insert(UserProfile).values(
        id=user.id,
        email=user.email or None,
        display_name=profile_data.display_name,
        preferences=profile_data.preferences,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={
            "display_name": stmt.excluded.display_name,
            "preferences": stmt.excluded.preferences,
        },
    )
    stmt = stmt.returning(UserProfile)
    result = await db.execute(stmt)
    await db.commit()
    profile = result.scalar_one()
    return ProfileResponse.model_validate(profile)


@router.get("/me", response_model=ProfileResponse)
async def get_current_profile(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    stmt = select(UserProfile).where(UserProfile.id == user_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileResponse.model_validate(profile)


@router.delete("/me", status_code=204)
async def delete_account(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Permanently delete the current user's account and all their data."""
    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Account deletion not configured: SUPABASE_SERVICE_ROLE_KEY missing",
        )

    # 1. Find trips this user owns
    result = await db.execute(
        select(Trip.id)
        .join(TripMember, TripMember.trip_id == Trip.id)
        .where(
            TripMember.user_id == user_id,
            TripMember.role == MemberRole.owner,
        )
    )
    owned_trip_ids = [row[0] for row in result.all()]

    # 2. Delete owned trips (cascades to TripMember, ItineraryDay, Activity, Checklist)
    if owned_trip_ids:
        await db.execute(sa_delete(Trip).where(Trip.id.in_(owned_trip_ids)))

    # 3. Remove membership in trips the user doesn't own
    await db.execute(sa_delete(TripMember).where(TripMember.user_id == user_id))

    # 4. Delete gmail data
    await db.execute(
        sa_delete(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    await db.execute(sa_delete(ImportRecord).where(ImportRecord.user_id == user_id))

    # 5. Delete calendar records
    await db.execute(
        sa_delete(HolidayCalendar).where(HolidayCalendar.user_id == user_id)
    )
    await db.execute(sa_delete(CustomDay).where(CustomDay.user_id == user_id))

    # 6. Delete user profile
    await db.execute(sa_delete(UserProfile).where(UserProfile.id == user_id))

    # 7. Delete Supabase auth user first — if this fails, we abort before committing DB
    #    changes, so data is preserved and the user can retry.
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
        )
        if resp.status_code not in (200, 204):
            raise HTTPException(
                status_code=500,
                detail="Failed to delete auth user from Supabase",
            )

    # Commit only after Supabase deletion succeeded (or was skipped)
    await db.commit()

    return Response(status_code=204)
