import enum as _enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
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


class ScanRunStatus(_enum.StrEnum):
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class ScanEventStatus(_enum.StrEnum):
    imported = "imported"
    skipped = "skipped"
    unmatched = "unmatched"


class ScanEventSkipReason(_enum.StrEnum):
    already_imported = "already_imported"
    fetch_error = "fetch_error"
    no_text = "no_text"
    not_travel = "not_travel"
    no_date = "no_date"
    claude_error = "claude_error"


class ScanRun(Base, UUIDMixin):
    __tablename__ = "scan_runs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    status: Mapped[str] = mapped_column(String(20), default=ScanRunStatus.running)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    emails_found: Mapped[int] = mapped_column(Integer, default=0)
    imported_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    unmatched_count: Mapped[int] = mapped_column(Integer, default=0)
    rescan_rejected: Mapped[bool] = mapped_column(default=False)


class ScanEvent(Base, UUIDMixin):
    __tablename__ = "scan_events"

    scan_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_runs.id", ondelete="CASCADE")
    )
    email_id: Mapped[str] = mapped_column(String(255))
    gmail_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    skip_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    raw_claude_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UnmatchedImport(Base, UUIDMixin):
    __tablename__ = "unmatched_imports"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    scan_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_runs.id", ondelete="CASCADE")
    )
    email_id: Mapped[str] = mapped_column(String(255))
    parsed_data: Mapped[dict] = mapped_column(JSONB)
    assigned_trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    dismissed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
