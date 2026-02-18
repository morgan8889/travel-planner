from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.db import get_db
from travel_planner.deps import verify_trip_member
from travel_planner.models.itinerary import Activity, ItineraryDay
from travel_planner.schemas.itinerary import (
    ActivityCreate,
    ActivityResponse,
    ActivityUpdate,
    ItineraryDayCreate,
    ItineraryDayResponse,
    ReorderActivities,
)

router = APIRouter(prefix="/itinerary", tags=["itinerary"])


async def verify_day_access(
    day_id: UUID,
    db: AsyncSession,
    user_id: UUID,
) -> ItineraryDay:
    """Verify user has access to itinerary day via trip membership"""
    # Get the day
    result = await db.execute(select(ItineraryDay).where(ItineraryDay.id == day_id))
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Itinerary day not found")

    # Verify user is a member of the trip
    await verify_trip_member(day.trip_id, db, user_id)
    return day


@router.get("/trips/{trip_id}/days", response_model=list[ItineraryDayResponse])
async def list_itinerary_days(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """List all itinerary days for a trip"""
    await verify_trip_member(trip_id, db, user_id)

    result = await db.execute(
        select(ItineraryDay, func.count(Activity.id).label("activity_count"))
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
                activity_count=activity_count or 0,
            )
        )
    return days


@router.post(
    "/trips/{trip_id}/days", response_model=ItineraryDayResponse, status_code=201
)
async def create_itinerary_day(
    trip_id: UUID,
    day_data: ItineraryDayCreate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Create a new itinerary day"""
    await verify_trip_member(trip_id, db, user_id)

    day = ItineraryDay(trip_id=trip_id, date=day_data.date, notes=day_data.notes)
    db.add(day)
    await db.commit()
    await db.refresh(day)

    return ItineraryDayResponse(
        id=day.id, trip_id=day.trip_id, date=day.date, notes=day.notes, activity_count=0
    )


@router.post(
    "/trips/{trip_id}/days/generate",
    response_model=list[ItineraryDayResponse],
    status_code=201,
)
async def generate_itinerary_days(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Generate itinerary days for all dates in the trip range.

    Skips dates that already have an itinerary day.
    """
    trip = await verify_trip_member(trip_id, db, user_id)

    if not trip.start_date or not trip.end_date:
        raise HTTPException(
            status_code=400,
            detail="Trip must have start and end dates",
        )

    # Get existing days for this trip
    result = await db.execute(
        select(ItineraryDay.date).where(ItineraryDay.trip_id == trip_id)
    )
    existing_dates = {row for row in result.scalars().all()}

    # Create days for each date in range that doesn't exist
    current = trip.start_date
    new_days = []
    while current <= trip.end_date:
        if current not in existing_dates:
            day = ItineraryDay(trip_id=trip_id, date=current)
            db.add(day)
            new_days.append(day)
        current += timedelta(days=1)

    if new_days:
        await db.commit()
        for day in new_days:
            await db.refresh(day)

    # Return all days (new + existing) ordered by date
    result = await db.execute(
        select(ItineraryDay, func.count(Activity.id).label("activity_count"))
        .outerjoin(Activity)
        .where(ItineraryDay.trip_id == trip_id)
        .group_by(ItineraryDay.id)
        .order_by(ItineraryDay.date)
    )
    return [
        ItineraryDayResponse(
            id=day.id,
            trip_id=day.trip_id,
            date=day.date,
            notes=day.notes,
            activity_count=count or 0,
        )
        for day, count in result
    ]


@router.post(
    "/days/{day_id}/activities", response_model=ActivityResponse, status_code=201
)
async def create_activity(
    day_id: UUID,
    activity_data: ActivityCreate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Create a new activity for an itinerary day"""
    await verify_day_access(day_id, db, user_id)

    # Get max sort_order for this day
    result = await db.execute(
        select(func.max(Activity.sort_order)).where(Activity.itinerary_day_id == day_id)
    )
    max_sort_order = result.scalar()
    next_sort_order = (max_sort_order + 1) if max_sort_order is not None else 0

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
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """List all activities for an itinerary day"""
    await verify_day_access(day_id, db, user_id)

    result = await db.execute(
        select(Activity)
        .where(Activity.itinerary_day_id == day_id)
        .order_by(Activity.sort_order)
    )
    activities = result.scalars().all()

    return [ActivityResponse.model_validate(activity) for activity in activities]


@router.patch("/days/{day_id}/reorder", response_model=list[ActivityResponse])
async def reorder_activities(
    day_id: UUID,
    reorder_data: ReorderActivities,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Reorder activities within an itinerary day."""
    await verify_day_access(day_id, db, user_id)

    result = await db.execute(
        select(Activity).where(Activity.itinerary_day_id == day_id)
    )
    activities = {a.id: a for a in result.scalars().all()}

    for activity_id in reorder_data.activity_ids:
        if activity_id not in activities:
            raise HTTPException(
                status_code=400,
                detail=f"Activity {activity_id} not found in this day",
            )

    for new_order, activity_id in enumerate(reorder_data.activity_ids):
        activities[activity_id].sort_order = new_order

    await db.commit()

    ordered = sorted(activities.values(), key=lambda a: a.sort_order)
    return [ActivityResponse.model_validate(a) for a in ordered]


@router.delete("/days/{day_id}", status_code=204)
async def delete_itinerary_day(
    day_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete an itinerary day and all its activities."""
    day = await verify_day_access(day_id, db, user_id)
    await db.delete(day)
    await db.commit()
    return Response(status_code=204)


@router.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    activity_data: ActivityUpdate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Update an activity"""
    # Get the activity
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Verify user has access to the day
    await verify_day_access(activity.itinerary_day_id, db, user_id)

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
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete an activity"""
    # Get the activity
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Verify user has access to the day
    await verify_day_access(activity.itinerary_day_id, db, user_id)

    await db.delete(activity)
    await db.commit()

    return Response(status_code=204)
