from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from travel_planner.main import app
from travel_planner.models.itinerary import Activity, ActivityCategory, ItineraryDay
from travel_planner.models.trip import MemberRole, Trip, TripMember
from travel_planner.models.user import UserProfile

TEST_USER_ID = UUID("123e4567-e89b-12d3-a456-426614174000")
TEST_USER_EMAIL = "test@example.com"
OTHER_USER_ID = UUID("223e4567-e89b-12d3-a456-426614174001")
OTHER_USER_EMAIL = "other@example.com"
TRIP_ID = UUID("333e4567-e89b-12d3-a456-426614174002")
MEMBER_ID = UUID("443e4567-e89b-12d3-a456-426614174003")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def trip_id() -> str:
    """Return trip ID as string."""
    return str(TRIP_ID)


@pytest.fixture
def other_user_headers() -> dict[str, str]:
    """Create authorization headers for a different user."""
    from tests.conftest import create_test_token

    token = create_test_token(str(OTHER_USER_ID), OTHER_USER_EMAIL)
    return {"Authorization": f"Bearer {token}"}


def _make_user(
    user_id: UUID = TEST_USER_ID,
    email: str = TEST_USER_EMAIL,
    display_name: str = "Test User",
) -> MagicMock:
    """Create a mock UserProfile."""
    user = MagicMock(spec=UserProfile)
    user.id = user_id
    user.email = email
    user.display_name = display_name
    return user


def _make_trip(
    trip_id: UUID = TRIP_ID,
    members: list | None = None,
) -> MagicMock:
    """Create a mock Trip with sensible defaults."""
    trip = MagicMock(spec=Trip)
    trip.id = trip_id
    trip.members = members if members is not None else []
    return trip


def _make_member(
    member_id: UUID = MEMBER_ID,
    trip_id: UUID = TRIP_ID,
    user_id: UUID = TEST_USER_ID,
    role: MemberRole = MemberRole.owner,
    user: MagicMock | None = None,
) -> MagicMock:
    """Create a mock TripMember."""
    member = MagicMock(spec=TripMember)
    member.id = member_id
    member.trip_id = trip_id
    member.user_id = user_id
    member.role = role
    member.user = user if user is not None else _make_user(user_id=user_id)
    return member


def test_list_itinerary_days_empty(
    client: TestClient, auth_headers: dict, trip_id: str, override_get_db, mock_db_session
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

    response = client.get(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []


def test_list_itinerary_days_with_data(
    client: TestClient, auth_headers: dict, trip_id: str, override_get_db, mock_db_session
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
    result_mock2.__iter__ = MagicMock(return_value=iter([
        (day2, 0),  # Earlier date, no activities
        (day1, 3),  # Later date, 3 activities
    ]))

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers
    )

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
    client: TestClient, other_user_headers: dict, trip_id: str, override_get_db, mock_db_session
):
    """Non-member cannot list itinerary days"""
    # Setup: verify_trip_member query returns None (user not a member)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(
        f"/itinerary/trips/{trip_id}/days",
        headers=other_user_headers
    )
    assert response.status_code == 403


def test_create_itinerary_day(
    client: TestClient, auth_headers: dict, trip_id: str, override_get_db, mock_db_session
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
        json={
            "date": "2026-07-15",
            "notes": "Arrival day"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["date"] == "2026-07-15"
    assert data["notes"] == "Arrival day"
    assert data["activity_count"] == 0
