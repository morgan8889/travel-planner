from uuid import UUID

from pydantic import BaseModel


class GmailScanCreate(BaseModel):
    trip_id: UUID
