"""add check_out_date to activities

Revision ID: 4e4bf7c5cb7d
Revises: 08443a1a87aa
Create Date: 2026-02-20 20:28:51.576811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e4bf7c5cb7d'
down_revision: Union[str, Sequence[str], None] = '08443a1a87aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("activities", sa.Column("check_out_date", sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("activities", "check_out_date")
