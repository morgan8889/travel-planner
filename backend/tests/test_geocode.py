"""Tests for geocode proxy endpoint."""

import os

os.environ["SUPABASE_URL"] = "http://test.supabase.co"

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from travel_planner.main import app
from travel_planner.auth import CurrentUserId

from fastapi.testclient import TestClient

TEST_USER_ID = "123e4567-e89b-12d3-a456-426614174000"


@pytest.fixture
def client():
    app.dependency_overrides[CurrentUserId] = lambda: TEST_USER_ID
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_geocode_search_returns_empty_when_no_token(client):
    """Returns empty list when MAPBOX_ACCESS_TOKEN is not configured."""
    with patch("travel_planner.routers.geocode.settings") as mock_settings:
        mock_settings.mapbox_access_token = ""
        response = client.get("/api/geocode/search?q=Paris")
    assert response.status_code == 200
    assert response.json() == []


def test_geocode_search_requires_auth():
    """Returns non-200 without auth (422 missing header or 401 invalid token)."""
    with TestClient(app) as c:
        response = c.get("/api/geocode/search?q=Paris")
    assert response.status_code in (401, 422)


def test_geocode_search_proxies_to_mapbox(client):
    """Parses Mapbox response and returns GeocodeSuggestion list."""
    mapbox_response = {
        "features": [
            {
                "place_name": "Paris, France",
                "place_type": ["place"],
                "geometry": {"coordinates": [2.3522, 48.8566]},
                "context": [{"text": "Ile-de-France"}, {"text": "France"}],
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.json.return_value = mapbox_response
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("travel_planner.routers.geocode.settings") as mock_settings, \
         patch("travel_planner.routers.geocode.httpx.AsyncClient", return_value=mock_client):
        mock_settings.mapbox_access_token = "pk.test_token"
        response = client.get("/api/geocode/search?q=Paris")

    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["place_name"] == "Paris, France"
    assert results[0]["latitude"] == 48.8566
    assert results[0]["longitude"] == 2.3522
    assert results[0]["place_type"] == "place"
    assert results[0]["context"] == "Ile-de-France, France"


def test_geocode_search_skips_features_without_coordinates(client):
    """Skips features with missing geometry coordinates."""
    mapbox_response = {
        "features": [
            {
                "place_name": "Incomplete Place",
                "place_type": ["place"],
                "geometry": {"coordinates": []},
                "context": [],
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.json.return_value = mapbox_response
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("travel_planner.routers.geocode.settings") as mock_settings, \
         patch("travel_planner.routers.geocode.httpx.AsyncClient", return_value=mock_client):
        mock_settings.mapbox_access_token = "pk.test_token"
        response = client.get("/api/geocode/search?q=Incomplete")

    assert response.status_code == 200
    assert response.json() == []
