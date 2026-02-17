"""Initial schema: user_profiles, trips, trip_members

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

triptype_enum = ENUM("vacation", "remote_week", "sabbatical", name="triptype", create_type=False)
tripstatus_enum = ENUM(
    "dreaming", "planning", "booked", "active", "completed", name="tripstatus", create_type=False
)
memberrole_enum = ENUM("owner", "member", name="memberrole", create_type=False)


def upgrade() -> None:
    triptype_enum.create(op.get_bind(), checkfirst=True)
    tripstatus_enum.create(op.get_bind(), checkfirst=True)
    memberrole_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "user_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("preferences", JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "trips",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("type", triptype_enum, nullable=False),
        sa.Column("destination", sa.String(255), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column(
            "status", tripstatus_enum, nullable=False, server_default="dreaming"
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "parent_trip_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trips.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "trip_members",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "trip_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trips.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", memberrole_enum, nullable=False),
        sa.UniqueConstraint("trip_id", "user_id", name="uq_trip_member"),
    )


def downgrade() -> None:
    op.drop_table("trip_members")
    op.drop_table("trips")
    op.drop_table("user_profiles")

    memberrole_enum.drop(op.get_bind(), checkfirst=True)
    tripstatus_enum.drop(op.get_bind(), checkfirst=True)
    triptype_enum.drop(op.get_bind(), checkfirst=True)
