from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from travel_planner.models.gmail import ScanRunStatus


class GmailScanStart(BaseModel):
    rescan_rejected: bool = False


class ScanStartResponse(BaseModel):
    scan_id: UUID


class ScanRunResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    status: ScanRunStatus
    started_at: datetime
    finished_at: datetime | None
    emails_found: int
    imported_count: int
    skipped_count: int
    unmatched_count: int
    rescan_rejected: bool


class UnmatchedImportResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    email_id: str
    parsed_data: dict
    created_at: datetime


class AssignUnmatchedBody(BaseModel):
    trip_id: UUID
