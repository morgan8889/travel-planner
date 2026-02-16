from travel_planner.models import Base, UserProfile, Trip, TripMember, AnnualPlan, CalendarBlock, ItineraryDay, Activity
from travel_planner.models.trip import TripType, TripStatus, MemberRole
from travel_planner.models.calendar import BlockType
from travel_planner.models.itinerary import ActivityCategory, ActivitySource, ImportStatus


def test_user_and_trip_models_importable():
    models = [UserProfile, Trip, TripMember]
    assert len(models) == 3


def test_base_has_user_and_trip_tables():
    table_names = Base.metadata.tables.keys()
    assert "user_profiles" in table_names
    assert "trips" in table_names
    assert "trip_members" in table_names


def test_trip_type_enum():
    assert TripType.vacation == "vacation"
    assert TripType.remote_week == "remote_week"
    assert TripType.sabbatical == "sabbatical"


def test_trip_status_enum():
    assert TripStatus.dreaming == "dreaming"
    assert TripStatus.planning == "planning"
    assert TripStatus.booked == "booked"
    assert TripStatus.active == "active"
    assert TripStatus.completed == "completed"


def test_member_role_enum():
    assert MemberRole.owner == "owner"
    assert MemberRole.member == "member"


def test_calendar_models_importable():
    models = [AnnualPlan, CalendarBlock]
    assert len(models) == 2


def test_calendar_tables_exist():
    table_names = Base.metadata.tables.keys()
    assert "annual_plans" in table_names
    assert "calendar_blocks" in table_names


def test_block_type_enum():
    assert BlockType.pto == "pto"
    assert BlockType.holiday == "holiday"


def test_itinerary_models_importable():
    models = [ItineraryDay, Activity]
    assert len(models) == 2


def test_itinerary_tables_exist():
    table_names = Base.metadata.tables.keys()
    assert "itinerary_days" in table_names
    assert "activities" in table_names


def test_activity_category_enum():
    assert ActivityCategory.transport == "transport"
    assert ActivityCategory.food == "food"
    assert ActivityCategory.activity == "activity"
    assert ActivityCategory.lodging == "lodging"


def test_activity_source_enum():
    assert ActivitySource.manual == "manual"
    assert ActivitySource.gmail_import == "gmail_import"


def test_import_status_enum():
    assert ImportStatus.pending_review == "pending_review"
    assert ImportStatus.confirmed == "confirmed"
    assert ImportStatus.rejected == "rejected"
