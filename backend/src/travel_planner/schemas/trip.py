import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from travel_planner.models.trip import MemberRole, TripStatus, TripType


class TripCreate(BaseModel):
    type: TripType
    destination: str = Field(..., min_length=1, max_length=255)
    start_date: date
    end_date: date
    status: TripStatus = TripStatus.dreaming
    notes: str | None = None
    parent_trip_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "TripCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TripUpdate(BaseModel):
    type: TripType | None = None
    destination: str | None = Field(default=None, min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: TripStatus | None = None
    notes: str | None = None
    parent_trip_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "TripUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date must be on or after start_date")
        return self


class TripMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: MemberRole
    display_name: str
    email: str | None
    model_config = {"from_attributes": True}


class TripSummary(BaseModel):
    id: uuid.UUID
    type: TripType
    destination: str
    start_date: date
    end_date: date
    status: TripStatus
    notes: str | None
    parent_trip_id: uuid.UUID | None
    created_at: datetime
    member_count: int
    model_config = {"from_attributes": True}


class TripResponse(BaseModel):
    id: uuid.UUID
    type: TripType
    destination: str
    start_date: date
    end_date: date
    status: TripStatus
    notes: str | None
    parent_trip_id: uuid.UUID | None
    created_at: datetime
    members: list[TripMemberResponse]
    children: list[TripSummary]
    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    email: str = Field(..., min_length=1)


class UpdateMemberRole(BaseModel):
    role: MemberRole
