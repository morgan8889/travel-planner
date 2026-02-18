# Phase 4: Annual Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement annual calendar API and frontend UI so users can view their entire year of trips, PTO, and holidays on a 12-month grid, and create/edit/delete calendar blocks.

**Architecture:** The calendar is per-user (not per-trip). The backend provides CRUD for annual plans and calendar blocks, plus a year-view endpoint that joins the user's trips for that year. The frontend renders a 12-month grid with colored blocks and a modal for creating/editing blocks. Models already exist (`AnnualPlan`, `CalendarBlock` in `backend/src/travel_planner/models/calendar.py`); this phase adds schemas, router, migration, and frontend.

**Tech Stack:** FastAPI router, Pydantic schemas, SQLAlchemy async queries, Alembic migration, React + TanStack Router, TanStack Query hooks, Tailwind CSS v4, Vitest/pytest

**Base branch:** `feature/phase3-itinerary-checklists`

---

## Task 1: Alembic Migration for Calendar Tables

**Files:**
- Create: `backend/alembic/versions/004_add_calendar.py`

**Step 1: Write the migration**

Create `backend/alembic/versions/004_add_calendar.py`:

```python
"""Add annual_plans and calendar_blocks tables

Revision ID: 004_add_calendar
Revises: 003_add_itinerary
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision = "004_add_calendar"
down_revision = "003_add_itinerary"
branch_labels = None
depends_on = None

blocktype_enum = ENUM("pto", "holiday", name="blocktype", create_type=False)


def upgrade() -> None:
    blocktype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "annual_plans",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "year", name="uq_annual_plan"),
    )

    op.create_table(
        "calendar_blocks",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "annual_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("annual_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", blocktype_enum, nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("destination", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("calendar_blocks")
    op.drop_table("annual_plans")
    blocktype_enum.drop(op.get_bind(), checkfirst=True)
```

**Step 2: Verify migration file parses**

Run: `cd backend && python -c "import alembic.versions" 2>&1 || echo "OK - alembic versions is not a package, that's expected"`

Verify the file exists and has correct syntax:

Run: `cd backend && python -c "import ast; ast.parse(open('alembic/versions/004_add_calendar.py').read()); print('Syntax OK')"`

**Step 3: Commit**

```bash
git add backend/alembic/versions/004_add_calendar.py
git commit -m "feat: add alembic migration for annual_plans and calendar_blocks tables"
```

---

## Task 2: Calendar Pydantic Schemas

**Files:**
- Create: `backend/src/travel_planner/schemas/calendar.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_calendar.py`:

```python
from datetime import date

import pytest
from pydantic import ValidationError

from travel_planner.schemas.calendar import (
    AnnualPlanCreate,
    AnnualPlanResponse,
    CalendarBlockCreate,
    CalendarBlockResponse,
    CalendarBlockUpdate,
    CalendarYearResponse,
)


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
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_calendar.py::test_annual_plan_create_valid -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'travel_planner.schemas.calendar'`

**Step 3: Write the schemas**

Create `backend/src/travel_planner/schemas/calendar.py`:

```python
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from travel_planner.models.calendar import BlockType


class AnnualPlanCreate(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    notes: str | None = Field(default=None, max_length=5000)


class AnnualPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    year: int
    notes: str | None
    created_at: datetime


class CalendarBlockCreate(BaseModel):
    type: BlockType
    start_date: date
    end_date: date
    destination: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self) -> "CalendarBlockCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class CalendarBlockUpdate(BaseModel):
    type: BlockType | None = None
    start_date: date | None = None
    end_date: date | None = None
    destination: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self) -> "CalendarBlockUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date must be on or after start_date")
        return self


class CalendarBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    annual_plan_id: uuid.UUID
    type: BlockType
    start_date: date
    end_date: date
    destination: str | None
    notes: str | None


class TripSummaryForCalendar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    destination: str
    start_date: date
    end_date: date
    status: str


class CalendarYearResponse(BaseModel):
    plan: AnnualPlanResponse | None
    blocks: list[CalendarBlockResponse]
    trips: list[TripSummaryForCalendar]
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_calendar.py -v`

Expected: 5 PASSED

**Step 5: Commit**

```bash
git add backend/src/travel_planner/schemas/calendar.py backend/tests/test_calendar.py
git commit -m "feat: add Pydantic schemas for annual plans and calendar blocks"
```

---

## Task 3: Calendar API - Create & Get Annual Plan

**Files:**
- Create: `backend/src/travel_planner/routers/calendar.py`
- Modify: `backend/src/travel_planner/main.py` (add router import + include)
- Test: `backend/tests/test_calendar.py` (append)

**Step 1: Write the failing tests**

Append to `backend/tests/test_calendar.py`:

