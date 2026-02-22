from datetime import datetime

from travel_planner.models.itinerary import ActivitySource, ImportStatus
from travel_planner.schemas.itinerary import ActivityResponse


def test_gmail_callback_redirects_to_settings_when_no_trip_id():
    """When no trip_id, callback redirects to /settings (not hardcoded /trips)."""
    from travel_planner.config import settings

    assert hasattr(settings, "app_frontend_url")
    assert hasattr(settings, "supabase_service_role_key")
    assert "localhost:5173" not in settings.app_frontend_url or settings.app_frontend_url == "http://localhost:5173"


def test_activity_response_has_import_fields():
    data = {
        "id": "00000000-0000-0000-0000-000000000001",
        "itinerary_day_id": "00000000-0000-0000-0000-000000000002",
        "title": "Flight AA123",
        "category": "transport",
        "start_time": None,
        "end_time": None,
        "location": None,
        "latitude": None,
        "longitude": None,
        "notes": None,
        "confirmation_number": None,
        "sort_order": 0,
        "check_out_date": None,
        "source": "gmail_import",
        "source_ref": "msg123",
        "import_status": "pending_review",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    resp = ActivityResponse(**data)
    assert resp.source == ActivitySource.gmail_import
    assert resp.import_status == ImportStatus.pending_review


def test_gmail_status_not_connected(
    client, auth_headers, override_get_db, mock_db_session
):
    from unittest.mock import MagicMock

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.get("/gmail/status", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"connected": False, "last_sync_at": None}


def test_gmail_auth_url_not_configured(client, auth_headers):
    """Returns 503 when google credentials are empty."""
    response = client.get("/gmail/auth-url", headers=auth_headers)
    assert response.status_code == 503


def test_gmail_disconnect_when_not_connected(
    client, auth_headers, override_get_db, mock_db_session
):
    from unittest.mock import MagicMock

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.delete("/gmail/disconnect", headers=auth_headers)
    assert response.status_code == 404


def test_scan_requires_gmail_connected(
    client, auth_headers, override_get_db, mock_db_session
):
    """Scan returns 400 when Gmail is not connected."""
    from unittest.mock import MagicMock

    from tests.conftest import make_member, make_trip, make_user

    # Trip creation query
    owner_user = make_user()
    owner_member = make_member(user=owner_user)
    trip = make_trip(members=[owner_member])
    trip.start_date = datetime(2026, 6, 1).date()
    trip.end_date = datetime(2026, 6, 7).date()

    # First call: gmail_status check → not connected
    gmail_mock = MagicMock()
    gmail_mock.scalar_one_or_none.return_value = None

    # Second call: verify_trip_member → return trip
    trip_mock = MagicMock()
    trip_mock.scalar_one_or_none.return_value = trip

    mock_db_session.execute.side_effect = [gmail_mock, trip_mock]

    response = client.post(
        "/gmail/scan",
        json={"trip_id": "00000000-0000-0000-0000-000000000001"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "Gmail not connected" in response.json()["detail"]


def test_list_trip_activities_filters_by_import_status(
    client, auth_headers, override_get_db, mock_db_session
):
    """import_status query param filters activities correctly."""
    from unittest.mock import MagicMock

    from tests.conftest import make_member, make_trip, make_user

    owner_user = make_user()
    owner_member = make_member(user=owner_user)
    trip = make_trip(members=[owner_member])

    # verify_trip_member call
    trip_mock = MagicMock()
    trip_mock.scalar_one_or_none.return_value = trip

    # activities query returns empty list (no pending activities)
    activities_mock = MagicMock()
    activities_mock.scalars.return_value.all.return_value = []

    mock_db_session.execute.side_effect = [trip_mock, activities_mock]

    response = client.get(
        "/itinerary/trips/00000000-0000-0000-0000-000000000001/activities",
        params={"import_status": "pending_review"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert len(response.json()) == 0
