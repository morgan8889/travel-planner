from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_test_token
from travel_planner.main import app
from travel_planner.models.user import UserProfile


@pytest.fixture
def client():
    return TestClient(app)


def test_unauthenticated_returns_401(client: TestClient, override_get_db):
    """Test that requests without Authorization header return 401."""
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_invalid_token_returns_401(client: TestClient, override_get_db):
    """Test that requests with malformed JWT return 401."""
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401


def test_expired_token_returns_401(client: TestClient, override_get_db):
    """Test that requests with expired JWT return 401."""
    test_user_id = "123e4567-e89b-12d3-a456-426614174000"
    test_email = "test@example.com"
    expired_token = create_test_token(test_user_id, test_email, expired=True)
    response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401


def test_get_profile_not_found(
    client: TestClient, auth_headers: dict[str, str], override_get_db, mock_db_session
):
    """Test that GET /auth/me returns 404 when profile doesn't exist."""
    # Mock the database to return None (no profile found)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"


def test_create_profile(
    client: TestClient, auth_headers: dict[str, str], override_get_db, mock_db_session
):
    """Test that POST /auth/profile creates a new profile."""
    # Create a mock profile to return
    test_user_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    mock_profile = UserProfile(
        id=test_user_id,
        email="test@example.com",
        display_name="Test User",
        preferences={"theme": "dark", "language": "en"},
        created_at=datetime.now(),
    )

    # Mock the database insert to return the profile
    result_mock = MagicMock()
    result_mock.scalar_one.return_value = mock_profile
    mock_db_session.execute.return_value = result_mock

    profile_data = {
        "display_name": "Test User",
        "preferences": {"theme": "dark", "language": "en"},
    }
    response = client.post("/auth/profile", json=profile_data, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Test User"
    assert data["email"] == "test@example.com"
    assert data["preferences"] == {"theme": "dark", "language": "en"}
    assert "id" in data
    assert "created_at" in data


def test_get_profile_after_create(
    client: TestClient, auth_headers: dict[str, str], override_get_db, mock_db_session
):
    """Test that GET /auth/me returns created profile."""
    test_user_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    mock_profile = UserProfile(
        id=test_user_id,
        email="test@example.com",
        display_name="Test User",
        preferences={},
        created_at=datetime.now(),
    )

    # Mock the database to return the profile
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = mock_profile
    mock_db_session.execute.return_value = result_mock

    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Test User"
    assert data["email"] == "test@example.com"


def test_update_profile_upsert(
    client: TestClient, auth_headers: dict[str, str], override_get_db, mock_db_session
):
    """Test that second POST /auth/profile updates existing profile."""
    test_user_id = UUID("123e4567-e89b-12d3-a456-426614174000")

    # First create returns initial profile
    initial_profile = UserProfile(
        id=test_user_id,
        email="test@example.com",
        display_name="Initial Name",
        preferences={"key": "value1"},
        created_at=datetime.now(),
    )

    result_mock1 = MagicMock()
    result_mock1.scalar_one.return_value = initial_profile
    mock_db_session.execute.return_value = result_mock1

    initial_data = {"display_name": "Initial Name", "preferences": {"key": "value1"}}
    response1 = client.post("/auth/profile", json=initial_data, headers=auth_headers)
    assert response1.status_code == 200
    profile_id = response1.json()["id"]

    # Update returns updated profile
    updated_profile = UserProfile(
        id=test_user_id,
        email="test@example.com",
        display_name="Updated Name",
        preferences={"key": "value2", "new_key": "new_value"},
        created_at=datetime.now(),
    )

    result_mock2 = MagicMock()
    result_mock2.scalar_one.return_value = updated_profile
    mock_db_session.execute.return_value = result_mock2

    updated_data = {
        "display_name": "Updated Name",
        "preferences": {"key": "value2", "new_key": "new_value"},
    }
    response2 = client.post("/auth/profile", json=updated_data, headers=auth_headers)
    assert response2.status_code == 200
    data = response2.json()
    assert data["id"] == profile_id  # Same ID
    assert data["display_name"] == "Updated Name"
    assert data["preferences"] == {"key": "value2", "new_key": "new_value"}


def test_create_profile_validation(
    client: TestClient, auth_headers: dict[str, str], override_get_db
):
    """Test that invalid profile data returns 422."""
    # Empty display_name
    invalid_data = {"display_name": "", "preferences": {}}
    response = client.post("/auth/profile", json=invalid_data, headers=auth_headers)
    assert response.status_code == 422

    # Missing display_name
    invalid_data2 = {"preferences": {}}
    response2 = client.post("/auth/profile", json=invalid_data2, headers=auth_headers)
    assert response2.status_code == 422

    # display_name too long (> 100 chars)
    invalid_data3 = {"display_name": "x" * 101, "preferences": {}}
    response3 = client.post("/auth/profile", json=invalid_data3, headers=auth_headers)
    assert response3.status_code == 422


def test_delete_account_requires_auth(client: TestClient):
    """DELETE /auth/me returns 401 without auth headers."""
    response = client.delete("/auth/me")
    assert response.status_code == 401


def test_delete_account_no_service_key(
    client: TestClient, auth_headers: dict[str, str], override_get_db, mock_db_session
):
    """DELETE /auth/me returns 503 when service role key is not configured."""
    with patch("travel_planner.routers.auth.settings") as mock_settings:
        mock_settings.supabase_service_role_key = ""

        response = client.delete("/auth/me", headers=auth_headers)

    assert response.status_code == 503
    assert not mock_db_session.commit.called


def test_delete_account_calls_supabase_admin_when_key_set(
    client: TestClient, auth_headers: dict[str, str], override_get_db, mock_db_session
):
    """DELETE /auth/me calls Supabase Admin API when service role key is configured."""
    owned_trips_mock = MagicMock()
    owned_trips_mock.all.return_value = []
    mock_db_session.execute.side_effect = [
        owned_trips_mock,
        MagicMock(),  # delete TripMembers
        MagicMock(),  # delete GmailConnections
        MagicMock(),  # delete ImportRecords
        MagicMock(),  # delete HolidayCalendars
        MagicMock(),  # delete CustomDays
        MagicMock(),  # delete UserProfile
    ]

    with patch("travel_planner.routers.auth.settings") as mock_settings:
        mock_settings.supabase_service_role_key = "test-service-key"
        mock_settings.supabase_url = "http://test.supabase.co"

        with patch("travel_planner.routers.auth.httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.delete = AsyncMock(return_value=MagicMock(status_code=204))

            response = client.delete("/auth/me", headers=auth_headers)

    assert response.status_code == 204
    mock_http.delete.assert_called_once()
