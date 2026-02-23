import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.base import Base, TimestampMixin, UUIDMixin
from travel_planner.models.user import UserProfile


class TripType(enum.StrEnum):
    vacation = "vacation"
    remote_week = "remote_week"
    sabbatical = "sabbatical"
    event = "event"


class TripStatus(enum.StrEnum):
    dreaming = "dreaming"
    planning = "planning"
    booked = "booked"
    active = "active"
    completed = "completed"


class MemberRole(enum.StrEnum):
    owner = "owner"
    member = "member"


class Trip(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trips"

    type: Mapped[TripType] = mapped_column(Enum(TripType))
    destination: Mapped[str] = mapped_column(String(255))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus), default=TripStatus.dreaming
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    destination_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    parent_trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True
    )

    members: Mapped[list["TripMember"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", passive_deletes=True
    )
    children: Mapped[list["Trip"]] = relationship(back_populates="parent")
    parent: Mapped["Trip | None"] = relationship(
        back_populates="children", remote_side="Trip.id"
    )


class TripMember(Base, UUIDMixin):
    __tablename__ = "trip_members"
    __table_args__ = (UniqueConstraint("trip_id", "user_id", name="uq_trip_member"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="CASCADE")
    )
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole))

    trip: Mapped["Trip"] = relationship(back_populates="members")
    user: Mapped["UserProfile"] = relationship()


class TripInvitation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trip_invitations"
    __table_args__ = (UniqueConstraint("trip_id", "email", name="uq_trip_invitation"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE")
    )
    email: Mapped[str] = mapped_column(String(255))
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="CASCADE")
    )
