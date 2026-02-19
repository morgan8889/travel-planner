"""replace calendar blocks with holidays and custom days"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "08443a1a87aa"
down_revision = "005_add_coordinates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old tables
    op.drop_table("calendar_blocks")
    op.drop_table("annual_plans")

    # Create new tables
    op.create_table(
        "holiday_calendars",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id"),
            nullable=False,
        ),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "custom_days",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("recurring", sa.Boolean, default=False, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("custom_days")
    op.drop_table("holiday_calendars")

    # Recreate old tables
    op.create_table(
        "annual_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "calendar_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "annual_plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("annual_plans.id"),
            nullable=False,
        ),
        sa.Column(
            "type",
            sa.Enum("pto", "holiday", name="blocktype"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("destination", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
