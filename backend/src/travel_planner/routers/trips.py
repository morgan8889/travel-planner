from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from travel_planner.auth import CurrentUser, CurrentUserId
from travel_planner.db import get_db
from travel_planner.models.itinerary import Activity, ItineraryDay
from travel_planner.models.trip import MemberRole, Trip, TripMember, TripStatus
from travel_planner.models.user import UserProfile
from travel_planner.schemas.trip import (
    AddMemberRequest,
    MemberPreview,
    TripCreate,
    TripMemberResponse,
    TripResponse,
    TripSummary,
    TripUpdate,
    UpdateMemberRole,
    _member_color,
    _member_initials,
)

router = APIRouter(prefix="/trips", tags=["trips"])


async def get_trip_with_membership(
    trip_id: UUID, user_id: UUID, db: AsyncSession, require_owner: bool = False
) -> tuple[Trip, TripMember]:
    """Fetch trip and verify user membership. Raise 404/403."""
    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.members).joinedload(TripMember.user),
            selectinload(Trip.children),
        )
        .where(Trip.id == trip_id)
    )
    result = await db.execute(stmt)
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    membership = next((m for m in trip.members if m.user_id == user_id), None)
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    if require_owner and membership.role != MemberRole.owner:
        raise HTTPException(
            status_code=403,
            detail="Only the trip owner can perform this action",
        )

    return trip, membership


def _build_trip_response(trip: Trip) -> TripResponse:
    """Build a TripResponse from a Trip ORM instance with loaded relationships."""
    members = [
        TripMemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            display_name=m.user.display_name,
            email=m.user.email,
        )
        for m in trip.members
    ]
    children = [
        TripSummary(
            id=c.id,
            type=c.type,
            destination=c.destination,
            start_date=c.start_date,
            end_date=c.end_date,
            status=c.status,
            notes=c.notes,
            destination_latitude=c.destination_latitude,
            destination_longitude=c.destination_longitude,
            parent_trip_id=c.parent_trip_id,
            created_at=c.created_at,
            member_count=len(c.members) if c.members else 0,
        )
        for c in trip.children
    ]
    return TripResponse(
        id=trip.id,
        type=trip.type,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        status=trip.status,
        notes=trip.notes,
        destination_latitude=trip.destination_latitude,
        destination_longitude=trip.destination_longitude,
        parent_trip_id=trip.parent_trip_id,
        created_at=trip.created_at,
        members=members,
        children=children,
    )


@router.post("", status_code=201, response_model=TripResponse)
async def create_trip(
    trip_data: TripCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> TripResponse:
    """Create a new trip. The caller becomes the owner."""
    # Ensure user profile exists (FK target for trip_members)
    upsert_stmt = insert(UserProfile).values(
        id=user.id,
        email=user.email or None,
        display_name=user.email.split("@")[0] if user.email else "Anonymous",
    )
    upsert_stmt = upsert_stmt.on_conflict_do_nothing(index_elements=["id"])
    await db.execute(upsert_stmt)

    trip = Trip(
        type=trip_data.type,
        destination=trip_data.destination,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        status=trip_data.status,
        notes=trip_data.notes,
        destination_latitude=trip_data.destination_latitude,
        destination_longitude=trip_data.destination_longitude,
        parent_trip_id=trip_data.parent_trip_id,
    )
    db.add(trip)
    await db.flush()

    member = TripMember(
        trip_id=trip.id,
        user_id=user.id,
        role=MemberRole.owner,
    )
    db.add(member)
    await db.commit()

    # Re-query with relationships loaded
    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.members).joinedload(TripMember.user),
            selectinload(Trip.children),
        )
        .where(Trip.id == trip.id)
    )
    result = await db.execute(stmt)
    trip = result.scalar_one()
    return _build_trip_response(trip)


