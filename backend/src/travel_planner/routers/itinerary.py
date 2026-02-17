from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import get_current_user
from travel_planner.db import get_db
from travel_planner.models.itinerary import Activity, ItineraryDay
from travel_planner.models.trip import Trip, TripMember
from travel_planner.models.user import UserProfile
from travel_planner.schemas.itinerary import ItineraryDayCreate, ItineraryDayResponse

router = APIRouter(prefix="/itinerary", tags=["itinerary"])


async def verify_trip_member(
    trip_id: UUID,
    db: AsyncSession,
    current_user: UserProfile
) -> Trip:
    """Verify user is member of trip, return trip"""
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


@router.get("/trips/{trip_id}/days", response_model=list[ItineraryDayResponse])
async def list_itinerary_days(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """List all itinerary days for a trip"""
    await verify_trip_member(trip_id, db, current_user)

    result = await db.execute(
        select(
            ItineraryDay,
            func.count(Activity.id).label("activity_count")
        )
        .outerjoin(Activity)
        .where(ItineraryDay.trip_id == trip_id)
        .group_by(ItineraryDay.id)
        .order_by(ItineraryDay.date)
    )

    days = []
    for day, activity_count in result:
        days.append(
            ItineraryDayResponse(
                id=day.id,
                trip_id=day.trip_id,
                date=day.date,
                notes=day.notes,
                activity_count=activity_count or 0
            )
        )
    return days


@router.post("/trips/{trip_id}/days", response_model=ItineraryDayResponse, status_code=201)
async def create_itinerary_day(
    trip_id: UUID,
    day_data: ItineraryDayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Create a new itinerary day"""
    await verify_trip_member(trip_id, db, current_user)

    day = ItineraryDay(
        trip_id=trip_id,
        date=day_data.date,
        notes=day_data.notes
    )
    db.add(day)
    await db.commit()
    await db.refresh(day)

    return ItineraryDayResponse(
        id=day.id,
        trip_id=day.trip_id,
        date=day.date,
        notes=day.notes,
        activity_count=0
    )
