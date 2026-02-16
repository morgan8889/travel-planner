import os

# CRITICAL: Set test JWT secret BEFORE any other imports
# This must be done before importing anything from travel_planner
os.environ["SUPABASE_JWT_SECRET"] = "test-secret-key-minimum-32-characters-long"

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import jwt
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.db import get_db
from travel_planner.main import app


def create_test_token(user_id: str, email: str, expired: bool = False) -> str:
    """Create a test JWT token."""
    exp = datetime.now(UTC) + (
        timedelta(hours=-1) if expired else timedelta(hours=1)
    )
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "exp": exp,
    }
    return jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


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
def override_get_db(mock_db_session: AsyncSession):
    """Override the get_db dependency with mock database."""

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield mock_db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()
