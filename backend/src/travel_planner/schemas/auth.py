import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    preferences: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def check_preferences_size(self) -> "ProfileCreate":
        import json

        if len(json.dumps(self.preferences)) > 16_384:
            raise ValueError("preferences payload too large (max 16 KB)")
        return self


class ProfileResponse(BaseModel):
    id: uuid.UUID
    email: str | None
    display_name: str
    preferences: dict
    created_at: datetime
    model_config = {"from_attributes": True}
