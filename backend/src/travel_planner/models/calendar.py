import datetime as dt
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from travel_planner.models.user import Base


class HolidayCalendar(Base):
    __tablename__ = "holiday_calendars"
    __table_args__ = (
        UniqueConstraint("user_id", "country_code", "year", name="uq_holiday_calendar"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    country_code: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CustomDay(Base):
    __tablename__ = "custom_days"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    name: Mapped[str] = mapped_column(String(255))
    date: Mapped[dt.date] = mapped_column(Date)
    recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
