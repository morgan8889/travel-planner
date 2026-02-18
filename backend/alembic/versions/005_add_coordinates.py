"""add coordinates to trips and activities

Revision ID: 005_add_coordinates
Revises: a20688c1a979
Create Date: 2026-02-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_add_coordinates'
down_revision: Union[str, Sequence[str], None] = 'a20688c1a979'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trips', sa.Column('destination_latitude', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('destination_longitude', sa.Float(), nullable=True))
    op.add_column('activities', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('activities', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('activities', 'longitude')
    op.drop_column('activities', 'latitude')
    op.drop_column('trips', 'destination_longitude')
    op.drop_column('trips', 'destination_latitude')
