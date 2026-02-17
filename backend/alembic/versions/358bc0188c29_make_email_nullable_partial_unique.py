"""make_email_nullable_partial_unique

Revision ID: 358bc0188c29
Revises: 002_add_checklists
Create Date: 2026-02-17 07:39:46.485621

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "358bc0188c29"
down_revision: str | Sequence[str] | None = "003_add_itinerary"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop the old unique constraint on email
    op.drop_constraint("user_profiles_email_key", "user_profiles", type_="unique")

    # Make email nullable
    op.alter_column("user_profiles", "email", nullable=True)

    # Convert existing empty-string emails to NULL
    op.execute("UPDATE user_profiles SET email = NULL WHERE email = ''")

    # Add partial unique index: only enforce uniqueness for non-null emails
    op.create_index(
        "ix_user_profiles_email_unique",
        "user_profiles",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_user_profiles_email_unique", "user_profiles")
    op.alter_column("user_profiles", "email", nullable=False)
    op.create_unique_constraint("user_profiles_email_key", "user_profiles", ["email"])