```python
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

from travel_planner.models.calendar import AnnualPlan, BlockType, CalendarBlock
from travel_planner.models.trip import Trip, TripMember
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


def test_create_annual_plan(
    client, auth_headers, override_get_db, mock_db_session
):
    """Create annual plan for a year"""
    # First call: check no existing plan for this user+year
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
    from datetime import date, datetime, UTC

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

    # First call: get plan
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = plan

    # Second call: get blocks
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [block]

    # Third call: get trips for year
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
    from datetime import date

    trip = MagicMock(spec=Trip)
    trip.id = TRIP_ID
    trip.type = "vacation"
    trip.destination = "Tokyo"
    trip.start_date = date(2026, 3, 1)
    trip.end_date = date(2026, 3, 10)
    trip.status = "planning"

    # First call: no plan
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = None

    # Second call: trips for year
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
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_calendar.py::test_create_annual_plan -v`

Expected: FAIL with import error (router doesn't exist yet)

**Step 3: Implement the calendar router**

Create `backend/src/travel_planner/routers/calendar.py`:

```python
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.db import get_db
from travel_planner.models.calendar import AnnualPlan, CalendarBlock
from travel_planner.models.trip import Trip, TripMember
from travel_planner.schemas.calendar import (
    AnnualPlanCreate,
    AnnualPlanResponse,
    CalendarBlockCreate,
    CalendarBlockResponse,
    CalendarBlockUpdate,
    CalendarYearResponse,
    TripSummaryForCalendar,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.post("/plans", response_model=AnnualPlanResponse, status_code=201)
async def create_annual_plan(
    plan_data: AnnualPlanCreate,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Create an annual plan for a year. One plan per user per year."""
    # Check for existing plan
    result = await db.execute(
        select(AnnualPlan)
        .where(AnnualPlan.user_id == user_id)
        .where(AnnualPlan.year == plan_data.year)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Annual plan already exists for this year")

    plan = AnnualPlan(
        user_id=user_id,
        year=plan_data.year,
        notes=plan_data.notes,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    return AnnualPlanResponse.model_validate(plan)


@router.get("/plans/{year}", response_model=CalendarYearResponse)
async def get_annual_plan(
    year: int,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Get annual plan with blocks and trips for a given year."""
    # Get plan for this user+year
    result = await db.execute(
        select(AnnualPlan)
        .where(AnnualPlan.user_id == user_id)
        .where(AnnualPlan.year == year)
    )
    plan = result.scalar_one_or_none()

    # Get blocks if plan exists
    blocks = []
    if plan:
        blocks_result = await db.execute(
            select(CalendarBlock)
            .where(CalendarBlock.annual_plan_id == plan.id)
            .order_by(CalendarBlock.start_date)
        )
        blocks = blocks_result.scalars().all()

    # Get user's trips overlapping this year
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    trips_result = await db.execute(
        select(Trip)
        .join(TripMember)
        .where(TripMember.user_id == user_id)
        .where(Trip.start_date <= year_end)
        .where(Trip.end_date >= year_start)
        .order_by(Trip.start_date)
    )
    trips = trips_result.scalars().all()

    return CalendarYearResponse(
        plan=AnnualPlanResponse.model_validate(plan) if plan else None,
        blocks=[CalendarBlockResponse.model_validate(b) for b in blocks],
        trips=[TripSummaryForCalendar.model_validate(t) for t in trips],
    )
```

**Step 4: Register the router in main.py**

In `backend/src/travel_planner/main.py`, add the import and include:

```python
from travel_planner.routers.calendar import router as calendar_router
```

Add after the existing `app.include_router(trips_router)` line:

```python
app.include_router(calendar_router)
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_calendar.py -v`

Expected: All tests PASSED (schema tests + API tests)

**Step 6: Commit**

```bash
git add backend/src/travel_planner/routers/calendar.py backend/src/travel_planner/main.py backend/tests/test_calendar.py
git commit -m "feat: add calendar router with create/get annual plan endpoints

- POST /calendar/plans creates annual plan (one per user per year)
- GET /calendar/plans/{year} returns plan + blocks + user trips for year"
```

---

## Task 4: Calendar API - Calendar Block CRUD

**Files:**
- Modify: `backend/src/travel_planner/routers/calendar.py` (add 3 endpoints)
- Test: `backend/tests/test_calendar.py` (append)

**Step 1: Write the failing tests**

Append to `backend/tests/test_calendar.py`:

```python
def test_create_calendar_block(
    client, auth_headers, override_get_db, mock_db_session
):
    """Create a calendar block on an existing plan"""
    from datetime import date

    plan = MagicMock(spec=AnnualPlan)
    plan.id = PLAN_ID
    plan.user_id = TEST_USER_ID

    # First call: get plan by ID
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = plan

    mock_db_session.execute = AsyncMock(return_value=result_mock1)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    async def mock_refresh(obj):
        obj.id = BLOCK_ID

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        "/calendar/blocks",
        headers=auth_headers,
        json={
            "annual_plan_id": str(PLAN_ID),
            "type": "pto",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "destination": "Beach",
            "notes": "Summer break",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "pto"
    assert data["destination"] == "Beach"


def test_create_calendar_block_not_owner(
    client, override_get_db, mock_db_session
):
    """Cannot create block on another user's plan"""
    plan = MagicMock(spec=AnnualPlan)
    plan.id = PLAN_ID
    plan.user_id = OTHER_USER_ID  # Different user owns this plan

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = plan

    mock_db_session.execute = AsyncMock(return_value=result_mock)

    # Use auth headers for TEST_USER_ID
    token = create_test_token(str(TEST_USER_ID), "test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/calendar/blocks",
        headers=headers,
        json={
            "annual_plan_id": str(PLAN_ID),
            "type": "holiday",
            "start_date": "2026-12-25",
            "end_date": "2026-12-25",
        },
    )
    assert response.status_code == 403


def test_update_calendar_block(
    client, auth_headers, override_get_db, mock_db_session
):
    """Update a calendar block"""
    from datetime import date

    plan = MagicMock(spec=AnnualPlan)
    plan.id = PLAN_ID
    plan.user_id = TEST_USER_ID

    block = MagicMock(spec=CalendarBlock)
    block.id = BLOCK_ID
    block.annual_plan_id = PLAN_ID
    block.type = BlockType.pto
    block.start_date = date(2026, 7, 1)
    block.end_date = date(2026, 7, 5)
    block.destination = "Beach"
    block.notes = "Summer break"

    # First call: get block
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = block

    # Second call: get plan (for ownership check)
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = plan

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])
    mock_db_session.commit = AsyncMock()

    async def mock_refresh(obj):
        obj.notes = "Extended summer break"

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.patch(
        f"/calendar/blocks/{BLOCK_ID}",
        headers=auth_headers,
        json={"notes": "Extended summer break"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notes"] == "Extended summer break"


def test_delete_calendar_block(
    client, auth_headers, override_get_db, mock_db_session
):
    """Delete a calendar block"""
    plan = MagicMock(spec=AnnualPlan)
    plan.id = PLAN_ID
    plan.user_id = TEST_USER_ID

    block = MagicMock(spec=CalendarBlock)
    block.id = BLOCK_ID
    block.annual_plan_id = PLAN_ID

    # First call: get block
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = block

    # Second call: get plan (for ownership check)
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = plan

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        f"/calendar/blocks/{BLOCK_ID}",
        headers=auth_headers,
    )
    assert response.status_code == 204
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_calendar.py::test_create_calendar_block -v`

Expected: FAIL (endpoints not implemented yet)

**Step 3: Add block CRUD endpoints to the router**

Append to `backend/src/travel_planner/routers/calendar.py`:

```python
@router.post("/blocks", response_model=CalendarBlockResponse, status_code=201)
async def create_calendar_block(
    block_data: CalendarBlockCreate,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Create a calendar block (PTO or holiday) on a plan."""
    # Verify plan exists and belongs to the user
    result = await db.execute(
        select(AnnualPlan).where(AnnualPlan.id == block_data.annual_plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Annual plan not found")
    if plan.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your annual plan")

    block = CalendarBlock(
        annual_plan_id=block_data.annual_plan_id,
        type=block_data.type,
        start_date=block_data.start_date,
        end_date=block_data.end_date,
        destination=block_data.destination,
        notes=block_data.notes,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)

    return CalendarBlockResponse.model_validate(block)


@router.patch("/blocks/{block_id}", response_model=CalendarBlockResponse)
async def update_calendar_block(
    block_id: UUID,
    block_data: CalendarBlockUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Update a calendar block."""
    # Get block
    result = await db.execute(
        select(CalendarBlock).where(CalendarBlock.id == block_id)
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Calendar block not found")

    # Verify ownership via plan
    plan_result = await db.execute(
        select(AnnualPlan).where(AnnualPlan.id == block.annual_plan_id)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan or plan.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your calendar block")

    # Update only provided fields
    update_data = block_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(block, field, value)

    await db.commit()
    await db.refresh(block)

    return CalendarBlockResponse.model_validate(block)


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_calendar_block(
    block_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Delete a calendar block."""
    # Get block
    result = await db.execute(
        select(CalendarBlock).where(CalendarBlock.id == block_id)
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Calendar block not found")

    # Verify ownership via plan
    plan_result = await db.execute(
        select(AnnualPlan).where(AnnualPlan.id == block.annual_plan_id)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan or plan.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your calendar block")

    await db.delete(block)
    await db.commit()

    return Response(status_code=204)
```

Also update `CalendarBlockCreate` schema to include `annual_plan_id`. In `backend/src/travel_planner/schemas/calendar.py`, add the field:

```python
class CalendarBlockCreate(BaseModel):
    annual_plan_id: uuid.UUID  # <-- add this field
    type: BlockType
    start_date: date
    end_date: date
    destination: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_dates(self) -> "CalendarBlockCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self
```

**Step 4: Run all calendar tests**

Run: `cd backend && uv run pytest tests/test_calendar.py -v`

Expected: All tests PASSED

**Step 5: Run the full backend test suite**

Run: `cd backend && uv run pytest -v`

Expected: All tests PASSED (no regressions)

**Step 6: Commit**

```bash
git add backend/src/travel_planner/routers/calendar.py backend/src/travel_planner/schemas/calendar.py backend/tests/test_calendar.py
git commit -m "feat: add calendar block CRUD endpoints

- POST /calendar/blocks creates PTO/holiday block on a plan
- PATCH /calendar/blocks/{id} updates block fields
- DELETE /calendar/blocks/{id} removes block
- Ownership verified via annual plan"
```

---

## Task 5: Frontend Types & API Client for Calendar

**Files:**
- Modify: `frontend/src/lib/types.ts` (add calendar types)
- Modify: `frontend/src/lib/api.ts` (add calendarApi)

**Step 1: Add calendar types**

Append to `frontend/src/lib/types.ts`:

```typescript
export type BlockType = 'pto' | 'holiday'

export interface AnnualPlan {
  id: string
  user_id: string
  year: number
  notes: string | null
  created_at: string
}

export interface CalendarBlock {
  id: string
  annual_plan_id: string
  type: BlockType
  start_date: string
  end_date: string
  destination: string | null
  notes: string | null
}

export interface TripSummaryForCalendar {
  id: string
  type: string
  destination: string
  start_date: string
  end_date: string
  status: string
}

export interface CalendarYearResponse {
  plan: AnnualPlan | null
  blocks: CalendarBlock[]
  trips: TripSummaryForCalendar[]
}

export interface CreateAnnualPlan {
  year: number
  notes?: string | null
}

export interface CreateCalendarBlock {
  annual_plan_id: string
  type: BlockType
  start_date: string
  end_date: string
  destination?: string | null
  notes?: string | null
}

export interface UpdateCalendarBlock {
  type?: BlockType
  start_date?: string
  end_date?: string
  destination?: string | null
  notes?: string | null
}
```

**Step 2: Add calendarApi**

Append the calendar API object and its type imports to `frontend/src/lib/api.ts`:

Add to the import at the top:

```typescript
import type { ..., CalendarYearResponse, AnnualPlan, CalendarBlock, CreateAnnualPlan, CreateCalendarBlock, UpdateCalendarBlock } from './types'
```

Append after the `checklistApi` object:

```typescript
export const calendarApi = {
  getYear: (year: number) =>
    api.get<CalendarYearResponse>(`/calendar/plans/${year}`),

  createPlan: (data: CreateAnnualPlan) =>
    api.post<AnnualPlan>('/calendar/plans', data),

  createBlock: (data: CreateCalendarBlock) =>
    api.post<CalendarBlock>('/calendar/blocks', data),

  updateBlock: (blockId: string, data: UpdateCalendarBlock) =>
    api.patch<CalendarBlock>(`/calendar/blocks/${blockId}`, data),

  deleteBlock: (blockId: string) =>
    api.delete(`/calendar/blocks/${blockId}`),
}
```

**Step 3: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add calendar types and API client"
```

---

## Task 6: useCalendar Hook + Tests

**Files:**
- Create: `frontend/src/hooks/useCalendar.ts`
- Create: `frontend/src/__tests__/useCalendar.test.ts`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/useCalendar.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getYear: (year: number) => mockGet(`/calendar/plans/${year}`),
    createPlan: (data: unknown) => mockPost('/calendar/plans', data),
    createBlock: (data: unknown) => mockPost('/calendar/blocks', data),
    updateBlock: (blockId: string, data: unknown) => mockPatch(`/calendar/blocks/${blockId}`, data),
    deleteBlock: (blockId: string) => mockDelete(`/calendar/blocks/${blockId}`),
  },
}))

import { useCalendarYear, useCreatePlan, useCreateBlock, useDeleteBlock } from '../hooks/useCalendar'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useCalendarYear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches calendar year data', async () => {
    const yearData = {
      plan: { id: 'plan-1', year: 2026, user_id: 'user-1', notes: null, created_at: '2026-01-01' },
      blocks: [],
      trips: [{ id: 'trip-1', destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10', type: 'vacation', status: 'booked' }],
    }
    mockGet.mockResolvedValue({ data: yearData })

    const { result } = renderHook(() => useCalendarYear(2026), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(yearData)
  })
})

describe('useCreatePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates annual plan', async () => {
    const newPlan = { id: 'plan-1', year: 2026, user_id: 'user-1', notes: null, created_at: '2026-01-01' }
    mockPost.mockResolvedValue({ data: newPlan })

    const { result } = renderHook(() => useCreatePlan(2026), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ year: 2026 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newPlan)
  })
})

describe('useCreateBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates calendar block', async () => {
    const newBlock = { id: 'block-1', annual_plan_id: 'plan-1', type: 'pto', start_date: '2026-07-01', end_date: '2026-07-05', destination: null, notes: null }
    mockPost.mockResolvedValue({ data: newBlock })

    const { result } = renderHook(() => useCreateBlock(2026), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ annual_plan_id: 'plan-1', type: 'pto', start_date: '2026-07-01', end_date: '2026-07-05' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newBlock)
  })
})

describe('useDeleteBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes calendar block', async () => {
    mockDelete.mockResolvedValue({})

    const { result } = renderHook(() => useDeleteBlock(2026), {
      wrapper: createWrapper(),
    })

    result.current.mutate('block-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/calendar/blocks/block-1')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/useCalendar.test.ts`

Expected: FAIL with `Cannot find module '../hooks/useCalendar'`

**Step 3: Implement the hook**

Create `frontend/src/hooks/useCalendar.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../lib/api'
import type { CreateAnnualPlan, CreateCalendarBlock, UpdateCalendarBlock } from '../lib/types'

export const calendarKeys = {
  all: ['calendar'] as const,
  year: (year: number) => [...calendarKeys.all, 'year', year] as const,
}

export function useCalendarYear(year: number) {
  return useQuery({
    queryKey: calendarKeys.year(year),
    queryFn: async () => {
      const { data } = await calendarApi.getYear(year)
      return data
    },
    enabled: !!year,
  })
}

export function useCreatePlan(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateAnnualPlan) => {
      const { data: plan } = await calendarApi.createPlan(data)
      return plan
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}

export function useCreateBlock(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCalendarBlock) => {
      const { data: block } = await calendarApi.createBlock(data)
      return block
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}

export function useUpdateBlock(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ blockId, data }: { blockId: string; data: UpdateCalendarBlock }) => {
      const { data: block } = await calendarApi.updateBlock(blockId, data)
      return block
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}

export function useDeleteBlock(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (blockId: string) => {
      await calendarApi.deleteBlock(blockId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/useCalendar.test.ts`

Expected: All tests PASSED

**Step 5: Commit**

```bash
git add frontend/src/hooks/useCalendar.ts frontend/src/__tests__/useCalendar.test.ts
git commit -m "feat: add useCalendar hook with TanStack Query integration"
```

---

## Task 7: Calendar Page & Route

**Files:**
- Create: `frontend/src/pages/CalendarPage.tsx`
- Modify: `frontend/src/router.tsx` (add `/calendar` route)
- Modify: `frontend/src/components/layout/RootLayout.tsx` (add nav link)

**Step 1: Create CalendarPage component**

Create `frontend/src/pages/CalendarPage.tsx`:

```tsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCalendarYear, useCreatePlan, useCreateBlock, useUpdateBlock, useDeleteBlock } from '../hooks/useCalendar'
import { AnnualCalendar } from '../components/calendar/AnnualCalendar'
import { CreateBlockModal } from '../components/calendar/CreateBlockModal'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { CreateCalendarBlock } from '../lib/types'

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-stone-200 rounded w-32" />
        <div className="h-10 bg-stone-200 rounded w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-48 bg-stone-200 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [showCreateBlock, setShowCreateBlock] = useState(false)
  const [selectedDates, setSelectedDates] = useState<{ start: string; end: string } | null>(null)

  const { data: calendarData, isLoading, error } = useCalendarYear(year)
  const createPlan = useCreatePlan(year)
  const createBlock = useCreateBlock(year)
  const updateBlock = useUpdateBlock(year)
  const deleteBlock = useDeleteBlock(year)

  const handleEnsurePlan = async () => {
    if (!calendarData?.plan) {
      await createPlan.mutateAsync({ year })
    }
  }

  const handleCreateBlock = async (blockData: Omit<CreateCalendarBlock, 'annual_plan_id'>) => {
    await handleEnsurePlan()
    // Re-fetch will have the plan, but we need the ID now
    // Use the plan from the create response or the existing data
    const planId = calendarData?.plan?.id || createPlan.data?.id
    if (!planId) return

    await createBlock.mutateAsync({
      ...blockData,
      annual_plan_id: planId,
    })
    setShowCreateBlock(false)
    setSelectedDates(null)
  }

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock.mutateAsync(blockId)
  }

  if (isLoading) return <CalendarSkeleton />

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        Failed to load calendar data. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Previous year"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-stone-900 tabular-nums">{year}</h1>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Next year"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setShowCreateBlock(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </button>
      </div>

      <AnnualCalendar
        year={year}
        blocks={calendarData?.blocks ?? []}
        trips={calendarData?.trips ?? []}
        onDeleteBlock={handleDeleteBlock}
        onDateSelect={(start, end) => {
          setSelectedDates({ start, end })
          setShowCreateBlock(true)
        }}
      />

      <CreateBlockModal
        isOpen={showCreateBlock}
        onClose={() => {
          setShowCreateBlock(false)
          setSelectedDates(null)
        }}
        onSubmit={handleCreateBlock}
        initialDates={selectedDates}
      />
    </div>
  )
}
```

**Step 2: Add route to router.tsx**

In `frontend/src/router.tsx`, add the import and route:

Add import:

```typescript
import { CalendarPage } from './pages/CalendarPage'
```

Add route (after `tripDetailRoute`):

```typescript
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
})
```

Update the route tree to include `calendarRoute`:

```typescript
const routeTree = rootRoute.addChildren([indexRoute, tripsRoute, newTripRoute, tripDetailRoute, calendarRoute])
```

Update the index route redirect to go to `/calendar`:

```typescript
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/calendar' })
  },
})
```

**Step 3: Add nav link to RootLayout**

In `frontend/src/components/layout/RootLayout.tsx`, add a Calendar nav link next to the logo.

Add import:

```typescript
import { Plane, Calendar } from 'lucide-react'
```

After the logo `<Link>`, add navigation links:

```tsx
<nav className="flex items-center gap-1">
  <Link
    to="/calendar"
    className="px-3 py-1.5 text-sm font-medium text-stone-500 rounded-lg hover:bg-stone-100 hover:text-stone-900 transition-colors [&.active]:bg-stone-100 [&.active]:text-stone-900"
    activeProps={{ className: 'bg-stone-100 text-stone-900' }}
  >
    Calendar
  </Link>
  <Link
    to="/trips"
    className="px-3 py-1.5 text-sm font-medium text-stone-500 rounded-lg hover:bg-stone-100 hover:text-stone-900 transition-colors [&.active]:bg-stone-100 [&.active]:text-stone-900"
    activeProps={{ className: 'bg-stone-100 text-stone-900' }}
  >
    Trips
  </Link>
</nav>
```

**Step 4: Verify TypeScript compiles (will fail — calendar components don't exist yet)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: Errors about missing `AnnualCalendar` and `CreateBlockModal` — these will be created in the next tasks.

**Step 5: Commit (WIP — page won't render until components exist)**

```bash
git add frontend/src/pages/CalendarPage.tsx frontend/src/router.tsx frontend/src/components/layout/RootLayout.tsx
git commit -m "feat: add CalendarPage with year navigation and route

- /calendar route added to TanStack Router
- Index redirect changed to /calendar
- Calendar + Trips nav links in header
- CalendarPage shell with year selector and Add Block button"
```

---

## Task 8: AnnualCalendar Component

**Files:**
- Create: `frontend/src/components/calendar/AnnualCalendar.tsx`
- Create: `frontend/src/components/calendar/MonthGrid.tsx`

**Step 1: Create MonthGrid component**

Create `frontend/src/components/calendar/MonthGrid.tsx`:

```tsx
import type { CalendarBlock, TripSummaryForCalendar } from '../../lib/types'

interface MonthGridProps {
  year: number
  month: number
  blocks: CalendarBlock[]
  trips: TripSummaryForCalendar[]
  onDeleteBlock?: (blockId: string) => void
  onDateSelect?: (start: string, end: string) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

type EventType = 'pto' | 'holiday' | 'vacation' | 'remote_week' | 'sabbatical' | 'trip'

function getEventColor(type: EventType): string {
  switch (type) {
    case 'pto': return 'bg-amber-400/80'
    case 'holiday': return 'bg-red-400/80'
    case 'vacation': return 'bg-blue-400/80'
    case 'remote_week': return 'bg-emerald-400/80'
    case 'sabbatical': return 'bg-purple-400/80'
    default: return 'bg-blue-400/80'
  }
}

interface DayEvent {
  id: string
  type: EventType
  label: string
  isBlockStart: boolean
  isBlockEnd: boolean
  isBlock: boolean  // true = calendar block (PTO/holiday), false = trip
}

function getEventsForDay(
  dateStr: string,
  blocks: CalendarBlock[],
  trips: TripSummaryForCalendar[],
): DayEvent[] {
  const events: DayEvent[] = []

  for (const block of blocks) {
    if (dateStr >= block.start_date && dateStr <= block.end_date) {
      events.push({
        id: block.id,
        type: block.type as EventType,
        label: block.destination || block.type.toUpperCase(),
        isBlockStart: dateStr === block.start_date,
        isBlockEnd: dateStr === block.end_date,
        isBlock: true,
      })
    }
  }

  for (const trip of trips) {
    if (dateStr >= trip.start_date && dateStr <= trip.end_date) {
      events.push({
        id: trip.id,
        type: (trip.type as EventType) || 'trip',
        label: trip.destination,
        isBlockStart: dateStr === trip.start_date,
        isBlockEnd: dateStr === trip.end_date,
        isBlock: false,
      })
    }
  }

  return events
}

export function MonthGrid({ year, month, blocks, trips, onDeleteBlock, onDateSelect }: MonthGridProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const today = new Date()
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3">
      <h3 className="text-sm font-semibold text-stone-700 mb-2">{MONTH_NAMES[month]}</h3>

      <div className="grid grid-cols-7 gap-px">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[10px] font-medium text-stone-400 text-center pb-1">
            {d}
          </div>
        ))}

        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = formatDate(year, month, day)
          const isToday = dateStr === todayStr
          const events = getEventsForDay(dateStr, blocks, trips)
          const hasEvent = events.length > 0

          return (
            <button
              key={day}
              onClick={() => {
                if (onDateSelect) {
                  onDateSelect(dateStr, dateStr)
                }
              }}
              className={`
                relative h-7 text-xs flex items-center justify-center rounded transition-colors
                ${isToday ? 'font-bold text-blue-600 ring-1 ring-blue-300' : 'text-stone-600'}
                ${hasEvent ? '' : 'hover:bg-stone-100'}
              `}
              title={events.map(e => `${e.type}: ${e.label}`).join(', ') || undefined}
            >
              <span className="relative z-10">{day}</span>
              {hasEvent && (
                <div className="absolute inset-0.5 flex flex-col gap-px justify-end">
                  {events.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`h-1 rounded-full ${getEventColor(event.type)}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Create AnnualCalendar component**

Create `frontend/src/components/calendar/AnnualCalendar.tsx`:

```tsx
import type { CalendarBlock, TripSummaryForCalendar } from '../../lib/types'
import { MonthGrid } from './MonthGrid'
import { Trash2 } from 'lucide-react'

interface AnnualCalendarProps {
  year: number
  blocks: CalendarBlock[]
  trips: TripSummaryForCalendar[]
  onDeleteBlock?: (blockId: string) => void
  onDateSelect?: (start: string, end: string) => void
}

type EventType = 'pto' | 'holiday' | 'vacation' | 'remote_week' | 'sabbatical'

function getEventColor(type: EventType): string {
  switch (type) {
    case 'pto': return 'bg-amber-400'
    case 'holiday': return 'bg-red-400'
    case 'vacation': return 'bg-blue-400'
    case 'remote_week': return 'bg-emerald-400'
    case 'sabbatical': return 'bg-purple-400'
    default: return 'bg-blue-400'
  }
}

function getEventLabel(type: string): string {
  switch (type) {
    case 'pto': return 'PTO'
    case 'holiday': return 'Holiday'
    case 'vacation': return 'Vacation'
    case 'remote_week': return 'Remote Week'
    case 'sabbatical': return 'Sabbatical'
    default: return type
  }
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AnnualCalendar({ year, blocks, trips, onDeleteBlock, onDateSelect }: AnnualCalendarProps) {
  return (
    <div className="space-y-6">
      {/* 12-month grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, month) => (
          <MonthGrid
            key={month}
            year={year}
            month={month}
            blocks={blocks}
            trips={trips}
            onDeleteBlock={onDeleteBlock}
            onDateSelect={onDateSelect}
          />
        ))}
      </div>

      {/* Legend + block list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocks */}
        {blocks.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">PTO & Holidays</h3>
            <div className="space-y-2">
              {blocks.map(block => (
                <div key={block.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getEventColor(block.type as EventType)}`} />
                    <span className="text-sm text-stone-700 truncate">
                      {block.destination || getEventLabel(block.type)}
                    </span>
                    <span className="text-xs text-stone-400 shrink-0">
                      {formatDateShort(block.start_date)} — {formatDateShort(block.end_date)}
                    </span>
                  </div>
                  {onDeleteBlock && (
                    <button
                      onClick={() => onDeleteBlock(block.id)}
                      className="p-1 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trips */}
        {trips.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Trips</h3>
            <div className="space-y-2">
              {trips.map(trip => (
                <div key={trip.id} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getEventColor(trip.type as EventType)}`} />
                  <span className="text-sm text-stone-700 truncate">{trip.destination}</span>
                  <span className="text-xs text-stone-400 shrink-0">
                    {formatDateShort(trip.start_date)} — {formatDateShort(trip.end_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { type: 'vacation', label: 'Vacation' },
              { type: 'remote_week', label: 'Remote Week' },
              { type: 'sabbatical', label: 'Sabbatical' },
              { type: 'pto', label: 'PTO' },
              { type: 'holiday', label: 'Holiday' },
            ].map(({ type, label }) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${getEventColor(type as EventType)}`} />
                <span className="text-xs text-stone-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Verify TypeScript compiles (still missing CreateBlockModal)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -10`

Expected: Error about missing `CreateBlockModal` only

**Step 4: Commit**

```bash
git add frontend/src/components/calendar/AnnualCalendar.tsx frontend/src/components/calendar/MonthGrid.tsx
git commit -m "feat: add AnnualCalendar and MonthGrid components

- 12-month year grid with day cells showing event indicators
- Color-coded by type: vacation, remote week, sabbatical, PTO, holiday
- Block and trip listing panels with delete support
- Legend component"
```

---

## Task 9: CreateBlockModal Component

**Files:**
- Create: `frontend/src/components/calendar/CreateBlockModal.tsx`

**Step 1: Create the modal**

Create `frontend/src/components/calendar/CreateBlockModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import type { BlockType, CreateCalendarBlock } from '../../lib/types'

interface CreateBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<CreateCalendarBlock, 'annual_plan_id'>) => void
  initialDates?: { start: string; end: string } | null
}

export function CreateBlockModal({ isOpen, onClose, onSubmit, initialDates }: CreateBlockModalProps) {
  const [type, setType] = useState<BlockType>('pto')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialDates) {
      setStartDate(initialDates.start)
      setEndDate(initialDates.end)
    }
  }, [initialDates])

  useEffect(() => {
    if (!isOpen) {
      setType('pto')
      setStartDate('')
      setEndDate('')
      setDestination('')
      setNotes('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startDate || !endDate) {
      setError('Start and end dates are required')
      return
    }
    if (endDate < startDate) {
      setError('End date must be on or after start date')
      return
    }

    onSubmit({
      type,
      start_date: startDate,
      end_date: endDate,
      destination: destination || null,
      notes: notes || null,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Calendar Block">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
          <div className="flex gap-2">
            {([
              { value: 'pto', label: 'PTO', color: 'bg-amber-400' },
              { value: 'holiday', label: 'Holiday', color: 'bg-red-400' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                  ${type === opt.value
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'}
                `}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-stone-700 mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-stone-700 mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-stone-700 mb-1">
            Destination <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="e.g. Beach house"
            maxLength={255}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1">
            Notes <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={5000}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Block
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Run all frontend tests**

Run: `cd frontend && npx vitest run`

Expected: All tests PASSED

**Step 4: Commit**

```bash
git add frontend/src/components/calendar/CreateBlockModal.tsx
git commit -m "feat: add CreateBlockModal for PTO/holiday block creation

- Type selector (PTO/Holiday) with color indicators
- Date range inputs with validation
- Optional destination and notes fields
- Pre-populated dates when clicking calendar days"
```

---

## Task 10: CalendarPage Integration Test

**Files:**
- Create: `frontend/src/__tests__/CalendarPage.test.tsx`

**Step 1: Write the test**

Create `frontend/src/__tests__/CalendarPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { CalendarPage } from '../pages/CalendarPage'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getYear: (year: number) => mockGet(`/calendar/plans/${year}`),
    createPlan: (data: unknown) => mockPost('/calendar/plans', data),
    createBlock: (data: unknown) => mockPost('/calendar/blocks', data),
    updateBlock: (blockId: string, data: unknown) => mockPatch(`/calendar/blocks/${blockId}`, data),
    deleteBlock: (blockId: string) => mockDelete(`/calendar/blocks/${blockId}`),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    signOut: vi.fn(),
  }),
}))

function renderWithRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  const rootRoute = createRootRoute()
  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/calendar',
    component: CalendarPage,
  })
  const routeTree = rootRoute.addChildren([calendarRoute])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/calendar'] }),
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders year heading and 12 months', async () => {
    const currentYear = new Date().getFullYear()
    mockGet.mockResolvedValue({
      data: { plan: null, blocks: [], trips: [] },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText(String(currentYear))).toBeInTheDocument()
    })

    // All 12 month names should be visible
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    for (const month of months) {
      expect(screen.getByText(month)).toBeInTheDocument()
    }
  })

  it('shows trips in the trip list', async () => {
    mockGet.mockResolvedValue({
      data: {
        plan: null,
        blocks: [],
        trips: [{
          id: 'trip-1',
          type: 'vacation',
          destination: 'Paris',
          start_date: '2026-08-10',
          end_date: '2026-08-20',
          status: 'booked',
        }],
      },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })
  })

  it('shows blocks in the block list', async () => {
    mockGet.mockResolvedValue({
      data: {
        plan: { id: 'plan-1', year: 2026, user_id: 'user-1', notes: null, created_at: '2026-01-01' },
        blocks: [{
          id: 'block-1',
          annual_plan_id: 'plan-1',
          type: 'pto',
          start_date: '2026-07-01',
          end_date: '2026-07-05',
          destination: 'Beach',
          notes: null,
        }],
        trips: [],
      },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Beach')).toBeInTheDocument()
    })
  })

  it('opens create block modal on Add Block click', async () => {
    mockGet.mockResolvedValue({
      data: { plan: null, blocks: [], trips: [] },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Add Block')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Add Block'))

    expect(screen.getByText('Add Calendar Block')).toBeInTheDocument()
  })
})
```

**Step 2: Run the test**

Run: `cd frontend && npx vitest run src/__tests__/CalendarPage.test.tsx`

Expected: All tests PASSED

**Step 3: Run all frontend tests to verify no regressions**

Run: `cd frontend && npx vitest run`

Expected: All tests PASSED

**Step 4: Commit**

```bash
git add frontend/src/__tests__/CalendarPage.test.tsx
git commit -m "test: add CalendarPage integration tests

- Verifies year heading and all 12 months render
- Verifies trips and blocks appear in listings
- Verifies Add Block modal opens"
```

---

## Task 11: Full Test Suite Verification

**Step 1: Run all backend tests**

Run: `cd backend && uv run pytest -v`

Expected: All tests PASSED

**Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`

Expected: All tests PASSED

**Step 3: TypeScript compilation check**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Final commit (if any fixes were needed)**

Only commit if tests revealed issues that needed fixing. Otherwise, this task is a verification-only step.
