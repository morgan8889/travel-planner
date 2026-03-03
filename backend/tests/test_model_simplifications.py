"""Tests that pin the desired simplified model structure.

These are RED tests: they fail until the simplifications are implemented.
"""


# ---------------------------------------------------------------------------
# models.base — Base, UUIDMixin, TimestampMixin live here
# ---------------------------------------------------------------------------


def test_base_importable_from_models_base():
    from travel_planner.models.base import Base  # noqa: F401


def test_uuid_mixin_importable_from_models_base():
    from travel_planner.models.base import UUIDMixin  # noqa: F401


def test_timestamp_mixin_importable_from_models_base():
    from travel_planner.models.base import TimestampMixin  # noqa: F401


def test_base_still_importable_from_models():
    """Existing import path must remain valid."""
    from travel_planner.models import Base  # noqa: F401


# ---------------------------------------------------------------------------
# All enums exported from travel_planner.models
# ---------------------------------------------------------------------------


def test_all_enums_exported_from_models():
    from travel_planner.models import (  # noqa: F401
        ActivityCategory,
        ActivitySource,
        ImportStatus,
        MemberRole,
        TripStatus,
        TripType,
    )

    assert TripType.vacation == "vacation"
    assert TripStatus.dreaming == "dreaming"
    assert MemberRole.owner == "owner"
    assert ActivityCategory.transport == "transport"
    assert ActivitySource.manual == "manual"
    assert ImportStatus.pending_review == "pending_review"
