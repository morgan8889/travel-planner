"""add_event_trip_type

Revision ID: 0c007800d779
Revises: 4b560f5426ae
Create Date: 2026-02-22 07:37:05.563310

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0c007800d779'
down_revision: Union[str, Sequence[str], None] = '4b560f5426ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE triptype ADD VALUE 'event'")


def downgrade() -> None:
    # PostgreSQL can't remove enum values — recreate the type
    op.execute("UPDATE trips SET type = 'vacation' WHERE type = 'event'")
    op.execute("ALTER TYPE triptype RENAME TO triptype_old")
    op.execute("CREATE TYPE triptype AS ENUM ('vacation', 'remote_week', 'sabbatical')")
    op.execute(
        "ALTER TABLE trips ALTER COLUMN type TYPE triptype USING type::text::triptype"
    )
    op.execute("DROP TYPE triptype_old")
