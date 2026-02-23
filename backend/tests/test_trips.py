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


def _make_no_inv_result() -> MagicMock:
    """Return a mock execute result with no pending invitations."""
    r = MagicMock()
    r.scalars.return_value.all.return_value = []
    return r


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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

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
    # Third execute call for itinerary stats
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock]
    )

    response = client.get(f"/trips/{TRIP_ID}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["destination"] == "Paris"
    assert len(data["members"]) == 1
    assert data["members"][0]["display_name"] == "Test User"
    assert data["children"] == []


# --- Test 7b: Get trip auto-completes past trip ---


def test_get_trip_auto_completes_past_trip(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips/{id} auto-updates a past non-completed trip to 'completed'."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2024, 1, 1)  # past
    trip.status = TripStatus.booked  # not yet completed
    trip.destination_latitude = None
    trip.destination_longitude = None

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock]
    )

    response = client.get(f"/trips/{trip.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    mock_db_session.commit.assert_called()


def test_get_trip_does_not_complete_future_trip(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips/{id} does NOT auto-complete a trip whose end_date is in the future."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2099, 12, 31)
    trip.status = TripStatus.booked
    trip.destination_latitude = None
    trip.destination_longitude = None

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock]
    )

    response = client.get(f"/trips/{trip.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "booked"
    mock_db_session.commit.assert_not_called()


# --- Test 8: Get trip detail not found ---


def test_get_trip_detail_not_found(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Test GET /trips/{trip_id} returns 404 for nonexistent trip."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock]
    )

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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock]
    )

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
    """POST /trips/{trip_id}/members returns 202 when email not in system."""
    from unittest.mock import patch

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # First call: get_trip_with_membership
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: lookup user by email in user_profiles - not found
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    # Third call: fallback lookup in auth.users - not found
    result_mock3 = MagicMock()
    result_mock3.fetchone.return_value = None

    # Fourth call: duplicate invitation check - not found
    result_mock4 = MagicMock()
    result_mock4.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3, result_mock4]
    )
    mock_db_session.add = MagicMock()

    with patch("travel_planner.routers.trips.settings") as mock_settings:
        mock_settings.supabase_service_role_key = None
        mock_settings.supabase_url = "https://example.supabase.co"

        payload = {"email": "unknown@example.com"}
        response = client.post(
            f"/trips/{TRIP_ID}/members", json=payload, headers=auth_headers
        )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "invited"
    assert data["email"] == "unknown@example.com"
    mock_db_session.add.assert_called_once()


# --- Test 18b: Add member sends invite when no account ---


def test_add_member_sends_invite_when_no_account(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """POST /trips/{id}/members returns 202 and creates invitation when unknown."""
    from unittest.mock import patch

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # Call 1: get_trip_with_membership → trip found
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Call 2: user_profiles lookup → not found
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    # Call 3: auth.users lookup → not found
    result_mock3 = MagicMock()
    result_mock3.fetchone.return_value = None

    # Call 4: duplicate invitation check → not found
    result_mock4 = MagicMock()
    result_mock4.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3, result_mock4]
    )
    mock_db_session.add = MagicMock()

    with patch("travel_planner.routers.trips.settings") as mock_settings:
        mock_settings.supabase_service_role_key = None  # Skip actual HTTP call
        mock_settings.supabase_url = "https://example.supabase.co"

        response = client.post(
            f"/trips/{TRIP_ID}/members",
            json={"email": "newuser@example.com"},
            headers=auth_headers,
        )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "invited"
    assert data["email"] == "newuser@example.com"
    mock_db_session.add.assert_called_once()


# --- Test 18c: Duplicate invitation returns 409 ---


def test_add_member_duplicate_invitation(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """POST /trips/{id}/members returns 409 when invitation already pending."""
    from unittest.mock import patch

    from travel_planner.models.trip import TripInvitation as TripInvitationModel

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # Call 1: get_trip_with_membership
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Call 2: user_profiles lookup → not found
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    # Call 3: auth.users lookup → not found
    result_mock3 = MagicMock()
    result_mock3.fetchone.return_value = None

    # Call 4: duplicate invitation check → FOUND (existing invite)
    existing_inv = MagicMock(spec=TripInvitationModel)
    result_mock4 = MagicMock()
    result_mock4.scalar_one_or_none.return_value = existing_inv

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3, result_mock4]
    )

    with patch("travel_planner.routers.trips.settings") as mock_settings:
        mock_settings.supabase_service_role_key = None
        mock_settings.supabase_url = "https://example.supabase.co"

        response = client.post(
            f"/trips/{TRIP_ID}/members",
            json={"email": "already.invited@example.com"},
            headers=auth_headers,
        )

    assert response.status_code == 409
    assert "already" in response.json()["detail"].lower()


# --- Test 18d: Supabase API failure returns 500 ---


def test_add_member_invite_supabase_failure(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """POST /trips/{id}/members returns 500 when Supabase invite API fails."""
    from unittest.mock import patch

    import httpx

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    result_mock3 = MagicMock()
    result_mock3.fetchone.return_value = None

    result_mock4 = MagicMock()
    result_mock4.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3, result_mock4]
    )

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 422
    mock_response.text = "Unprocessable Entity"

    with (
        patch("travel_planner.routers.trips.settings") as mock_settings,
        patch("travel_planner.routers.trips.httpx.AsyncClient") as mock_client_cls,
    ):
        mock_settings.supabase_service_role_key = "fake-service-key"
        mock_settings.supabase_url = "https://example.supabase.co"

        mock_http_client = MagicMock()
        mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
        mock_http_client.__aexit__ = AsyncMock(return_value=None)
        mock_http_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_http_client

        response = client.post(
            f"/trips/{TRIP_ID}/members",
            json={"email": "failme@example.com"},
            headers=auth_headers,
        )

    assert response.status_code == 500
    assert "invite" in response.json()["detail"].lower()


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


