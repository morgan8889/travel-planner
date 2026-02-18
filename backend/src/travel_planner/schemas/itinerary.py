from datetime import date, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from travel_planner.models.itinerary import ActivityCategory


class ItineraryDayCreate(BaseModel):
    date: date
    notes: str | None = Field(default=None, max_length=5000)


class ItineraryDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    date: date
    notes: str | None
    activity_count: int


class ActivityCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: ActivityCategory
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    confirmation_number: str | None = None

    @model_validator(mode="after")
    def end_time_after_start_time(self) -> "ActivityCreate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class ActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: ActivityCategory | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    confirmation_number: str | None = None
    sort_order: int | None = None

    @model_validator(mode="after")
    def end_time_after_start_time(self) -> "ActivityUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    itinerary_day_id: UUID
    title: str
    category: ActivityCategory
    start_time: time | None
    end_time: time | None
    location: str | None
    latitude: float | None
    longitude: float | None
    notes: str | None
    confirmation_number: str | None
    sort_order: int


class ActivityReorderUpdate(BaseModel):
    activity_ids: list[UUID] = Field(..., min_length=1)

    @field_validator("activity_ids")
    @classmethod
    def activity_ids_must_be_unique(cls, v: list[UUID]) -> list[UUID]:
        if len(v) != len(set(v)):
            raise ValueError("activity_ids must not contain duplicates")
        return v
