import os

# CRITICAL: Set test environment variables BEFORE any other imports
# This must be done before importing anything from travel_planner
os.environ["SUPABASE_URL"] = "http://test.supabase.co"

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

import jwt
import pytest
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.db import get_db
from travel_planner.main import app

# Generate RSA key pair for RS256 test tokens
_test_private_key = rsa.generate_private_key(
    public_exponent=65537, key_size=2048, backend=default_backend()
)
_test_public_key = _test_private_key.public_key()


def create_test_token(user_id: str, email: str, expired: bool = False) -> str:
    """Create a test JWT token using RS256 (matching production)."""
    exp = datetime.now(UTC) + (timedelta(hours=-1) if expired else timedelta(hours=1))
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "iss": f"{os.environ['SUPABASE_URL']}/auth/v1",
        "exp": exp,
    }
    return jwt.encode(payload, _test_private_key, algorithm="RS256")


@pytest.fixture(autouse=True)
def mock_jwks_client():
    """Mock the PyJWKClient to avoid network calls in tests.

    This fixture automatically patches the JWKS client for all tests,
    returning our test RSA public key for RS256 token verification.
    """
    with patch("travel_planner.auth.jwks_client") as mock_client:
        # Create a mock signing key that returns our test public key
        mock_signing_key = Mock()
        mock_signing_key.key = _test_public_key
        mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
        yield mock_client


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Create authorization headers with a valid test token."""
    test_user_id = "123e4567-e89b-12d3-a456-426614174000"
    test_email = "test@example.com"
    token = create_test_token(test_user_id, test_email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def override_get_db(mock_db_session: AsyncSession):
    """Override the get_db dependency with mock database."""

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield mock_db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def itinerary_day_id() -> str:
    """Return itinerary day ID as string."""
    return "555e4567-e89b-12d3-a456-426614174004"


@pytest.fixture
def activity_id() -> str:
    """Return activity ID as string."""
    return "999e4567-e89b-12d3-a456-426614174008"


@pytest.fixture
def checklist_id() -> str:
    """Return checklist ID as string."""
    return "777e4567-e89b-12d3-a456-426614174006"


@pytest.fixture
def item_id() -> str:
    """Return checklist item ID as string."""
    return "666e4567-e89b-12d3-a456-426614174005"
