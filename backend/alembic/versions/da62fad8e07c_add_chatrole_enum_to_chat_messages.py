"""add chatrole enum to chat_messages

Revision ID: da62fad8e07c
Revises: 44e7f8ec4661
Create Date: 2026-02-23 09:47:36.867150

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "da62fad8e07c"
down_revision: Union[str, Sequence[str], None] = "44e7f8ec4661"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

chatrole = postgresql.ENUM("user", "assistant", name="chatrole")


def upgrade() -> None:
    """Change chat_messages.role from VARCHAR(20) to the chatrole enum type."""
    chatrole.create(op.get_bind())
    op.alter_column(
        "chat_messages",
        "role",
        type_=chatrole,
        postgresql_using="role::chatrole",
        existing_nullable=False,
    )


def downgrade() -> None:
    """Revert chat_messages.role back to VARCHAR(20)."""
    op.alter_column(
        "chat_messages",
        "role",
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    chatrole.drop(op.get_bind())
