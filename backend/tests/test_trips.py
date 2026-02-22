from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from travel_planner.main import app
from travel_planner.models.trip import (
    MemberRole,
    Trip,
    TripMember,
    TripStatus,
    TripType,
)
from travel_planner.models.user import UserProfile
from travel_planner.routers.itinerary import _sync_itinerary_days

TEST_USER_ID = UUID("123e4567-e89b-12d3-a456-426614174000")
TEST_USER_EMAIL = "test@example.com"
OTHER_USER_ID = UUID("223e4567-e89b-12d3-a456-426614174001")
OTHER_USER_EMAIL = "other@example.com"
TRIP_ID = UUID("333e4567-e89b-12d3-a456-426614174002")
MEMBER_ID = UUID("443e4567-e89b-12d3-a456-426614174003")
OTHER_MEMBER_ID = UUID("553e4567-e89b-12d3-a456-426614174004")


@pytest.fixture
def client():
    return TestClient(app)


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
    children: list | None = None,
) -> MagicMock:
    """Create a mock Trip with sensible defaults."""
    trip = MagicMock(spec=Trip)
    trip.id = trip_id
    trip.type = TripType.vacation
    trip.destination = "Paris"
    trip.start_date = date(2026, 6, 1)
    trip.end_date = date(2026, 6, 15)
    trip.status = TripStatus.dreaming
    trip.notes = None
    trip.parent_trip_id = None
    trip.created_at = datetime(2026, 1, 1, 12, 0, 0)
    trip.members = members if members is not None else []
    trip.children = children if children is not None else []
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


# --- Test 1: Unauthenticated ---


def test_unauthenticated_returns_401(client: TestClient, override_get_db):
    """Test that GET /trips without auth returns 401."""
    response = client.get("/trips")
    assert response.status_code == 401


# --- Test 2: Create trip success ---


