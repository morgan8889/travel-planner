from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ChecklistCreate(BaseModel):
    title: str


class ChecklistItemCreate(BaseModel):
    text: str


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
