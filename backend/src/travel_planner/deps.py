from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import AuthUser
from travel_planner.models.trip import Trip, TripMember


async def verify_trip_member(
    trip_id: UUID,
    db: AsyncSession,
    current_user: AuthUser,
) -> Trip:
    """Verify the current user is a member of the trip and return the trip.

    Raises 403 if the trip does not exist or the user is not a member.
    """
    result = await db.execute(
        select(Trip)
        .join(TripMember)
        .where(Trip.id == trip_id)
        .where(TripMember.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=403, detail="Not a member of this trip")
    return trip