def test_create_trip_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test POST /trips with valid data returns 201."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # First execute: flush (no return needed)
    # The router does db.add + db.flush + db.add + db.commit, then re-queries
    # We need the re-query execute to return the trip
    result_mock = MagicMock()
    result_mock.scalar_one.return_value = trip

    # flush and commit are AsyncMocks (already set in conftest)
    mock_db_session.flush = AsyncMock()
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    payload = {
        "type": "vacation",
        "destination": "Paris",
        "start_date": "2026-06-01",
        "end_date": "2026-06-15",
    }
    response = client.post("/trips", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["destination"] == "Paris"
    assert data["type"] == "vacation"
    assert len(data["members"]) == 1
    assert data["members"][0]["role"] == "owner"


# --- Test 3: Create trip invalid dates ---


def test_create_trip_invalid_dates(
    client: TestClient, auth_headers: dict, override_get_db
):
    """Test POST /trips with end_date before start_date returns 422."""
    payload = {
        "type": "vacation",
        "destination": "Paris",
        "start_date": "2026-06-15",
        "end_date": "2026-06-01",
    }
    response = client.post("/trips", json=payload, headers=auth_headers)
    assert response.status_code == 422


# --- Test 4: List trips empty ---


def test_list_trips_empty(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips returns empty list when user has no trips."""
    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


# --- Test 5: List trips returns user trips ---


def test_list_trips_returns_user_trips(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips returns trips the user is a member of."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["destination"] == "Paris"
    assert data[0]["member_count"] == 1


# --- Test 6: List trips with status filter ---


def test_list_trips_status_filter(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips?status=dreaming filters by status."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips?status=dreaming", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


def test_list_trips_includes_member_previews(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips returns member_previews with initials and colors."""
    owner_user = _make_user(display_name="Alice Smith")
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    # Second execute call for itinerary stats
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert "member_previews" in data[0]
    assert len(data[0]["member_previews"]) == 1
    assert data[0]["member_previews"][0]["initials"] == "AS"


def test_list_trips_returns_all_member_previews(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """All member previews are returned, not just the first 3."""
    import uuid

    members = [
        _make_member(
            member_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            role=MemberRole.owner if i == 0 else MemberRole.member,
        )
        for i in range(5)
    ]
    for i, m in enumerate(members):
        m.user = _make_user(
            user_id=m.user_id,
            display_name=f"User {i}",
            email=f"user{i}@test.com",
        )
    trip = _make_trip(members=members)

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data[0]["member_previews"]) == 5


def test_list_trips_includes_itinerary_stats(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips returns itinerary_day_count and days_with_activities."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]

    # Stats row: trip_id, day_count=5, active_count=3
    stats_row = MagicMock()
    stats_row.trip_id = trip.id
    stats_row.day_count = 5
    stats_row.active_count = 3
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([stats_row]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["itinerary_day_count"] == 5
    assert data[0]["days_with_activities"] == 3


# --- Test: list_trips returns start_date in expected format ---


def test_list_trips_returns_start_date(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Trips endpoint returns start_date in ISO format after order_by change."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])
    # _make_trip already sets start_date = date(2026, 6, 1)

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["start_date"] == "2026-06-01"


# --- Test 7: Get trip detail success ---


def test_get_trip_detail_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips/{trip_id} returns trip with members and children."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member], children=[])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["destination"] == "Paris"
    assert len(data["members"]) == 1
    assert data["members"][0]["display_name"] == "Test User"
    assert data["children"] == []


# --- Test 8: Get trip detail not found ---


def test_get_trip_detail_not_found(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips/{trip_id} returns 404 for nonexistent trip."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 404


# --- Test 9: Get trip detail not member ---


def test_get_trip_detail_not_member(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips/{trip_id} returns 403 when user is not a member."""
    other_user = _make_user(user_id=OTHER_USER_ID, email=OTHER_USER_EMAIL)
    other_member = _make_member(
        member_id=OTHER_MEMBER_ID, user_id=OTHER_USER_ID, user=other_user
    )
    trip = _make_trip(members=[other_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 403


# --- Test 10: Update trip success ---


def test_update_trip_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test PATCH /trips/{trip_id} updates trip fields."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # First call: get_trip_with_membership query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # After update, re-query returns updated trip
    updated_trip = _make_trip(members=[owner_member])
    updated_trip.destination = "London"
    result_mock2 = MagicMock()
    result_mock2.scalar_one.return_value = updated_trip

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])
    mock_db_session.refresh = AsyncMock()

    payload = {"destination": "London"}
    response = client.patch(f"/trips/{TRIP_ID}", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["destination"] == "London"


# --- Test 11: Update trip not member ---


def test_update_trip_not_member(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test PATCH /trips/{trip_id} returns 403 when user is not a member."""
    other_user = _make_user(user_id=OTHER_USER_ID, email=OTHER_USER_EMAIL)
    other_member = _make_member(
        member_id=OTHER_MEMBER_ID, user_id=OTHER_USER_ID, user=other_user
    )
    trip = _make_trip(members=[other_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    payload = {"destination": "London"}
    response = client.patch(f"/trips/{TRIP_ID}", json=payload, headers=auth_headers)
    assert response.status_code == 403


# --- Test 12: Delete trip owner success ---


def test_delete_trip_owner_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test DELETE /trips/{trip_id} returns 204 for owner."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()

    response = client.delete(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 204


# --- Test 13: Delete trip non-owner ---


def test_delete_trip_non_owner(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test DELETE /trips/{trip_id} returns 403 for non-owner member."""
    owner_user = _make_user()
    # Test user is a member, not owner
    test_member = _make_member(user=owner_user, role=MemberRole.member)
    trip = _make_trip(members=[test_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.delete(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 403


# --- Test 14: Delete trip not found ---


def test_delete_trip_not_found(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test DELETE /trips/{trip_id} returns 404 for nonexistent trip."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.delete(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 404


# --- Test 15: Add member success ---


def test_add_member_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test POST /trips/{trip_id}/members adds a member by email."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # First call: get_trip_with_membership
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: lookup user by email
    new_user = _make_user(
        user_id=OTHER_USER_ID, email=OTHER_USER_EMAIL, display_name="Other User"
    )
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = new_user

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    async def _refresh(obj, **kwargs):
        # Simulate the database populating the id on refresh
        obj.id = OTHER_MEMBER_ID

    mock_db_session.refresh = AsyncMock(side_effect=_refresh)

    payload = {"email": OTHER_USER_EMAIL}
    response = client.post(
        f"/trips/{TRIP_ID}/members", json=payload, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == OTHER_USER_EMAIL
    assert data["role"] == "member"
    assert data["display_name"] == "Other User"


# --- Test 16: Add member not owner ---


def test_add_member_not_owner(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test POST /trips/{trip_id}/members returns 403 for non-owner."""
    owner_user = _make_user()
    test_member = _make_member(user=owner_user, role=MemberRole.member)
    trip = _make_trip(members=[test_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    payload = {"email": OTHER_USER_EMAIL}
    response = client.post(
        f"/trips/{TRIP_ID}/members", json=payload, headers=auth_headers
    )
    assert response.status_code == 403


# --- Test 17: Add member duplicate ---


def test_add_member_duplicate(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test POST /trips/{trip_id}/members returns 409 when user already a member."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    other_user = _make_user(
        user_id=OTHER_USER_ID, email=OTHER_USER_EMAIL, display_name="Other User"
    )
    existing_member = _make_member(
        member_id=OTHER_MEMBER_ID,
        user_id=OTHER_USER_ID,
        user=other_user,
        role=MemberRole.member,
    )
    trip = _make_trip(members=[owner_member, existing_member])

    # First call: get_trip_with_membership
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: lookup user by email - returns the same user
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = other_user

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    payload = {"email": OTHER_USER_EMAIL}
    response = client.post(
        f"/trips/{TRIP_ID}/members", json=payload, headers=auth_headers
    )
    assert response.status_code == 409


# --- Test 18: Add member user not found ---


def test_add_member_user_not_found(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test POST /trips/{trip_id}/members returns 404 when email not in system."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # First call: get_trip_with_membership
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: lookup user by email - not found
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    payload = {"email": "unknown@example.com"}
    response = client.post(
        f"/trips/{TRIP_ID}/members", json=payload, headers=auth_headers
    )
    assert response.status_code == 404


# --- Test 19: Remove member success ---


def test_remove_member_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test DELETE /trips/{trip_id}/members/{member_id} removes a member."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    other_user = _make_user(
        user_id=OTHER_USER_ID, email=OTHER_USER_EMAIL, display_name="Other User"
    )
    target_member = _make_member(
        member_id=OTHER_MEMBER_ID,
        user_id=OTHER_USER_ID,
        user=other_user,
        role=MemberRole.member,
    )
    trip = _make_trip(members=[owner_member, target_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()

    response = client.delete(
        f"/trips/{TRIP_ID}/members/{OTHER_MEMBER_ID}", headers=auth_headers
    )
    assert response.status_code == 204


# --- Test 20: Remove member not owner ---


def test_remove_member_not_owner(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test DELETE /trips/{trip_id}/members/{member_id} returns 403 for non-owner."""
    owner_user = _make_user()
    test_member = _make_member(user=owner_user, role=MemberRole.member)
    trip = _make_trip(members=[test_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.delete(
        f"/trips/{TRIP_ID}/members/{OTHER_MEMBER_ID}", headers=auth_headers
    )
    assert response.status_code == 403


# --- Test 21: Remove member not found ---


def test_remove_member_not_found(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test DELETE /trips/{trip_id}/members/{member_id} returns 404."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()

    # Use a member_id that doesn't exist in the trip
    nonexistent_id = UUID("663e4567-e89b-12d3-a456-426614174005")
    response = client.delete(
        f"/trips/{TRIP_ID}/members/{nonexistent_id}", headers=auth_headers
    )
    assert response.status_code == 404


# --- Test 22: Update member role success ---


def test_update_member_role_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test PATCH /trips/{trip_id}/members/{member_id} updates role."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    other_user = _make_user(
        user_id=OTHER_USER_ID, email=OTHER_USER_EMAIL, display_name="Other User"
    )
    target_member = _make_member(
        member_id=OTHER_MEMBER_ID,
        user_id=OTHER_USER_ID,
        user=other_user,
        role=MemberRole.member,
    )
    trip = _make_trip(members=[owner_member, target_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.refresh = AsyncMock()

    # After role update, the member should have the new role
    target_member.role = MemberRole.owner

    payload = {"role": "owner"}
    response = client.patch(
        f"/trips/{TRIP_ID}/members/{OTHER_MEMBER_ID}",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "owner"
    assert data["display_name"] == "Other User"


# --- Test 23: Update member role not owner ---


def test_update_member_role_not_owner(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test PATCH /trips/{trip_id}/members/{member_id} returns 403 for non-owner."""
    owner_user = _make_user()
    test_member = _make_member(user=owner_user, role=MemberRole.member)
    trip = _make_trip(members=[test_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    payload = {"role": "owner"}
    response = client.patch(
        f"/trips/{TRIP_ID}/members/{OTHER_MEMBER_ID}",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 403


# --- Test 24: Update member role not found ---


def test_update_member_role_not_found(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test PATCH /trips/{trip_id}/members/{member_id} returns 404."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    nonexistent_id = UUID("663e4567-e89b-12d3-a456-426614174005")
    payload = {"role": "owner"}
    response = client.patch(
        f"/trips/{TRIP_ID}/members/{nonexistent_id}",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_list_trips_includes_booking_stats(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """TripSummary includes per-category booking counts."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]

    stats_row = MagicMock()
    stats_row.trip_id = trip.id
    stats_row.day_count = 3
    stats_row.active_count = 2
    stats_row.transport_total = 2
    stats_row.transport_confirmed = 1
    stats_row.lodging_total = 1
    stats_row.lodging_confirmed = 1
    stats_row.activity_total = 4
    stats_row.activity_confirmed = 2

    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([stats_row]))

    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()[0]
    assert data["transport_total"] == 2
    assert data["transport_confirmed"] == 1
    assert data["lodging_total"] == 1
    assert data["lodging_confirmed"] == 1
    assert data["activity_total"] == 4
    assert data["activity_confirmed"] == 2


# --- Test 25: Create child trip ---


PARENT_TRIP_ID = UUID("773e4567-e89b-12d3-a456-426614174006")
CHILD_TRIP_ID = UUID("883e4567-e89b-12d3-a456-426614174007")


def test_create_child_trip(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test POST /trips with parent_trip_id creates a child trip."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    child_trip = _make_trip(members=[owner_member])
    child_trip.id = CHILD_TRIP_ID
    child_trip.parent_trip_id = PARENT_TRIP_ID

    result_mock = MagicMock()
    result_mock.scalar_one.return_value = child_trip

    mock_db_session.flush = AsyncMock()
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    payload = {
        "type": "vacation",
        "destination": "Nice",
        "start_date": "2026-06-01",
        "end_date": "2026-06-07",
        "parent_trip_id": str(PARENT_TRIP_ID),
    }
    response = client.post("/trips", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["parent_trip_id"] == str(PARENT_TRIP_ID)


# --- Test 26: Get trip includes children ---


def test_get_trip_includes_children(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips/{trip_id} returns children list for parent trip."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)

    child_member = _make_member()
    child = _make_trip(trip_id=CHILD_TRIP_ID, members=[child_member])
    child.parent_trip_id = PARENT_TRIP_ID

    parent = _make_trip(
        trip_id=PARENT_TRIP_ID, members=[owner_member], children=[child]
    )
    parent.type = TripType.sabbatical

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = parent
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(f"/trips/{PARENT_TRIP_ID}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["children"]) == 1
    assert data["children"][0]["id"] == str(CHILD_TRIP_ID)


# ---------------------------------------------------------------------------
# Direct unit tests for _sync_itinerary_days
# ---------------------------------------------------------------------------


def _make_row(row_id: UUID, row_date: date, cnt: int = 0) -> MagicMock:
    """Create a mock result row from the itinerary-days query."""
    row = MagicMock()
    row.id = row_id
    row.date = row_date
    row.cnt = cnt
    return row


@pytest.mark.asyncio
async def test_sync_creates_days_for_full_range():
    """_sync_itinerary_days creates one ItineraryDay per date in range."""
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []  # no existing days
    db.execute = AsyncMock(return_value=result)

    await _sync_itinerary_days(TRIP_ID, date(2026, 6, 1), date(2026, 6, 3), db)

    # Expect 3 db.add calls and one commit
    assert db.add.call_count == 3
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_sync_skips_existing_dates():
    """_sync_itinerary_days skips dates that already have an ItineraryDay."""
    db = AsyncMock()
    day_id = UUID("aaa00000-0000-0000-0000-000000000001")
    existing_row = _make_row(day_id, date(2026, 6, 1), cnt=0)
    result = MagicMock()
    result.all.return_value = [existing_row]
    db.execute = AsyncMock(return_value=result)

    await _sync_itinerary_days(TRIP_ID, date(2026, 6, 1), date(2026, 6, 3), db)

    # Only 2 new days (June 2 and June 3)
    assert db.add.call_count == 2
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_sync_no_op_when_dates_missing():
    """_sync_itinerary_days returns immediately when dates are absent."""
    db = AsyncMock()

    await _sync_itinerary_days(TRIP_ID, None, None, db)

    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_sync_no_op_when_range_exceeds_365_days():
    """_sync_itinerary_days returns immediately for ranges > 365 days."""
    db = AsyncMock()

    await _sync_itinerary_days(TRIP_ID, date(2025, 1, 1), date(2026, 6, 1), db)

    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_sync_no_op_when_range_is_inverted():
    """_sync_itinerary_days returns immediately when start_date > end_date.

    A PATCH that supplies only one date field can leave the stored range inverted
    (e.g. start_date=2027-01-01 on a trip whose end_date=2026-06-07).  Without
    the delta < 0 guard the orphan-deletion logic would treat every existing date
    as out-of-range and bulk-delete all empty itinerary days.
    """
    db = AsyncMock()

    # start_date is after end_date — inverted range
    await _sync_itinerary_days(TRIP_ID, date(2027, 1, 1), date(2026, 6, 7), db)

    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_sync_deletes_empty_orphan_days():
    """_sync_itinerary_days bulk-deletes empty days outside the new range."""
    db = AsyncMock()
    orphan_id = UUID("bbb00000-0000-0000-0000-000000000002")
    # One existing day outside the new range with 0 activities
    orphan_row = _make_row(orphan_id, date(2026, 5, 31), cnt=0)
    # One existing day inside the new range
    in_range_id = UUID("ccc00000-0000-0000-0000-000000000003")
    in_range_row = _make_row(in_range_id, date(2026, 6, 1), cnt=1)
    result = MagicMock()
    result.all.return_value = [orphan_row, in_range_row]
    db.execute = AsyncMock(return_value=result)

    await _sync_itinerary_days(TRIP_ID, date(2026, 6, 1), date(2026, 6, 2), db)

    # Two execute calls: initial query + sa_delete for orphan
    assert db.execute.call_count == 2
    # One add call for June 2 (June 1 already exists)
    assert db.add.call_count == 1
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_sync_preserves_orphan_days_with_activities():
    """_sync_itinerary_days does NOT delete orphan days that have activities."""
    db = AsyncMock()
    orphan_id = UUID("ddd00000-0000-0000-0000-000000000004")
    # Orphan day with 2 activities — must not be deleted
    orphan_row = _make_row(orphan_id, date(2026, 5, 31), cnt=2)
    result = MagicMock()
    result.all.return_value = [orphan_row]
    db.execute = AsyncMock(return_value=result)

    await _sync_itinerary_days(TRIP_ID, date(2026, 6, 1), date(2026, 6, 1), db)

    # Only one execute call (the initial fetch); no sa_delete
    assert db.execute.call_count == 1
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_sync_no_commit_when_nothing_changes():
    """_sync_itinerary_days skips db.commit when days are already in sync."""
    db = AsyncMock()
    day_id = UUID("eee00000-0000-0000-0000-000000000005")
    existing_row = _make_row(day_id, date(2026, 6, 1), cnt=0)
    result = MagicMock()
    result.all.return_value = [existing_row]
    db.execute = AsyncMock(return_value=result)

    # Range is exactly one day that already exists — nothing to add or delete
    await _sync_itinerary_days(TRIP_ID, date(2026, 6, 1), date(2026, 6, 1), db)

    db.add.assert_not_called()
    db.commit.assert_not_called()
