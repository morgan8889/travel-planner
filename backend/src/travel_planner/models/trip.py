import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.user import Base, UserProfile


class TripType(enum.StrEnum):
    vacation = "vacation"
    remote_week = "remote_week"
    sabbatical = "sabbatical"


class TripStatus(enum.StrEnum):
    dreaming = "dreaming"
    planning = "planning"
    booked = "booked"
    active = "active"
    completed = "completed"


class MemberRole(enum.StrEnum):
    owner = "owner"
    member = "member"


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    type: Mapped[TripType] = mapped_column(Enum(TripType))
    destination: Mapped[str] = mapped_column(String(255))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus), default=TripStatus.dreaming
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    members: Mapped[list["TripMember"]] = relationship(back_populates="trip")
    children: Mapped[list["Trip"]] = relationship(back_populates="parent")
    parent: Mapped["Trip | None"] = relationship(
        back_populates="children", remote_side=[id]
    )


class TripMember(Base):
    __tablename__ = "trip_members"
    __table_args__ = (UniqueConstraint("trip_id", "user_id", name="uq_trip_member"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="CASCADE")
    )
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole))

    trip: Mapped["Trip"] = relationship(back_populates="members")
    user: Mapped["UserProfile"] = relationship()
