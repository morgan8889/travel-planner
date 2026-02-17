from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ItineraryDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    date: date
    notes: str | None
    activity_count: int
