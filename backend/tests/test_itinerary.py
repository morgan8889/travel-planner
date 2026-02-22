from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from tests.conftest import (
    OTHER_USER_EMAIL,
    OTHER_USER_ID,
    TRIP_ID,
    create_test_token,
    make_member,
    make_trip,
    make_user,
)
from travel_planner.models.itinerary import Activity, ActivityCategory, ActivitySource, ItineraryDay

_ACTIVITY_CREATED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)

# Local aliases matching the previous private naming convention
_make_user = make_user
_make_trip = make_trip
_make_member = make_member


@pytest.fixture
def trip_id() -> str:
    """Return trip ID as string."""
    return str(TRIP_ID)


@pytest.fixture
def other_user_headers() -> dict[str, str]:
    """Create authorization headers for a different user."""
    token = create_test_token(str(OTHER_USER_ID), OTHER_USER_EMAIL)
    return {"Authorization": f"Bearer {token}"}


def test_list_itinerary_days_empty(
    client: TestClient,
    auth_headers: dict,
    trip_id: str,
    override_get_db,
    mock_db_session,
):
    """List itinerary days for trip with no days returns empty list"""
    # Setup: Trip exists and user is a member
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # First call: verify_trip_member query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: list itinerary days - returns tuples (ItineraryDay, count)
    result_mock2 = MagicMock()
    result_mock2.__iter__ = MagicMock(return_value=iter([]))

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(f"/itinerary/trips/{trip_id}/days", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_itinerary_days_with_data(
    client: TestClient,
    auth_headers: dict,
    trip_id: str,
    override_get_db,
    mock_db_session,
):
    """List itinerary days with activity counts in date order"""
    # Setup: Trip exists and user is a member
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # Create two itinerary days with different dates
    day1_id = UUID("555e4567-e89b-12d3-a456-426614174004")
    day2_id = UUID("666e4567-e89b-12d3-a456-426614174005")

    day1 = MagicMock(spec=ItineraryDay)
    day1.id = day1_id
    day1.trip_id = TRIP_ID
    day1.date = date(2026, 3, 15)  # Later date
    day1.notes = "Day 1 notes"

    day2 = MagicMock(spec=ItineraryDay)
    day2.id = day2_id
    day2.trip_id = TRIP_ID
    day2.date = date(2026, 3, 10)  # Earlier date
    day2.notes = None

    # First call: verify_trip_member query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: list itinerary days - returns tuples (ItineraryDay, count)
    # day2 should come first (earlier date), day1 second
    # day2 has 0 activities, day1 has 3 activities
    result_mock2 = MagicMock()
    result_mock2.__iter__ = MagicMock(
        return_value=iter(
            [
                (day2, 0),  # Earlier date, no activities
                (day1, 3),  # Later date, 3 activities
            ]
        )
    )

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(f"/itinerary/trips/{trip_id}/days", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Verify ordering by date (earlier first)
    assert data[0]["id"] == str(day2_id)
    assert data[0]["date"] == "2026-03-10"
    assert data[0]["activity_count"] == 0
    assert data[0]["notes"] is None

    assert data[1]["id"] == str(day1_id)
    assert data[1]["date"] == "2026-03-15"
    assert data[1]["activity_count"] == 3
    assert data[1]["notes"] == "Day 1 notes"


def test_list_itinerary_days_not_member(
    client: TestClient,
    other_user_headers: dict,
    trip_id: str,
    override_get_db,
    mock_db_session,
):
    """Non-member cannot list itinerary days"""
    # Setup: verify_trip_member query returns None (user not a member)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(
        f"/itinerary/trips/{trip_id}/days", headers=other_user_headers
    )
    assert response.status_code == 403


def test_create_itinerary_day(
    client: TestClient,
    auth_headers: dict,
    trip_id: str,
    override_get_db,
    mock_db_session,
):
    """Create itinerary day for trip"""
    # Setup: Trip exists and user is a member
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # First call: verify_trip_member query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    mock_db_session.execute = AsyncMock(return_value=result_mock1)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    # Mock refresh to set the ID on the day object (ItineraryDay instance)
    async def mock_refresh(obj):
        # Set the ID on the actual ItineraryDay object
        obj.id = UUID("777e4567-e89b-12d3-a456-426614174006")

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers,
        json={"date": "2026-07-15", "notes": "Arrival day"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["date"] == "2026-07-15"
    assert data["notes"] == "Arrival day"
    assert data["activity_count"] == 0


def test_create_activity(
    client: TestClient,
    auth_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """Create activity for itinerary day"""
    # Setup: Day exists and user has access
    day_id = UUID(itinerary_day_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    # First call: verify_day_access - get day with trip and member
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: get max sort_order
    result_mock3 = MagicMock()
    result_mock3.scalar.return_value = 2  # Max sort_order is 2

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    # Mock refresh to set the ID on the activity object
    async def mock_refresh(obj):
        obj.id = UUID("888e4567-e89b-12d3-a456-426614174007")
        obj.created_at = _ACTIVITY_CREATED_AT
        obj.source = ActivitySource.manual
        obj.source_ref = None
        obj.import_status = None

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/itinerary/days/{itinerary_day_id}/activities",
        headers=auth_headers,
        json={
            "title": "Flight to Paris",
            "category": "transport",
            "start_time": "14:30",
            "end_time": "18:45",
            "location": "CDG Airport",
            "notes": "Terminal 2E",
            "confirmation_number": "ABC123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Flight to Paris"
    assert data["category"] == "transport"
    assert data["start_time"] == "14:30:00"
    assert data["end_time"] == "18:45:00"
    assert data["location"] == "CDG Airport"
    assert data["notes"] == "Terminal 2E"
    assert data["confirmation_number"] == "ABC123"
    assert data["sort_order"] == 3  # Auto-incremented from max 2


def test_list_activities(
    client: TestClient,
    auth_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """List activities for itinerary day ordered by sort_order"""
    # Setup: Day exists and user has access
    day_id = UUID(itinerary_day_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    # Create activities
    activity1 = MagicMock(spec=Activity)
    activity1.id = UUID("999e4567-e89b-12d3-a456-426614174008")
    activity1.itinerary_day_id = day_id
    activity1.title = "Breakfast"
    activity1.category = ActivityCategory.food
    activity1.start_time = None
    activity1.end_time = None
    activity1.location = None
    activity1.latitude = None
    activity1.longitude = None
    activity1.notes = None
    activity1.confirmation_number = None
    activity1.sort_order = 0
    activity1.check_out_date = None
    activity1.source = ActivitySource.manual
    activity1.source_ref = None
    activity1.import_status = None
    activity1.created_at = _ACTIVITY_CREATED_AT

    activity2 = MagicMock(spec=Activity)
    activity2.id = UUID("aaae4567-e89b-12d3-a456-426614174009")
    activity2.itinerary_day_id = day_id
    activity2.title = "Eiffel Tower"
    activity2.category = ActivityCategory.activity
    activity2.start_time = None
    activity2.end_time = None
    activity2.location = "Champ de Mars"
    activity2.latitude = None
    activity2.longitude = None
    activity2.notes = "Book tickets in advance"
    activity2.confirmation_number = None
    activity2.sort_order = 1
    activity2.check_out_date = None
    activity2.source = ActivitySource.manual
    activity2.source_ref = None
    activity2.import_status = None
    activity2.created_at = _ACTIVITY_CREATED_AT

    # First call: verify_day_access - get day
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: list activities
    result_mock3 = MagicMock()
    result_mock3.scalars.return_value.all.return_value = [activity1, activity2]

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )

    response = client.get(
        f"/itinerary/days/{itinerary_day_id}/activities", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["title"] == "Breakfast"
    assert data[0]["sort_order"] == 0
    assert data[1]["title"] == "Eiffel Tower"
    assert data[1]["sort_order"] == 1
    assert data[1]["location"] == "Champ de Mars"


def test_update_activity(
    client: TestClient,
    auth_headers: dict,
    activity_id: str,
    override_get_db,
    mock_db_session,
):
    """Update activity with partial data"""
    # Setup: Activity exists and user has access
    act_id = UUID(activity_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = UUID("555e4567-e89b-12d3-a456-426614174004")
    day.trip_id = TRIP_ID

    activity = MagicMock(spec=Activity)
    activity.id = act_id
    activity.itinerary_day_id = day.id
    activity.title = "Old Title"
    activity.category = ActivityCategory.food
    activity.start_time = None
    activity.end_time = None
    activity.location = None
    activity.latitude = None
    activity.longitude = None
    activity.notes = None
    activity.confirmation_number = None
    activity.sort_order = 0
    activity.check_out_date = None
    activity.source = ActivitySource.manual
    activity.source_ref = None
    activity.import_status = None
    activity.created_at = _ACTIVITY_CREATED_AT

    # First call: get activity
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = activity

    # Second call: verify_day_access - get day
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = day

    result_mock3 = MagicMock()
    result_mock3.scalar_one_or_none.return_value = trip

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.commit = AsyncMock()

    # Mock refresh to update the activity object
    async def mock_refresh(obj):
        obj.title = "Updated Title"
        obj.notes = "New notes"

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.patch(
        f"/itinerary/activities/{activity_id}",
        headers=auth_headers,
        json={"title": "Updated Title", "notes": "New notes"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["notes"] == "New notes"


def test_delete_activity(
    client: TestClient,
    auth_headers: dict,
    activity_id: str,
    override_get_db,
    mock_db_session,
):
    """Delete activity"""
    # Setup: Activity exists and user has access
    act_id = UUID(activity_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = UUID("555e4567-e89b-12d3-a456-426614174004")
    day.trip_id = TRIP_ID

    activity = MagicMock(spec=Activity)
    activity.id = act_id
    activity.itinerary_day_id = day.id

    # First call: get activity
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = activity

    # Second call: verify_day_access - get day
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = day

    result_mock3 = MagicMock()
    result_mock3.scalar_one_or_none.return_value = trip

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        f"/itinerary/activities/{activity_id}", headers=auth_headers
    )
    assert response.status_code == 204


def test_reorder_activities(
    client: TestClient,
    auth_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """Reorder activities reverses sort_order"""
    day_id = UUID(itinerary_day_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    activity1 = MagicMock(spec=Activity)
    activity1.id = UUID("999e4567-e89b-12d3-a456-426614174008")
    activity1.itinerary_day_id = day_id
    activity1.title = "Breakfast"
    activity1.category = ActivityCategory.food
    activity1.start_time = None
    activity1.end_time = None
    activity1.location = None
    activity1.latitude = None
    activity1.longitude = None
    activity1.notes = None
    activity1.confirmation_number = None
    activity1.sort_order = 0
    activity1.check_out_date = None
    activity1.source = ActivitySource.manual
    activity1.source_ref = None
    activity1.import_status = None
    activity1.created_at = _ACTIVITY_CREATED_AT

    activity2 = MagicMock(spec=Activity)
    activity2.id = UUID("aaae4567-e89b-12d3-a456-426614174009")
    activity2.itinerary_day_id = day_id
    activity2.title = "Eiffel Tower"
    activity2.category = ActivityCategory.activity
    activity2.start_time = None
    activity2.end_time = None
    activity2.location = "Champ de Mars"
    activity2.latitude = None
    activity2.longitude = None
    activity2.notes = None
    activity2.confirmation_number = None
    activity2.sort_order = 1
    activity2.check_out_date = None
    activity2.source = ActivitySource.manual
    activity2.source_ref = None
    activity2.import_status = None
    activity2.created_at = _ACTIVITY_CREATED_AT

    # verify_day_access: get day, then verify_trip_member
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: select activities for this day
    result_mock3 = MagicMock()
    result_mock3.scalars.return_value.all.return_value = [activity1, activity2]

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.commit = AsyncMock()

    # Reverse the order: activity2 first, activity1 second
    response = client.patch(
        f"/itinerary/days/{itinerary_day_id}/reorder",
        headers=auth_headers,
        json={"activity_ids": [str(activity2.id), str(activity1.id)]},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == str(activity2.id)
    assert data[0]["sort_order"] == 0
    assert data[1]["id"] == str(activity1.id)
    assert data[1]["sort_order"] == 1


def test_reorder_activities_invalid_id(
    client: TestClient,
    auth_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """Reorder with unknown activity ID returns 400"""
    day_id = UUID(itinerary_day_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    # verify_day_access
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Activities query returns empty
    result_mock3 = MagicMock()
    result_mock3.scalars.return_value.all.return_value = []

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )

    response = client.patch(
        f"/itinerary/days/{itinerary_day_id}/reorder",
        headers=auth_headers,
        json={"activity_ids": ["00000000-0000-0000-0000-000000000099"]},
    )
    assert response.status_code == 400


def test_delete_itinerary_day(
    client: TestClient,
    auth_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """Delete itinerary day returns 204"""
    day_id = UUID(itinerary_day_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    # verify_day_access
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        f"/itinerary/days/{itinerary_day_id}", headers=auth_headers
    )
    assert response.status_code == 204


def test_delete_itinerary_day_not_member(
    client: TestClient,
    other_user_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """Non-member cannot delete itinerary day"""
    day_id = UUID(itinerary_day_id)

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    # verify_day_access: get day succeeds
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    # verify_trip_member: returns None (not a member)
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.delete(
        f"/itinerary/days/{itinerary_day_id}", headers=other_user_headers
    )
    assert response.status_code == 403


def test_generate_itinerary_days(
    client: TestClient,
    auth_headers: dict,
    trip_id: str,
    override_get_db,
    mock_db_session,
):
    """Generate itinerary days creates one day per date in trip range"""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])
    trip.start_date = date(2026, 3, 1)
    trip.end_date = date(2026, 3, 3)

    # verify_trip_member
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Existing dates query - none exist
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = []

    # Final query: return all days with counts
    day1 = MagicMock(spec=ItineraryDay)
    day1.id = UUID("aaa00000-0000-0000-0000-000000000001")
    day1.trip_id = TRIP_ID
    day1.date = date(2026, 3, 1)
    day1.notes = None

    day2 = MagicMock(spec=ItineraryDay)
    day2.id = UUID("aaa00000-0000-0000-0000-000000000002")
    day2.trip_id = TRIP_ID
    day2.date = date(2026, 3, 2)
    day2.notes = None

    day3 = MagicMock(spec=ItineraryDay)
    day3.id = UUID("aaa00000-0000-0000-0000-000000000003")
    day3.trip_id = TRIP_ID
    day3.date = date(2026, 3, 3)
    day3.notes = None

    result_mock3 = MagicMock()
    result_mock3.__iter__ = MagicMock(
        return_value=iter([(day1, 0), (day2, 0), (day3, 0)])
    )

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    response = client.post(
        f"/itinerary/trips/{trip_id}/days/generate", headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 3
    assert data[0]["date"] == "2026-03-01"
    assert data[1]["date"] == "2026-03-02"
    assert data[2]["date"] == "2026-03-03"


def test_generate_itinerary_days_skips_existing(
    client: TestClient,
    auth_headers: dict,
    trip_id: str,
    override_get_db,
    mock_db_session,
):
    """Generate days skips dates that already have an itinerary day"""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])
    trip.start_date = date(2026, 3, 1)
    trip.end_date = date(2026, 3, 3)

    # verify_trip_member
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Existing dates query - March 2 already exists
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [date(2026, 3, 2)]

    # Final query: return all 3 days (2 new + 1 existing)
    day1 = MagicMock(spec=ItineraryDay)
    day1.id = UUID("aaa00000-0000-0000-0000-000000000001")
    day1.trip_id = TRIP_ID
    day1.date = date(2026, 3, 1)
    day1.notes = None

    day2 = MagicMock(spec=ItineraryDay)
    day2.id = UUID("aaa00000-0000-0000-0000-000000000002")
    day2.trip_id = TRIP_ID
    day2.date = date(2026, 3, 2)
    day2.notes = None

    day3 = MagicMock(spec=ItineraryDay)
    day3.id = UUID("aaa00000-0000-0000-0000-000000000003")
    day3.trip_id = TRIP_ID
    day3.date = date(2026, 3, 3)
    day3.notes = None

    result_mock3 = MagicMock()
    result_mock3.__iter__ = MagicMock(
        return_value=iter([(day1, 0), (day2, 1), (day3, 0)])
    )

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    response = client.post(
        f"/itinerary/trips/{trip_id}/days/generate", headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 3
    # Verify only 2 days were added (not the existing one)
    assert mock_db_session.add.call_count == 2


def test_update_activity_moves_to_different_day(
    client: TestClient,
    auth_headers: dict,
    override_get_db,
    mock_db_session,
    activity_id: str,
    itinerary_day_id: str,
):
    """PATCH /itinerary/activities/{id} with itinerary_day_id moves
    activity to target day.
    """
    source_day_id = UUID(itinerary_day_id)
    target_day_id = UUID("aaa04567-e89b-12d3-a456-426614174099")
    act_id = UUID(activity_id)

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # Mock activity
    activity = MagicMock(spec=Activity)
    activity.id = act_id
    activity.itinerary_day_id = source_day_id
    activity.title = "Visit Museum"
    activity.category = ActivityCategory.activity
    activity.start_time = None
    activity.end_time = None
    activity.location = None
    activity.latitude = None
    activity.longitude = None
    activity.notes = None
    activity.confirmation_number = None
    activity.sort_order = 0
    activity.check_out_date = None
    activity.source = ActivitySource.manual
    activity.source_ref = None
    activity.import_status = None
    activity.created_at = _ACTIVITY_CREATED_AT

    # Mock source day
    source_day = MagicMock(spec=ItineraryDay)
    source_day.id = source_day_id
    source_day.trip_id = trip.id

    # Mock target day (same trip)
    target_day = MagicMock(spec=ItineraryDay)
    target_day.id = target_day_id
    target_day.trip_id = trip.id

    # Execute call sequence:
    # 1. select Activity (get activity)
    # 2. select ItineraryDay (verify_day_access — get source day)
    # 3. select Trip (verify_trip_member inside verify_day_access)
    # 4. select ItineraryDay (get target day)
    act_mock = MagicMock()
    act_mock.scalar_one_or_none.return_value = activity

    src_day_mock = MagicMock()
    src_day_mock.scalar_one_or_none.return_value = source_day

    trip_mock = MagicMock()
    trip_mock.scalar_one_or_none.return_value = trip

    tgt_day_mock = MagicMock()
    tgt_day_mock.scalar_one_or_none.return_value = target_day

    mock_db_session.execute = AsyncMock(
        side_effect=[act_mock, src_day_mock, trip_mock, tgt_day_mock]
    )

    response = client.patch(
        f"/itinerary/activities/{activity_id}",
        json={"itinerary_day_id": str(target_day_id)},
        headers=auth_headers,
    )
    assert response.status_code == 200


def test_update_activity_move_target_day_not_found(
    client: TestClient,
    auth_headers: dict,
    override_get_db,
    mock_db_session,
    activity_id: str,
    itinerary_day_id: str,
):
    """PATCH /itinerary/activities/{id} returns 404 when target day doesn't exist."""
    source_day_id = UUID(itinerary_day_id)
    target_day_id = UUID("aaa04567-e89b-12d3-a456-426614174099")
    act_id = UUID(activity_id)

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    activity = MagicMock(spec=Activity)
    activity.id = act_id
    activity.itinerary_day_id = source_day_id

    source_day = MagicMock(spec=ItineraryDay)
    source_day.id = source_day_id
    source_day.trip_id = trip.id

    act_mock = MagicMock()
    act_mock.scalar_one_or_none.return_value = activity

    src_day_mock = MagicMock()
    src_day_mock.scalar_one_or_none.return_value = source_day

    trip_mock = MagicMock()
    trip_mock.scalar_one_or_none.return_value = trip

    tgt_day_mock = MagicMock()
    tgt_day_mock.scalar_one_or_none.return_value = None  # target day not found

    mock_db_session.execute = AsyncMock(
        side_effect=[act_mock, src_day_mock, trip_mock, tgt_day_mock]
    )

    response = client.patch(
        f"/itinerary/activities/{activity_id}",
        json={"itinerary_day_id": str(target_day_id)},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_create_activity_with_check_out_date(
    client: TestClient,
    auth_headers: dict,
    itinerary_day_id: str,
    override_get_db,
    mock_db_session,
):
    """Create lodging activity with check_out_date stores and returns the field"""
    # Setup: Day exists and user has access
    day_id = UUID(itinerary_day_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    day = MagicMock(spec=ItineraryDay)
    day.id = day_id
    day.trip_id = TRIP_ID

    # First call: verify_day_access - get day with trip and member
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = day

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: get max sort_order
    result_mock3 = MagicMock()
    result_mock3.scalar.return_value = 0  # Max sort_order is 0

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    # Mock refresh to set the ID and check_out_date on the activity object
    async def mock_refresh(obj):
        obj.id = UUID("888e4567-e89b-12d3-a456-426614174007")
        obj.check_out_date = date(2026, 12, 18)
        obj.created_at = _ACTIVITY_CREATED_AT
        obj.source = ActivitySource.manual
        obj.source_ref = None
        obj.import_status = None

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/itinerary/days/{itinerary_day_id}/activities",
        headers=auth_headers,
        json={
            "title": "Hotel Paris",
            "category": "lodging",
            "check_out_date": "2026-12-18",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Hotel Paris"
    assert data["category"] == "lodging"
    assert data["check_out_date"] == "2026-12-18"


def test_update_activity_move_target_day_different_trip(
    client: TestClient,
    auth_headers: dict,
    override_get_db,
    mock_db_session,
    activity_id: str,
    itinerary_day_id: str,
):
    """PATCH /itinerary/activities/{id} returns 403 when target day
    is in a different trip.
    """
    import uuid as _uuid

    source_day_id = UUID(itinerary_day_id)
    target_day_id = UUID("aaa04567-e89b-12d3-a456-426614174099")
    act_id = UUID(activity_id)

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    activity = MagicMock(spec=Activity)
    activity.id = act_id
    activity.itinerary_day_id = source_day_id

    source_day = MagicMock(spec=ItineraryDay)
    source_day.id = source_day_id
    source_day.trip_id = trip.id

    # Target day belongs to a different trip
    target_day = MagicMock(spec=ItineraryDay)
    target_day.id = target_day_id
    target_day.trip_id = _uuid.uuid4()  # different trip

    act_mock = MagicMock()
    act_mock.scalar_one_or_none.return_value = activity

    src_day_mock = MagicMock()
    src_day_mock.scalar_one_or_none.return_value = source_day

    trip_mock = MagicMock()
    trip_mock.scalar_one_or_none.return_value = trip

    tgt_day_mock = MagicMock()
    tgt_day_mock.scalar_one_or_none.return_value = target_day

    mock_db_session.execute = AsyncMock(
        side_effect=[act_mock, src_day_mock, trip_mock, tgt_day_mock]
    )

    response = client.patch(
        f"/itinerary/activities/{activity_id}",
        json={"itinerary_day_id": str(target_day_id)},
        headers=auth_headers,
    )
    assert response.status_code == 403
