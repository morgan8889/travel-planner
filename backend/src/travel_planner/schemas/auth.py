import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    preferences: dict = Field(default_factory=dict)


class ProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    preferences: dict
    created_at: datetime
    model_config = {"from_attributes": True}
