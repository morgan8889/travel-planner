import datetime as dt
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from travel_planner.models.base import Base, TimestampMixin, UUIDMixin


class HolidayCalendar(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "holiday_calendars"
    __table_args__ = (
        UniqueConstraint("user_id", "country_code", "year", name="uq_holiday_calendar"),
        Index("ix_holiday_calendars_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    country_code: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)


class CustomDay(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "custom_days"
    __table_args__ = (Index("ix_custom_days_user_id", "user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    name: Mapped[str] = mapped_column(String(255))
    date: Mapped[dt.date] = mapped_column(Date)
    recurring: Mapped[bool] = mapped_column(Boolean, default=False)
