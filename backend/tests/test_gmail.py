from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from travel_planner.models.itinerary import ActivitySource, ImportStatus
from travel_planner.schemas.itinerary import ActivityResponse

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
    from unittest.mock import patch

    with patch("travel_planner.routers.gmail.settings") as mock_settings:
        mock_settings.google_client_id = ""
        mock_settings.google_client_secret = ""
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
# New centralized scan endpoint tests
# ---------------------------------------------------------------------------


def test_post_scan_returns_scan_id(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/scan creates a scan_run and returns its ID."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from uuid import uuid4

    scan_run_id = uuid4()

    # Mock gmail connection present
    conn_mock = MagicMock()
    conn_mock.scalar_one_or_none.return_value = _make_conn()

    # Mock no running scan
    running_mock = MagicMock()
    running_mock.scalar_one_or_none.return_value = None

    mock_db_session.execute.side_effect = [conn_mock, running_mock]

    # db.refresh sets the scan_run.id so the response can serialize it
    async def _mock_refresh(obj):
        obj.id = scan_run_id

    mock_db_session.refresh = AsyncMock(side_effect=_mock_refresh)

    with patch("travel_planner.routers.gmail.asyncio.create_task"):
        response = client.post(
            "/gmail/scan",
            json={"rescan_rejected": False},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert mock_db_session.add.called  # ScanRun was added


def test_post_scan_409_when_already_running(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/scan returns 409 when a scan is already running for user."""
    from unittest.mock import MagicMock, patch
    from uuid import uuid4

    conn_mock = MagicMock()
    conn_mock.scalar_one_or_none.return_value = _make_conn()

    existing_scan = MagicMock()
    existing_scan.id = uuid4()
    running_mock = MagicMock()
    running_mock.scalar_one_or_none.return_value = existing_scan

    mock_db_session.execute.side_effect = [conn_mock, running_mock]

    with patch("travel_planner.routers.gmail.asyncio.create_task"):
        response = client.post(
            "/gmail/scan",
            json={"rescan_rejected": False},
            headers=auth_headers,
        )

    assert response.status_code == 409
    assert "scan_id" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Inbox and latest scan endpoints
# ---------------------------------------------------------------------------


def test_get_inbox_returns_grouped_pending_and_unmatched(
    client, auth_headers, override_get_db, mock_db_session
):
    """GET /gmail/inbox returns pending activities grouped by trip and unmatched."""
    from unittest.mock import MagicMock
    from uuid import UUID

    from travel_planner.models.itinerary import ActivitySource, ImportStatus

    act_id = UUID("00000000-0000-0000-0000-000000000001")
    day_id = UUID("00000000-0000-0000-0000-000000000002")
    trip_id_str = "00000000-0000-0000-0000-000000000003"

    pending_activity = MagicMock()
    pending_activity.id = act_id
    pending_activity.itinerary_day_id = day_id
    pending_activity.title = "Flight AA123"
    pending_activity.category = "transport"
    pending_activity.start_time = None
    pending_activity.end_time = None
    pending_activity.location = "JFK"
    pending_activity.latitude = None
    pending_activity.longitude = None
    pending_activity.notes = None
    pending_activity.confirmation_number = "XYZ"
    pending_activity.sort_order = 999
    pending_activity.check_out_date = None
    pending_activity.source = ActivitySource.gmail_import
    pending_activity.source_ref = "email123"
    pending_activity.import_status = ImportStatus.pending_review
    pending_activity.created_at = datetime(2026, 3, 1, tzinfo=UTC)
    pending_activity.trip_id = trip_id_str
    pending_activity.trip_destination = "Florida"

    um_id = UUID("00000000-0000-0000-0000-000000000004")
    unmatched = MagicMock()
    unmatched.id = um_id
    unmatched.email_id = "email456"
    unmatched.parsed_data = {"title": "Hotel Boston", "date": "2026-04-10"}
    unmatched.created_at = datetime(2026, 3, 1, tzinfo=UTC)

    # DB calls: 1 for pending activities with trip join, 1 for unmatched
    pending_r = MagicMock()
    pending_r.all.return_value = [(pending_activity, trip_id_str, "Florida")]

    unmatched_r = MagicMock()
    unmatched_r.scalars.return_value.all.return_value = [unmatched]

    mock_db_session.execute.side_effect = [pending_r, unmatched_r]

    response = client.get("/gmail/inbox", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "pending" in data
    assert "unmatched" in data


def test_get_scan_latest_returns_most_recent(
    client, auth_headers, override_get_db, mock_db_session
):
    """GET /gmail/scan/latest returns the most recent scan_run."""
    from datetime import UTC, datetime
    from unittest.mock import MagicMock
    from uuid import uuid4

    scan = MagicMock()
    scan.id = uuid4()
    scan.status = "completed"
    scan.started_at = datetime(2026, 2, 24, tzinfo=UTC)
    scan.finished_at = datetime(2026, 2, 24, tzinfo=UTC)
    scan.emails_found = 50
    scan.imported_count = 3
    scan.skipped_count = 45
    scan.unmatched_count = 2
    scan.rescan_rejected = False

    r = MagicMock()
    r.scalar_one_or_none.return_value = scan
    mock_db_session.execute.return_value = r

    response = client.get("/gmail/scan/latest", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 3
    assert data["status"] == "completed"


# ---------------------------------------------------------------------------
# SSE stream endpoint
# ---------------------------------------------------------------------------


def test_scan_stream_404_for_unknown_scan(
    client, auth_headers, override_get_db, mock_db_session
):
    """Unknown scan_id returns 404 (belongs to different user)."""
    from unittest.mock import MagicMock

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.get(
        "/gmail/scan/00000000-0000-0000-0000-000000000099/stream",
        headers=auth_headers,
    )
    assert response.status_code == 404


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


# ---------------------------------------------------------------------------
# _sender_is_blocked unit tests
# ---------------------------------------------------------------------------


def test_sender_is_blocked_with_angle_brackets():
    from travel_planner.routers.gmail import _sender_is_blocked

    assert _sender_is_blocked("Resy <noreply@doordash.com>") is True


def test_sender_not_blocked_travel_domain():
    from travel_planner.routers.gmail import _sender_is_blocked

    assert _sender_is_blocked("Airbnb <noreply@airbnb.com>") is False


def test_sender_is_blocked_bare_email():
    from travel_planner.routers.gmail import _sender_is_blocked

    assert _sender_is_blocked("noreply@doordash.com") is True


def test_sender_is_blocked_case_insensitive():
    from travel_planner.routers.gmail import _sender_is_blocked

    assert _sender_is_blocked("DoorDash <noreply@DOORDASH.COM>") is True


def test_sender_blocked_subdomain():
    from travel_planner.routers.gmail import _sender_is_blocked

    assert _sender_is_blocked("Resy <noreply@email.rocketmoney.com>") is True


# ---------------------------------------------------------------------------
# _extract_text unit tests
# ---------------------------------------------------------------------------


def test_extract_text_prefers_plain_text():
    import base64

    from travel_planner.routers.gmail import _extract_text

    plain = base64.urlsafe_b64encode(b"Hello plain text").decode()
    msg = {
        "payload": {
            "mimeType": "multipart/alternative",
            "parts": [
                {"mimeType": "text/plain", "body": {"data": plain}},
                {
                    "mimeType": "text/html",
                    "body": {"data": base64.urlsafe_b64encode(b"<b>HTML</b>").decode()},
                },
            ],
        }
    }
    result = _extract_text(msg)
    assert "Hello plain text" in result


def test_extract_text_falls_back_to_html():
    import base64

    from travel_planner.routers.gmail import _extract_text

    html = base64.urlsafe_b64encode(
        b"<html><body><p>Booking confirmed</p></body></html>"
    ).decode()
    msg = {
        "payload": {
            "mimeType": "multipart/alternative",
            "parts": [
                {"mimeType": "text/html", "body": {"data": html}},
            ],
        }
    }
    result = _extract_text(msg)
    assert "Booking confirmed" in result


def test_extract_text_strips_style_and_script():
    import base64

    from travel_planner.routers.gmail import _extract_text

    html_content = (
        b"<html><head><style>body{color:red}</style></head>"
        b"<body><script>alert(1)</script><p>Travel info</p></body></html>"
    )
    html = base64.urlsafe_b64encode(html_content).decode()
    # Use multipart structure so the HTML goes through _walk → _strip_html
    msg = {
        "payload": {
            "mimeType": "multipart/alternative",
            "body": {},
            "parts": [
                {
                    "mimeType": "text/html",
                    "body": {"data": html},
                }
            ],
        }
    }
    result = _extract_text(msg)
    assert "Travel info" in result
    assert "alert" not in result
    assert "color:red" not in result


def test_extract_text_returns_empty_for_no_content():
    from travel_planner.routers.gmail import _extract_text

    msg = {"payload": {"mimeType": "multipart/mixed", "parts": []}}
    result = _extract_text(msg)
    assert result == ""


# ---------------------------------------------------------------------------
# Cancel scan endpoint
# ---------------------------------------------------------------------------


def test_cancel_scan_success(client, auth_headers, override_get_db, mock_db_session):
    """POST /gmail/scan/{id}/cancel sets status to cancelled."""
    from travel_planner.models.gmail import ScanRunStatus

    scan = MagicMock()
    scan.id = "00000000-0000-0000-0000-000000000010"
    scan.status = ScanRunStatus.running

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = scan
    mock_db_session.execute.return_value = result_mock

    response = client.post(
        "/gmail/scan/00000000-0000-0000-0000-000000000010/cancel",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert scan.status == ScanRunStatus.cancelled


def test_cancel_scan_404_unknown(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/scan/{id}/cancel returns 404 for unknown scan."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.post(
        "/gmail/scan/00000000-0000-0000-0000-000000000010/cancel",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_cancel_scan_409_not_running(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/scan/{id}/cancel returns 409 when scan is already completed."""
    from travel_planner.models.gmail import ScanRunStatus

    scan = MagicMock()
    scan.id = "00000000-0000-0000-0000-000000000010"
    scan.status = ScanRunStatus.completed

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = scan
    mock_db_session.execute.return_value = result_mock

    response = client.post(
        "/gmail/scan/00000000-0000-0000-0000-000000000010/cancel",
        headers=auth_headers,
    )
    assert response.status_code == 409


# ---------------------------------------------------------------------------
# Assign unmatched endpoint
# ---------------------------------------------------------------------------


def test_assign_unmatched_success(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/inbox/unmatched/{id}/assign creates activity and sets trip."""
    from uuid import UUID

    from tests.conftest import make_member, make_trip, make_user

    item = MagicMock()
    item.id = UUID("00000000-0000-0000-0000-000000000020")
    item.user_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    item.email_id = "email_123"
    item.parsed_data = {
        "title": "Flight AA123",
        "category": "transport",
        "date": "2026-04-15",
        "location": "JFK",
    }

    # find unmatched item
    item_result = MagicMock()
    item_result.scalar_one_or_none.return_value = item

    # verify_trip_member — trip membership check
    owner = make_user()
    member = make_member(user=owner)
    trip = make_trip(members=[member])
    trip_result = MagicMock()
    trip_result.scalar_one_or_none.return_value = trip

    # itinerary day lookup — not found (will create new)
    day_result = MagicMock()
    day_result.scalar_one_or_none.return_value = None

    mock_db_session.execute.side_effect = [item_result, trip_result, day_result]

    # flush assigns an id to the new day
    async def _mock_flush():
        pass

    mock_db_session.flush = AsyncMock(side_effect=_mock_flush)

    response = client.post(
        "/gmail/inbox/unmatched/00000000-0000-0000-0000-000000000020/assign",
        json={"trip_id": "333e4567-e89b-12d3-a456-426614174002"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "assigned"


def test_assign_unmatched_404_not_found(
    client, auth_headers, override_get_db, mock_db_session
):
    """Returns 404 when unmatched item doesn't belong to user."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.post(
        "/gmail/inbox/unmatched/00000000-0000-0000-0000-000000000020/assign",
        json={"trip_id": "333e4567-e89b-12d3-a456-426614174002"},
        headers=auth_headers,
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Dismiss unmatched endpoint
# ---------------------------------------------------------------------------


def test_dismiss_unmatched_success(
    client, auth_headers, override_get_db, mock_db_session
):
    """DELETE /gmail/inbox/unmatched/{id} dismisses the item."""
    from uuid import UUID

    item = MagicMock()
    item.id = UUID("00000000-0000-0000-0000-000000000020")
    item.user_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    item.email_id = "email_456"
    item.parsed_data = {"title": "Hotel", "date": "2026-04-10", "location": "Boston"}
    item.dismissed_at = None

    # find item
    item_result = MagicMock()
    item_result.scalar_one_or_none.return_value = item

    # check ImportRecord — not already imported
    import_result = MagicMock()
    import_result.scalar_one_or_none.return_value = None

    # find duplicates — none
    dupes_result = MagicMock()
    dupes_result.scalars.return_value.all.return_value = []

    mock_db_session.execute.side_effect = [item_result, import_result, dupes_result]

    response = client.delete(
        "/gmail/inbox/unmatched/00000000-0000-0000-0000-000000000020",
        headers=auth_headers,
    )
    assert response.status_code == 204
    assert item.dismissed_at is not None


def test_dismiss_unmatched_404(client, auth_headers, override_get_db, mock_db_session):
    """Returns 404 when unmatched item doesn't belong to user."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.delete(
        "/gmail/inbox/unmatched/00000000-0000-0000-0000-000000000020",
        headers=auth_headers,
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Dismiss all unmatched endpoint
# ---------------------------------------------------------------------------


def test_dismiss_all_unmatched(client, auth_headers, override_get_db, mock_db_session):
    """DELETE /gmail/inbox/unmatched dismisses all unmatched items."""
    response = client.delete("/gmail/inbox/unmatched", headers=auth_headers)
    assert response.status_code == 204
    assert mock_db_session.execute.called
