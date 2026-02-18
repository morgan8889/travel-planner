"""Add annual_plans and calendar_blocks tables

Revision ID: 004_add_calendar
Revises: 003_add_itinerary
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision = "004_add_calendar"
down_revision = "003_add_itinerary"
branch_labels = None
depends_on = None

blocktype_enum = ENUM("pto", "holiday", name="blocktype", create_type=False)


def upgrade() -> None:
    blocktype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "annual_plans",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "year", name="uq_annual_plan"),
    )

    op.create_table(
        "calendar_blocks",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "annual_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("annual_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", blocktype_enum, nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("destination", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("calendar_blocks")
    op.drop_table("annual_plans")
    blocktype_enum.drop(op.get_bind(), checkfirst=True)
