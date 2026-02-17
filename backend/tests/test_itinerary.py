from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from travel_planner.main import app
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

    # Second call: list itinerary days
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = []

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []


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