@router.get("", response_model=list[TripSummary])
async def list_trips(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
    status: TripStatus | None = Query(default=None),
) -> list[TripSummary]:
    """List all trips the current user is a member of."""
    stmt = (
        select(Trip)
        .join(TripMember)
        .where(TripMember.user_id == user_id)
        .options(selectinload(Trip.members).joinedload(TripMember.user))
    )
    if status is not None:
        stmt = stmt.where(Trip.status == status)

    result = await db.execute(stmt)
    trips = result.scalars().all()

    # Bulk itinerary stats — 1 extra query for all trips
    trip_ids = [t.id for t in trips]
    stats_map: dict[object, tuple[int, int]] = {}
    if trip_ids:
        activity_per_day = (
            select(
                Activity.itinerary_day_id,
                func.count(Activity.id).label("cnt"),
            )
            .group_by(Activity.itinerary_day_id)
            .subquery("activity_per_day")
        )
        stats_stmt = (
            select(
                ItineraryDay.trip_id,
                func.count(ItineraryDay.id).label("day_count"),
                func.count(activity_per_day.c.itinerary_day_id).label("active_count"),
            )
            .outerjoin(
                activity_per_day,
                activity_per_day.c.itinerary_day_id == ItineraryDay.id,
            )
            .where(ItineraryDay.trip_id.in_(trip_ids))
            .group_by(ItineraryDay.trip_id)
        )
        stats_result = await db.execute(stats_stmt)
        stats_map = {
            row.trip_id: (row.day_count, row.active_count) for row in stats_result
        }

    summaries = []
    for t in trips:
        day_count, active_count = stats_map.get(t.id, (0, 0))
        sorted_members = sorted(t.members, key=lambda m: m.id)
        previews = [
            MemberPreview(
                initials=_member_initials(m.user.display_name, m.user.email),
                color=_member_color(m.user_id),
            )
            for m in sorted_members[:3]
        ]
        summaries.append(
            TripSummary(
                id=t.id,
                type=t.type,
                destination=t.destination,
                start_date=t.start_date,
                end_date=t.end_date,
                status=t.status,
                notes=t.notes,
                destination_latitude=t.destination_latitude,
                destination_longitude=t.destination_longitude,
                parent_trip_id=t.parent_trip_id,
                created_at=t.created_at,
                member_count=len(t.members),
                member_previews=previews,
                itinerary_day_count=day_count,
                days_with_activities=active_count,
            )
        )
    return summaries


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> TripResponse:
    """Get trip detail with members and children. Requires membership."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db)
    return _build_trip_response(trip)


@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: UUID,
    trip_data: TripUpdate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> TripResponse:
    """Partial update of a trip. Requires membership."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db)

    update_fields = trip_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(trip, field, value)

    await db.commit()
    await db.refresh(trip)

    # Re-query with relationships
    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.members).joinedload(TripMember.user),
            selectinload(Trip.children),
        )
        .where(Trip.id == trip.id)
    )
    result = await db.execute(stmt)
    trip = result.scalar_one()
    return _build_trip_response(trip)


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a trip. Requires owner role."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db, require_owner=True)
    await db.delete(trip)
    await db.commit()


@router.post("/{trip_id}/members", status_code=201, response_model=TripMemberResponse)
async def add_member(
    trip_id: UUID,
    body: AddMemberRequest,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> TripMemberResponse:
    """Add a member to a trip by email. Requires owner role."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db, require_owner=True)

    # Look up the user by email
    stmt = select(UserProfile).where(UserProfile.email == body.email)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = next((m for m in trip.members if m.user_id == target_user.id), None)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="User is already a member of this trip",
        )

    member = TripMember(
        trip_id=trip_id,
        user_id=target_user.id,
        role=MemberRole.member,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return TripMemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        display_name=target_user.display_name,
        email=target_user.email,
    )


@router.delete("/{trip_id}/members/{member_id}", status_code=204)
async def remove_member(
    trip_id: UUID,
    member_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a member from a trip. Requires owner role."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db, require_owner=True)

    target_member = next((m for m in trip.members if m.id == member_id), None)
    if target_member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(target_member)
    await db.commit()


@router.patch("/{trip_id}/members/{member_id}", response_model=TripMemberResponse)
async def update_member_role(
    trip_id: UUID,
    member_id: UUID,
    body: UpdateMemberRole,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> TripMemberResponse:
    """Change a member's role. Requires owner role."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db, require_owner=True)

    target_member = next((m for m in trip.members if m.id == member_id), None)
    if target_member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    target_member.role = body.role
    await db.commit()
    await db.refresh(target_member)

    return TripMemberResponse(
        id=target_member.id,
        user_id=target_member.user_id,
        role=target_member.role,
        display_name=target_member.user.display_name,
        email=target_member.user.email,
    )
