"""add trip_invitations table

Revision ID: 44e7f8ec4661
Revises: 0c007800d779
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "44e7f8ec4661"
down_revision = "0c007800d779"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trip_invitations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "trip_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trips.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column(
            "invited_by",
            UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("trip_id", "email", name="uq_trip_invitation"),
    )
    op.create_index("ix_trip_invitations_email", "trip_invitations", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_trip_invitation", "trip_invitations", type_="unique")
    op.drop_index("ix_trip_invitations_email", "trip_invitations")
    op.drop_table("trip_invitations")
