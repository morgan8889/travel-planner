"""add performance indexes on foreign key columns

Revision ID: f8a3c9d2e1b7
Revises: 4b560f5426ae
Create Date: 2026-02-23 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "f8a3c9d2e1b7"
down_revision: Union[str, Sequence[str], None] = "da62fad8e07c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # trip_members: index on user_id for list_trips and auth checks
    # (trip_id is already covered by the uq_trip_member unique constraint)
    op.create_index("ix_trip_members_user_id", "trip_members", ["user_id"])

    # itinerary_days: index on trip_id for itinerary loads
    # (trip_id is also leftmost in uq_itinerary_day, but a dedicated index is leaner)
    op.create_index("ix_itinerary_days_trip_id", "itinerary_days", ["trip_id"])

    # activities: index on itinerary_day_id for activity listing
    op.create_index(
        "ix_activities_itinerary_day_id", "activities", ["itinerary_day_id"]
    )

    # checklists: index on trip_id for checklist loads
    op.create_index("ix_checklists_trip_id", "checklists", ["trip_id"])

    # holiday_calendars: index on user_id for calendar queries
    # (user_id is also leftmost in uq_holiday_calendar)
    op.create_index("ix_holiday_calendars_user_id", "holiday_calendars", ["user_id"])

    # custom_days: index on user_id for calendar queries
    op.create_index("ix_custom_days_user_id", "custom_days", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_custom_days_user_id", "custom_days")
    op.drop_index("ix_holiday_calendars_user_id", "holiday_calendars")
    op.drop_index("ix_checklists_trip_id", "checklists")
    op.drop_index("ix_activities_itinerary_day_id", "activities")
    op.drop_index("ix_itinerary_days_trip_id", "itinerary_days")
    op.drop_index("ix_trip_members_user_id", "trip_members")
