from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChecklistCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class ChecklistItemCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class ChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    checklist_id: UUID
    text: str
    sort_order: int
    checked: bool


class ChecklistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    title: str
    items: list[ChecklistItemResponse]