def test_list_trips_auto_completes_past_trips(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips auto-updates past non-completed trips to 'completed' in response."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2024, 1, 1)  # clearly in the past
    trip.status = TripStatus.planning  # not yet completed

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["status"] == "completed"
    mock_db_session.commit.assert_called()


def test_list_trips_does_not_complete_future_trips(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips does NOT auto-complete trips whose end_date is in the future."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2099, 12, 31)
    trip.status = TripStatus.planning

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()[0]["status"] == "planning"
    mock_db_session.commit.assert_not_called()


def test_list_trips_does_not_recommit_already_completed_past_trips(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips skips commit when past trips are already 'completed'."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2024, 1, 1)
    trip.status = TripStatus.completed  # already done

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()[0]["status"] == "completed"
    mock_db_session.commit.assert_not_called()


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
    stats_row.restaurant_total = 0
    stats_row.restaurant_confirmed = 0

    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([stats_row]))

    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()[0]
    assert data["transport_total"] == 2
    assert data["transport_confirmed"] == 1
    assert data["lodging_total"] == 1
    assert data["lodging_confirmed"] == 1
    assert data["activity_total"] == 4
    assert data["activity_confirmed"] == 2


def test_list_trips_returns_restaurant_stats(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips returns restaurant_total and restaurant_confirmed counts."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]

    stats_row = MagicMock()
    stats_row.trip_id = trip.id
    stats_row.day_count = 0
    stats_row.active_count = 0
    stats_row.transport_total = 0
    stats_row.transport_confirmed = 0
    stats_row.lodging_total = 0
    stats_row.lodging_confirmed = 0
    stats_row.activity_total = 0
    stats_row.activity_confirmed = 0
    stats_row.restaurant_total = 3
    stats_row.restaurant_confirmed = 1
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([stats_row]))

    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()[0]
    assert data["restaurant_total"] == 3
    assert data["restaurant_confirmed"] == 1


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
    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock]
    )

    response = client.get(f"/trips/{PARENT_TRIP_ID}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["children"]) == 1
    assert data["children"][0]["id"] == str(CHILD_TRIP_ID)


def test_list_trips_claims_pending_invitation(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips auto-claims pending invitations for the current user's email."""
    from travel_planner.models.trip import TripInvitation as TripInvitationModel

    # Invitation matching TEST_USER's email
    inv = MagicMock(spec=TripInvitationModel)
    inv.trip_id = TRIP_ID
    inv.email = TEST_USER_EMAIL

    # Call 1: claim invitations query — returns one pending invitation
    inv_scalars = MagicMock()
    inv_scalars.all.return_value = [inv]
    inv_result = MagicMock()
    inv_result.scalars.return_value = inv_scalars

    # Call 2: list trips query — returns empty (simplest case; skips stats query)
    trips_scalars = MagicMock()
    trips_scalars.all.return_value = []
    trips_result = MagicMock()
    trips_result.scalars.return_value = trips_scalars

    mock_db_session.execute = AsyncMock(side_effect=[inv_result, trips_result])
    mock_db_session.add = MagicMock()
    mock_db_session.delete = AsyncMock()

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    # Invitation was deleted (claimed)
    mock_db_session.delete.assert_called_once_with(inv)
    # New TripMember was added with correct attributes
    mock_db_session.add.assert_called_once()
    added = mock_db_session.add.call_args[0][0]
    assert isinstance(added, TripMember)
    assert added.trip_id == TRIP_ID
    assert added.user_id == TEST_USER_ID
    assert added.role == MemberRole.member


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

    # Expect 3 db.add calls; commit is owned by callers, not the helper
    assert db.add.call_count == 3
    db.commit.assert_not_called()


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

    # Only 2 new days (June 2 and June 3); commit owned by callers
    assert db.add.call_count == 2
    db.commit.assert_not_called()


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
    db.commit.assert_not_called()


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
    db.commit.assert_not_called()


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


def test_trip_invitation_model_fields():
    """TripInvitation has the expected fields."""
    from travel_planner.models.trip import TripInvitation

    inv = TripInvitation.__table__
    col_names = {c.name for c in inv.columns}
    assert col_names == {"id", "trip_id", "email", "invited_by", "created_at"}


def test_list_invitations_requires_owner(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Non-owners cannot list invitations."""
    import uuid

    from travel_planner.auth import get_current_user_id

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # Override to a different user (non-owner) — the trip has only owner_member
    other_user_id = uuid.uuid4()
    app.dependency_overrides[get_current_user_id] = lambda: other_user_id

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    try:
        resp = client.get(f"/trips/{TRIP_ID}/invitations", headers=auth_headers)
        assert resp.status_code == 403
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID


def test_list_invitations_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """Owner can list invitations; returns empty list when none exist."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # First call: get_trip_with_membership
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: select invitations — empty result
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = []
    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    resp = client.get(f"/trips/{TRIP_ID}/invitations", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []
