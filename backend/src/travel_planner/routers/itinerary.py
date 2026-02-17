from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import AuthUser, get_current_user
from travel_planner.db import get_db
from travel_planner.models.itinerary import Activity, ItineraryDay
from travel_planner.models.trip import Trip, TripMember
from travel_planner.schemas.itinerary import (
    ActivityCreate,
    ActivityResponse,
    ActivityUpdate,
    ItineraryDayCreate,
    ItineraryDayResponse,
)

router = APIRouter(prefix="/itinerary", tags=["itinerary"])


async def verify_trip_member(
    trip_id: UUID,
    db: AsyncSession,
    current_user: AuthUser
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


async def verify_day_access(
    day_id: UUID,
    db: AsyncSession,
    current_user: AuthUser
) -> ItineraryDay:
    """Verify user has access to itinerary day via trip membership"""
    # Get the day
    result = await db.execute(
        select(ItineraryDay).where(ItineraryDay.id == day_id)
    )
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Itinerary day not found")

    # Verify user is a member of the trip
    await verify_trip_member(day.trip_id, db, current_user)
    return day


@router.get("/trips/{trip_id}/days", response_model=list[ItineraryDayResponse])
async def list_itinerary_days(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
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
    current_user: AuthUser = Depends(get_current_user),
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


@router.post("/days/{day_id}/activities", response_model=ActivityResponse, status_code=201)
async def create_activity(
    day_id: UUID,
    activity_data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Create a new activity for an itinerary day"""
    await verify_day_access(day_id, db, current_user)

    # Get max sort_order for this day
    result = await db.execute(
        select(func.max(Activity.sort_order))
        .where(Activity.itinerary_day_id == day_id)
    )
    max_sort_order = result.scalar()
    next_sort_order = (max_sort_order or -1) + 1

    activity = Activity(
        itinerary_day_id=day_id,
        title=activity_data.title,
        category=activity_data.category,
        start_time=activity_data.start_time,
        end_time=activity_data.end_time,
        location=activity_data.location,
        notes=activity_data.notes,
        confirmation_number=activity_data.confirmation_number,
        sort_order=next_sort_order,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)

    return ActivityResponse.model_validate(activity)


@router.get("/days/{day_id}/activities", response_model=list[ActivityResponse])
async def list_activities(
    day_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """List all activities for an itinerary day"""
    await verify_day_access(day_id, db, current_user)

    result = await db.execute(
        select(Activity)
        .where(Activity.itinerary_day_id == day_id)
        .order_by(Activity.sort_order)
    )
    activities = result.scalars().all()

    return [ActivityResponse.model_validate(activity) for activity in activities]


@router.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    activity_data: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Update an activity"""
    # Get the activity
    result = await db.execute(
        select(Activity).where(Activity.id == activity_id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Verify user has access to the day
    await verify_day_access(activity.itinerary_day_id, db, current_user)

    # Update only provided fields
    update_data = activity_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(activity, field, value)

    await db.commit()
    await db.refresh(activity)

    return ActivityResponse.model_validate(activity)


@router.delete("/activities/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Delete an activity"""
    # Get the activity
    result = await db.execute(
        select(Activity).where(Activity.id == activity_id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Verify user has access to the day
    await verify_day_access(activity.itinerary_day_id, db, current_user)

    await db.delete(activity)
    await db.commit()

    return Response(status_code=204)
