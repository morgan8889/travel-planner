"""Add itinerary_days and activities tables

Revision ID: 003_add_itinerary
Revises: 002_add_checklists
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision = "003_add_itinerary"
down_revision = "002_add_checklists"
branch_labels = None
depends_on = None

activitycategory_enum = ENUM(
    "transport", "food", "activity", "lodging",
    name="activitycategory",
    create_type=False,
)
activitysource_enum = ENUM(
    "manual", "gmail_import",
    name="activitysource",
    create_type=False,
)
importstatus_enum = ENUM(
    "pending_review", "confirmed", "rejected",
    name="importstatus",
    create_type=False,
)


def upgrade() -> None:
    activitycategory_enum.create(op.get_bind(), checkfirst=True)
    activitysource_enum.create(op.get_bind(), checkfirst=True)
    importstatus_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "itinerary_days",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "trip_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trips.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
    )

    op.create_table(
        "activities",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "itinerary_day_id",
            UUID(as_uuid=True),
            sa.ForeignKey("itinerary_days.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", activitycategory_enum, nullable=False),
        sa.Column("start_time", sa.Time, nullable=True),
        sa.Column("end_time", sa.Time, nullable=True),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("confirmation_number", sa.String(100), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("source", activitysource_enum, nullable=False, server_default="manual"),
        sa.Column("source_ref", sa.String(255), nullable=True),
        sa.Column("import_status", importstatus_enum, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("activities")
    op.drop_table("itinerary_days")
    activitycategory_enum.drop(op.get_bind(), checkfirst=True)
    activitysource_enum.drop(op.get_bind(), checkfirst=True)
    importstatus_enum.drop(op.get_bind(), checkfirst=True)
