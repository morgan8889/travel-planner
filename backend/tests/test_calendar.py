from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from pydantic import ValidationError

from travel_planner.models.calendar import AnnualPlan, BlockType, CalendarBlock
from travel_planner.models.trip import Trip, TripMember
from travel_planner.schemas.calendar import (
    AnnualPlanCreate,
    AnnualPlanResponse,
    CalendarBlockCreate,
    CalendarBlockResponse,
    CalendarBlockUpdate,
    CalendarYearResponse,
)
from tests.conftest import (
    TEST_USER_ID,
    TRIP_ID,
    make_trip,
    make_member,
    make_user,
    create_test_token,
    OTHER_USER_ID,
    OTHER_USER_EMAIL,
)

PLAN_ID = UUID("aaa14567-e89b-12d3-a456-426614174010")
BLOCK_ID = UUID("bbb24567-e89b-12d3-a456-426614174011")


# --- Schema Tests ---

def test_annual_plan_create_valid():
    plan = AnnualPlanCreate(year=2026, notes="My travel year")
    assert plan.year == 2026
    assert plan.notes == "My travel year"


def test_annual_plan_create_no_notes():
    plan = AnnualPlanCreate(year=2026)
    assert plan.notes is None


def test_calendar_block_create_valid():
    block = CalendarBlockCreate(
        type="pto",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        destination="Beach",
        notes="Summer break",
    )
    assert block.type == "pto"
    assert block.start_date == date(2026, 7, 1)
    assert block.end_date == date(2026, 7, 5)


def test_calendar_block_create_end_before_start():
    with pytest.raises(ValidationError, match="end_date must be on or after start_date"):
        CalendarBlockCreate(
            type="pto",
            start_date=date(2026, 7, 5),
            end_date=date(2026, 7, 1),
        )


def test_calendar_block_update_partial():
    update = CalendarBlockUpdate(notes="Updated notes")
    data = update.model_dump(exclude_unset=True)
    assert data == {"notes": "Updated notes"}


# --- API Tests ---

def test_create_annual_plan(
    client, auth_headers, override_get_db, mock_db_session
):
    """Create annual plan for a year"""
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(return_value=result_mock1)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    async def mock_refresh(obj):
        obj.id = PLAN_ID
        from datetime import datetime, UTC
        obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        "/calendar/plans",
        headers=auth_headers,
        json={"year": 2026, "notes": "Big travel year"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["year"] == 2026
    assert data["notes"] == "Big travel year"
    assert data["user_id"] == str(TEST_USER_ID)


def test_create_annual_plan_duplicate(
    client, auth_headers, override_get_db, mock_db_session
):
    """Cannot create duplicate plan for same user+year"""
    existing_plan = MagicMock(spec=AnnualPlan)
    existing_plan.id = PLAN_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = existing_plan

    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.post(
        "/calendar/plans",
        headers=auth_headers,
        json={"year": 2026},
    )
    assert response.status_code == 409


def test_get_annual_plan_year(
    client, auth_headers, override_get_db, mock_db_session
):
    """Get annual plan with blocks and trips for a year"""
    from datetime import datetime, UTC

    plan = MagicMock(spec=AnnualPlan)
    plan.id = PLAN_ID
    plan.user_id = TEST_USER_ID
    plan.year = 2026
    plan.notes = None
    plan.created_at = datetime(2026, 1, 1, tzinfo=UTC)

    block = MagicMock(spec=CalendarBlock)
    block.id = BLOCK_ID
    block.annual_plan_id = PLAN_ID
    block.type = BlockType.pto
    block.start_date = date(2026, 7, 1)
    block.end_date = date(2026, 7, 5)
    block.destination = None
    block.notes = "Summer PTO"

    trip = MagicMock(spec=Trip)
    trip.id = TRIP_ID
    trip.type = "vacation"
    trip.destination = "Paris"
    trip.start_date = date(2026, 8, 10)
    trip.end_date = date(2026, 8, 20)
    trip.status = "booked"

    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = plan

    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [block]

    result_mock3 = MagicMock()
    result_mock3.scalars.return_value.all.return_value = [trip]

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2, result_mock3]
    )

    response = client.get("/calendar/plans/2026", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["plan"]["year"] == 2026
    assert len(data["blocks"]) == 1
    assert data["blocks"][0]["type"] == "pto"
    assert len(data["trips"]) == 1
    assert data["trips"][0]["destination"] == "Paris"


def test_get_annual_plan_year_no_plan(
    client, auth_headers, override_get_db, mock_db_session
):
    """Get year with no plan returns null plan, empty blocks, but still trips"""
    trip = MagicMock(spec=Trip)
    trip.id = TRIP_ID
    trip.type = "vacation"
    trip.destination = "Tokyo"
    trip.start_date = date(2026, 3, 1)
    trip.end_date = date(2026, 3, 10)
    trip.status = "planning"

    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = None

    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [trip]

    mock_db_session.execute = AsyncMock(
        side_effect=[result_mock1, result_mock2]
    )

    response = client.get("/calendar/plans/2026", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["plan"] is None
    assert data["blocks"] == []
    assert len(data["trips"]) == 1
    assert data["trips"][0]["destination"] == "Tokyo"
