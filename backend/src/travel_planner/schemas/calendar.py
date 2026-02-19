import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class HolidayEntry(BaseModel):
    """A single holiday from a country calendar (computed, not stored)."""

    date: date
    name: str
    country_code: str


class CustomDayCreate(BaseModel):
    name: str = Field(..., max_length=255)
    date: date
    recurring: bool = False


class CustomDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    date: date
    recurring: bool
    created_at: datetime


class EnableCountryRequest(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=10)
    year: int = Field(..., ge=2000, le=2100)


class HolidayCalendarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    country_code: str
    year: int


class HolidaysResponse(BaseModel):
    """Combined holidays + custom days for a year."""

    holidays: list[HolidayEntry]
    custom_days: list[CustomDayResponse]
    enabled_countries: list[HolidayCalendarResponse]


class TripSummaryForCalendar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    destination: str
    start_date: date
    end_date: date
    status: str
