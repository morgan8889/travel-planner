from datetime import datetime, timezone

import pytest

from travel_planner.models.itinerary import ActivitySource, ImportStatus
from travel_planner.schemas.itinerary import ActivityResponse


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


def test_gmail_status_not_connected(client, auth_headers, override_get_db, mock_db_session):
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


def test_gmail_disconnect_when_not_connected(client, auth_headers, override_get_db, mock_db_session):
    from unittest.mock import MagicMock

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.delete("/gmail/disconnect", headers=auth_headers)
    assert response.status_code == 404
