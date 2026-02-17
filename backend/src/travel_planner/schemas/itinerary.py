from datetime import date, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from travel_planner.models.itinerary import ActivityCategory


class ItineraryDayCreate(BaseModel):
    date: date
    notes: str | None = None


class ItineraryDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    date: date
    notes: str | None
    activity_count: int


class ActivityCreate(BaseModel):
    title: str
    category: ActivityCategory
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    notes: str | None = None
    confirmation_number: str | None = None


class ActivityUpdate(BaseModel):
    title: str | None = None
    category: ActivityCategory | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    notes: str | None = None
    confirmation_number: str | None = None
    sort_order: int | None = None


class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    itinerary_day_id: UUID
    title: str
    category: ActivityCategory
    start_time: time | None
    end_time: time | None
    location: str | None
    notes: str | None
    confirmation_number: str | None
    sort_order: int
