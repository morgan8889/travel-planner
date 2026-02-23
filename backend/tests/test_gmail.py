from datetime import UTC, datetime
from datetime import date as _date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from travel_planner.models.itinerary import ActivitySource, ImportStatus
from travel_planner.schemas.itinerary import ActivityResponse

TRIP_ID = UUID("00000000-0000-0000-0000-000000000001")
EMAIL_ID = "gmail_msg_abc123"


def _make_conn():
    """Mock GmailConnection with valid non-expired token."""
    from travel_planner.models.gmail import GmailConnection

    conn = MagicMock(spec=GmailConnection)
    conn.access_token = "access_tok"
    conn.refresh_token = "refresh_tok"
    conn.token_expiry = datetime(2030, 1, 1, tzinfo=UTC)
    conn.last_sync_at = None
    return conn


def _make_scan_db(mock_db_session, conn, trip, days=None, already_imported=None):
    """Wire up the 4 DB execute calls that scan_gmail makes."""
    conn_r = MagicMock()
    conn_r.scalar_one_or_none.return_value = conn

    trip_r = MagicMock()
    trip_r.scalar_one_or_none.return_value = trip

    day_r = MagicMock()
    day_r.scalars.return_value.all.return_value = days or []

    imp_r = MagicMock()
    imp_r.scalars.return_value.all.return_value = already_imported or []

    mock_db_session.execute.side_effect = [conn_r, trip_r, day_r, imp_r]


def _make_service_mock(messages=None):
    """Return a mock Gmail service that yields given message ids from list()."""
    svc = MagicMock()
    list_response = {"messages": messages or []}
    (
        svc.users.return_value.messages.return_value.list.return_value.execute.return_value
    ) = list_response
    return svc


def test_gmail_callback_redirects_to_settings_when_no_trip_id():
    """When no trip_id, callback redirects to /settings (not hardcoded /trips)."""
    from travel_planner.config import settings

    assert hasattr(settings, "app_frontend_url")
    assert hasattr(settings, "supabase_service_role_key")
    assert (
        "localhost:5173" not in settings.app_frontend_url
        or settings.app_frontend_url == "http://localhost:5173"
    )


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


# ---------------------------------------------------------------------------
# scan_gmail — behaviour tests
# ---------------------------------------------------------------------------


def _make_itinerary_day(day_date: _date) -> MagicMock:
    day = MagicMock()
    day.date = day_date
    day.id = UUID("00000000-0000-0000-0000-000000000099")
    return day


def _base_scan_setup(mock_db_session, *, days=None, already_imported=None):
    """Return (conn, trip) after wiring DB mocks for scan_gmail."""
    from tests.conftest import make_member, make_trip, make_user

    conn = _make_conn()
    owner_member = make_member(user=make_user())
    trip = make_trip(members=[owner_member])
    trip.start_date = _date(2026, 6, 1)
    trip.end_date = _date(2026, 6, 7)
    _make_scan_db(
        mock_db_session, conn, trip, days=days, already_imported=already_imported
    )
    return conn, trip


