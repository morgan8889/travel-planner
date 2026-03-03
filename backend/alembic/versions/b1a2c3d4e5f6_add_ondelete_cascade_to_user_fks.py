"""add ondelete cascade to user FKs

Revision ID: b1a2c3d4e5f6
Revises: 53153ec3fd4c
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b1a2c3d4e5f6"
down_revision: Union[str, None] = "53153ec3fd4c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _replace_fk(
    table: str,
    column: str,
    ref_table: str,
    constraint_name: str,
    ondelete: str = "CASCADE",
) -> None:
    """Drop existing FK and recreate with ondelete action."""
    op.drop_constraint(constraint_name, table, type_="foreignkey")
    op.create_foreign_key(
        constraint_name, table, ref_table, [column], ["id"], ondelete=ondelete
    )


def _restore_fk(
    table: str,
    column: str,
    ref_table: str,
    constraint_name: str,
) -> None:
    """Drop FK with ondelete and recreate without."""
    op.drop_constraint(constraint_name, table, type_="foreignkey")
    op.create_foreign_key(constraint_name, table, ref_table, [column], ["id"])


def upgrade() -> None:
    # Gmail tables -> user_profiles
    _replace_fk(
        "gmail_connections",
        "user_id",
        "user_profiles",
        "gmail_connections_user_id_fkey",
    )
    _replace_fk(
        "import_records", "user_id", "user_profiles", "import_records_user_id_fkey"
    )
    _replace_fk("scan_runs", "user_id", "user_profiles", "scan_runs_user_id_fkey")
    _replace_fk(
        "unmatched_imports",
        "user_id",
        "user_profiles",
        "unmatched_imports_user_id_fkey",
    )

    # Calendar tables -> user_profiles
    _replace_fk(
        "holiday_calendars",
        "user_id",
        "user_profiles",
        "holiday_calendars_user_id_fkey",
    )
    _replace_fk("custom_days", "user_id", "user_profiles", "custom_days_user_id_fkey")

    # Chat tables -> CASCADE for messages, SET NULL for thread.trip_id
    _replace_fk(
        "chat_threads", "trip_id", "trips", "chat_threads_trip_id_fkey", "SET NULL"
    )
    _replace_fk(
        "chat_messages",
        "thread_id",
        "chat_threads",
        "chat_messages_thread_id_fkey",
    )


def downgrade() -> None:
    _restore_fk(
        "chat_messages",
        "thread_id",
        "chat_threads",
        "chat_messages_thread_id_fkey",
    )
    _restore_fk("chat_threads", "trip_id", "trips", "chat_threads_trip_id_fkey")
    _restore_fk("custom_days", "user_id", "user_profiles", "custom_days_user_id_fkey")
    _restore_fk(
        "holiday_calendars",
        "user_id",
        "user_profiles",
        "holiday_calendars_user_id_fkey",
    )
    _restore_fk(
        "unmatched_imports",
        "user_id",
        "user_profiles",
        "unmatched_imports_user_id_fkey",
    )
    _restore_fk("scan_runs", "user_id", "user_profiles", "scan_runs_user_id_fkey")
    _restore_fk(
        "import_records", "user_id", "user_profiles", "import_records_user_id_fkey"
    )
    _restore_fk(
        "gmail_connections",
        "user_id",
        "user_profiles",
        "gmail_connections_user_id_fkey",
    )
