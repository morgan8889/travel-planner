import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError


def test_settings_rejects_empty_supabase_url():
    """Settings should raise ValidationError if SUPABASE_URL is empty."""
    with patch.dict(os.environ, {"SUPABASE_URL": ""}, clear=False):
        from travel_planner.config import Settings

        with pytest.raises(ValidationError, match="supabase_url"):
            Settings()


def test_settings_accepts_valid_supabase_url():
    """Settings should not raise when SUPABASE_URL is provided."""
    with patch.dict(os.environ, {"SUPABASE_URL": "https://test.supabase.co"}):
        from travel_planner.config import Settings

        s = Settings()
        assert s.supabase_url == "https://test.supabase.co"