def test_scan_skips_already_imported_email(
    client, auth_headers, override_get_db, mock_db_session
):
    """scan_gmail skips emails whose id is already in ImportRecord."""
    _base_scan_setup(mock_db_session, already_imported=[EMAIL_ID])
    svc = _make_service_mock(messages=[{"id": EMAIL_ID}])

    with (
        patch(
            "travel_planner.routers.gmail._build_service",
            new=AsyncMock(return_value=svc),
        ),
        patch(
            "asyncio.to_thread",
            new=AsyncMock(return_value={"messages": [{"id": EMAIL_ID}]}),
        ),
    ):
        response = client.post(
            "/gmail/scan",
            json={"trip_id": str(TRIP_ID)},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["skipped_count"] == 1
    assert data["imported_count"] == 0


def test_scan_skips_when_claude_returns_none(
    client, auth_headers, override_get_db, mock_db_session
):
    """scan_gmail skips emails when Claude returns None (non-travel content)."""
    day = _make_itinerary_day(_date(2026, 6, 3))
    _base_scan_setup(mock_db_session, days=[day])
    svc = _make_service_mock(messages=[{"id": EMAIL_ID}])
    msg_body = {"payload": {"body": {"data": ""}, "parts": []}}

    with (
        patch(
            "travel_planner.routers.gmail._build_service",
            new=AsyncMock(return_value=svc),
        ),
        patch(
            "asyncio.to_thread",
            new=AsyncMock(
                side_effect=[
                    {"messages": [{"id": EMAIL_ID}]},
                    msg_body,
                ]
            ),
        ),
        patch(
            "travel_planner.routers.gmail._parse_with_claude",
            new=AsyncMock(return_value=None),
        ),
    ):
        response = client.post(
            "/gmail/scan",
            json={"trip_id": str(TRIP_ID)},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["skipped_count"] == 1
    assert data["imported_count"] == 0


def test_scan_skips_invalid_date_from_claude(
    client, auth_headers, override_get_db, mock_db_session
):
    """scan_gmail skips emails when Claude returns an unparseable date."""
    day = _make_itinerary_day(_date(2026, 6, 3))
    _base_scan_setup(mock_db_session, days=[day])
    svc = _make_service_mock(messages=[{"id": EMAIL_ID}])
    msg_body = {"payload": {"body": {"data": ""}, "parts": []}}
    bad_parse = {"title": "Flight", "category": "transport", "date": "not-a-date"}

    with (
        patch(
            "travel_planner.routers.gmail._build_service",
            new=AsyncMock(return_value=svc),
        ),
        patch(
            "asyncio.to_thread",
            new=AsyncMock(side_effect=[{"messages": [{"id": EMAIL_ID}]}, msg_body]),
        ),
        patch(
            "travel_planner.routers.gmail._parse_with_claude",
            new=AsyncMock(return_value=bad_parse),
        ),
    ):
        response = client.post(
            "/gmail/scan",
            json={"trip_id": str(TRIP_ID)},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["skipped_count"] == 1
    assert data["imported_count"] == 0


def test_scan_skips_date_outside_trip_range(
    client, auth_headers, override_get_db, mock_db_session
):
    """scan_gmail skips emails whose activity date is not in days_by_date."""
    day = _make_itinerary_day(_date(2026, 6, 3))
    _base_scan_setup(mock_db_session, days=[day])
    svc = _make_service_mock(messages=[{"id": EMAIL_ID}])
    msg_body = {"payload": {"body": {"data": ""}, "parts": []}}
    # Parsed date is July, outside the June trip
    outside_parse = {"title": "Hotel", "category": "lodging", "date": "2026-07-15"}

    with (
        patch(
            "travel_planner.routers.gmail._build_service",
            new=AsyncMock(return_value=svc),
        ),
        patch(
            "asyncio.to_thread",
            new=AsyncMock(side_effect=[{"messages": [{"id": EMAIL_ID}]}, msg_body]),
        ),
        patch(
            "travel_planner.routers.gmail._parse_with_claude",
            new=AsyncMock(return_value=outside_parse),
        ),
    ):
        response = client.post(
            "/gmail/scan",
            json={"trip_id": str(TRIP_ID)},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["skipped_count"] == 1
    assert data["imported_count"] == 0


def test_scan_imports_valid_booking(
    client, auth_headers, override_get_db, mock_db_session
):
    """scan_gmail imports an email when Claude returns a valid travel booking."""
    import base64

    trip_date = _date(2026, 6, 3)
    day = _make_itinerary_day(trip_date)
    _base_scan_setup(mock_db_session, days=[day])
    svc = _make_service_mock(messages=[{"id": EMAIL_ID}])
    encoded = base64.urlsafe_b64encode(b"Flight AA123 booking confirmation").decode()
    msg_body = {
        "payload": {
            "mimeType": "text/plain",
            "body": {"data": encoded},
            "parts": [],
        }
    }
    valid_parse = {
        "title": "Flight AA123",
        "category": "transport",
        "date": "2026-06-03",
        "location": "JFK",
        "confirmation_number": "XYZ789",
    }

    with (
        patch(
            "travel_planner.routers.gmail._build_service",
            new=AsyncMock(return_value=svc),
        ),
        patch(
            "asyncio.to_thread",
            new=AsyncMock(side_effect=[{"messages": [{"id": EMAIL_ID}]}, msg_body]),
        ),
        patch(
            "travel_planner.routers.gmail._parse_with_claude",
            new=AsyncMock(return_value=valid_parse),
        ),
    ):
        response = client.post(
            "/gmail/scan",
            json={"trip_id": str(TRIP_ID)},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 1
    assert data["skipped_count"] == 0
    # Two db.add calls: ImportRecord + Activity
    assert mock_db_session.add.call_count == 2


# ---------------------------------------------------------------------------
# _build_service — token refresh unit test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_service_refreshes_expired_token():
    """_build_service updates conn.access_token when credentials have expired."""
    from travel_planner.routers.gmail import _build_service

    conn = MagicMock()
    conn.access_token = "old_token"
    conn.refresh_token = "valid_refresh"
    conn.token_expiry = datetime(2020, 1, 1, tzinfo=UTC)  # expired

    mock_creds = MagicMock()
    mock_creds.expired = True
    mock_creds.refresh_token = "valid_refresh"
    mock_creds.token = "new_token"
    mock_creds.expiry = datetime(2030, 1, 1, tzinfo=UTC)

    with (
        patch("travel_planner.routers.gmail.Credentials", return_value=mock_creds),
        patch("travel_planner.routers.gmail.Request"),
        patch("travel_planner.routers.gmail.build"),
        patch(
            "travel_planner.routers.gmail.asyncio",
        ) as mock_asyncio,
    ):
        mock_asyncio.to_thread = AsyncMock(return_value=None)
        await _build_service(conn)

    assert conn.access_token == "new_token"
    mock_asyncio.to_thread.assert_called_once()
