import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from travel_planner.models.calendar import BlockType


class AnnualPlanCreate(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    notes: str | None = Field(default=None, max_length=5000)


class AnnualPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    year: int
    notes: str | None
    created_at: datetime


class CalendarBlockCreate(BaseModel):
    type: BlockType
    start_date: date
    end_date: date
    destination: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self) -> "CalendarBlockCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class CalendarBlockUpdate(BaseModel):
    type: BlockType | None = None
    start_date: date | None = None
    end_date: date | None = None
    destination: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self) -> "CalendarBlockUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date must be on or after start_date")
        return self


class CalendarBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    annual_plan_id: uuid.UUID
    type: BlockType
    start_date: date
    end_date: date
    destination: str | None
    notes: str | None


class TripSummaryForCalendar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    destination: str
    start_date: date
    end_date: date
    status: str


class CalendarYearResponse(BaseModel):
    plan: AnnualPlanResponse | None
    blocks: list[CalendarBlockResponse]
    trips: list[TripSummaryForCalendar]
