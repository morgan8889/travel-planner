import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.user import Base


class ActivityCategory(str, enum.Enum):
    transport = "transport"
    food = "food"
    activity = "activity"
    lodging = "lodging"


class ActivitySource(str, enum.Enum):
    manual = "manual"
    gmail_import = "gmail_import"


class ImportStatus(str, enum.Enum):
    pending_review = "pending_review"
    confirmed = "confirmed"
    rejected = "rejected"


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id")
    )
    date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    activities: Mapped[list["Activity"]] = relationship(
        back_populates="itinerary_day", order_by="Activity.sort_order"
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    itinerary_day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("itinerary_days.id")
    )
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[ActivityCategory] = mapped_column(Enum(ActivityCategory))
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmation_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[ActivitySource] = mapped_column(
        Enum(ActivitySource), default=ActivitySource.manual
    )
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    import_status: Mapped[ImportStatus | None] = mapped_column(
        Enum(ImportStatus), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    itinerary_day: Mapped["ItineraryDay"] = relationship(back_populates="activities")
