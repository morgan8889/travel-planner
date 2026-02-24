"""add scan_runs scan_events unmatched_imports

Revision ID: 53153ec3fd4c
Revises: f8a3c9d2e1b7
Create Date: 2026-02-24 16:34:11.048756

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '53153ec3fd4c'
down_revision: Union[str, Sequence[str], None] = 'f8a3c9d2e1b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scan_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emails_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unmatched_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rescan_rejected", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["user_id"], ["user_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_runs_user_id", "scan_runs", ["user_id"])

    op.create_table(
        "scan_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("scan_run_id", sa.UUID(), nullable=False),
        sa.Column("email_id", sa.String(255), nullable=False),
        sa.Column("gmail_subject", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("skip_reason", sa.String(50), nullable=True),
        sa.Column("trip_id", sa.UUID(), nullable=True),
        sa.Column("raw_claude_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["scan_run_id"], ["scan_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_events_scan_run_id", "scan_events", ["scan_run_id"])

    op.create_table(
        "unmatched_imports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("scan_run_id", sa.UUID(), nullable=False),
        sa.Column("email_id", sa.String(255), nullable=False),
        sa.Column("parsed_data", postgresql.JSONB(), nullable=False),
        sa.Column("assigned_trip_id", sa.UUID(), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user_profiles.id"]),
        sa.ForeignKeyConstraint(["scan_run_id"], ["scan_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_unmatched_imports_user_id", "unmatched_imports", ["user_id"])


def downgrade() -> None:
    op.drop_table("unmatched_imports")
    op.drop_table("scan_events")
    op.drop_table("scan_runs")
