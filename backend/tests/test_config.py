import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError


VALID_ENV = {
    "SUPABASE_URL": "https://test.supabase.co",
    "DATABASE_URL": "postgresql+asyncpg://localhost:5432/test",
    "TOKEN_ENCRYPTION_KEY": "test-key-abc",
}


def test_settings_rejects_empty_supabase_url():
    """Settings should raise ValidationError if SUPABASE_URL is empty."""
    env = {**VALID_ENV, "SUPABASE_URL": ""}
    with patch.dict(os.environ, env, clear=False):
        from travel_planner.config import Settings

        with pytest.raises(ValidationError, match="SUPABASE_URL"):
            Settings()


def test_settings_accepts_valid_env():
    """Settings should not raise when all required env vars are provided."""
    with patch.dict(os.environ, VALID_ENV):
        from travel_planner.config import Settings

        s = Settings()
        assert s.supabase_url == "https://test.supabase.co"
