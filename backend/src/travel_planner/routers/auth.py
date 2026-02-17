from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUser, CurrentUserId
from travel_planner.db import get_db
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
