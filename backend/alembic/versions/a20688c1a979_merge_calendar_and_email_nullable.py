"""merge calendar and email_nullable

Revision ID: a20688c1a979
Revises: 004_add_calendar, 358bc0188c29
Create Date: 2026-02-17 19:07:03.333474

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a20688c1a979'
down_revision: Union[str, Sequence[str], None] = ('004_add_calendar', '358bc0188c29')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
