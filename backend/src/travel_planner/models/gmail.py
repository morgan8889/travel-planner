import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from travel_planner.crypto import EncryptedText
from travel_planner.models.base import Base, TimestampMixin, UUIDMixin


class GmailConnection(Base, UUIDMixin):
    __tablename__ = "gmail_connections"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), unique=True
    )
    access_token: Mapped[str] = mapped_column(EncryptedText)
    refresh_token: Mapped[str] = mapped_column(EncryptedText)
    token_expiry: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ImportRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "import_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    email_id: Mapped[str] = mapped_column(String(255), unique=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB)
