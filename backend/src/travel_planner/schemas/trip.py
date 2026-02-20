import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from travel_planner.models.trip import MemberRole, TripStatus, TripType

AVATAR_COLORS = [
    "#6366f1",  # indigo
    "#22c55e",  # green
    "#f59e0b",  # amber
    "#f43f5e",  # rose
    "#06b6d4",  # cyan
    "#a855f7",  # purple
    "#3b82f6",  # blue
    "#f97316",  # orange
]


def _member_initials(display_name: str, email: str | None) -> str:
    if display_name and display_name != "Anonymous":
        parts = display_name.split()
        return "".join(p[0] for p in parts if p)[:2].upper()
    if email:
        return email.split("@")[0][:2].upper()
    return "?"


def _member_color(user_id: uuid.UUID) -> str:
    return AVATAR_COLORS[user_id.int % len(AVATAR_COLORS)]


class MemberPreview(BaseModel):
    initials: str
    color: str


class TripCreate(BaseModel):
    type: TripType
    destination: str = Field(..., min_length=1, max_length=255)
    start_date: date
    end_date: date
    status: TripStatus = TripStatus.dreaming
    notes: str | None = None
    destination_latitude: float | None = Field(default=None, ge=-90, le=90)
    destination_longitude: float | None = Field(default=None, ge=-180, le=180)
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
    destination_latitude: float | None = Field(default=None, ge=-90, le=90)
    destination_longitude: float | None = Field(default=None, ge=-180, le=180)
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
    destination_latitude: float | None = None
    destination_longitude: float | None = None
    parent_trip_id: uuid.UUID | None
    created_at: datetime
    member_count: int
    member_previews: list[MemberPreview] = []
    itinerary_day_count: int = 0
    days_with_activities: int = 0
    model_config = {"from_attributes": True}


class TripResponse(BaseModel):
    id: uuid.UUID
    type: TripType
    destination: str
    start_date: date
    end_date: date
    status: TripStatus
    notes: str | None
    destination_latitude: float | None = None
    destination_longitude: float | None = None
    parent_trip_id: uuid.UUID | None
    created_at: datetime
    members: list[TripMemberResponse]
    children: list[TripSummary]
    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    email: str = Field(..., min_length=1)


class UpdateMemberRole(BaseModel):
    role: MemberRole
