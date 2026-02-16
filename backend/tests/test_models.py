from travel_planner.models import Base, UserProfile, Trip, TripMember
from travel_planner.models.trip import TripType, TripStatus, MemberRole


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
