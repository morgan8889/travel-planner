# Planning Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current Calendar page (blocks/annual plans) with a multi-zoom Planning Center featuring month/quarter/year views, slide-in sidebar, click-drag trip creation, and holiday/custom day management.

**Architecture:** Backend: drop old calendar_blocks/annual_plans tables, add holiday_calendars + custom_days tables, use Python `holidays` library for country-based holiday data. Frontend: replace CalendarPage with PlanningCenterPage, build 12 new components in `components/planning/`, new `useHolidays` hook, update router and API layer.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Python `holidays` library, React, TypeScript, TanStack Query, Tailwind CSS, lucide-react

---

## Task 1: Backend — New Models (HolidayCalendar + CustomDay)

**Files:**
- Modify: `backend/src/travel_planner/models/calendar.py` — replace old models with new ones
- Modify: `backend/src/travel_planner/models/__init__.py` — update exports

**Step 1: Replace models in calendar.py**

Replace the entire file content. Remove `BlockType`, `AnnualPlan`, `CalendarBlock`. Add `HolidayCalendar` and `CustomDay`:

```python
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from travel_planner.models.user import Base


class HolidayCalendar(Base):
    __tablename__ = "holiday_calendars"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    country_code: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CustomDay(Base):
    __tablename__ = "custom_days"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    name: Mapped[str] = mapped_column(String(255))
    date: Mapped[date] = mapped_column(Date)
    recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

**Step 2: Update `models/__init__.py`**

Replace `AnnualPlan, CalendarBlock` imports with `HolidayCalendar, CustomDay`. Update `__all__` list.

**Step 3: Run type check to verify models compile**

Run: `cd backend && uv run pyright src/travel_planner/models/calendar.py`
Expected: PASS (possibly with warnings from other files referencing old models — that's fine, we'll fix those next)

**Step 4: Commit**

```bash
git add backend/src/travel_planner/models/calendar.py backend/src/travel_planner/models/__init__.py
git commit -m "refactor: replace AnnualPlan/CalendarBlock models with HolidayCalendar/CustomDay"
```

---

## Task 2: Backend — New Schemas

**Files:**
- Modify: `backend/src/travel_planner/schemas/calendar.py` — replace old schemas with new ones

**Step 1: Replace schemas**

Remove all old schemas (`AnnualPlanCreate`, `AnnualPlanResponse`, `CalendarBlockCreate`, `CalendarBlockUpdate`, `CalendarBlockResponse`, `CalendarYearResponse`). Keep `TripSummaryForCalendar`. Add new schemas:

```python
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class HolidayEntry(BaseModel):
    """A single holiday from a country calendar (computed, not stored)."""
    date: date
    name: str
    country_code: str


class CustomDayCreate(BaseModel):
    name: str = Field(..., max_length=255)
    date: date
    recurring: bool = False


class CustomDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    date: date
    recurring: bool
    created_at: datetime


class EnableCountryRequest(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=10)
    year: int = Field(..., ge=2000, le=2100)


class HolidayCalendarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    country_code: str
    year: int


class HolidaysResponse(BaseModel):
    """Combined holidays + custom days for a year."""
    holidays: list[HolidayEntry]
    custom_days: list[CustomDayResponse]
    enabled_countries: list[HolidayCalendarResponse]


class TripSummaryForCalendar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    destination: str
    start_date: date
    end_date: date
    status: str
```

**Step 2: Commit**

```bash
git add backend/src/travel_planner/schemas/calendar.py
git commit -m "refactor: replace calendar block schemas with holiday/custom day schemas"
```

---

## Task 3: Backend — Add `holidays` Dependency

**Files:**
- Modify: `backend/pyproject.toml` — add `holidays` package

**Step 1: Add the holidays library**

Run: `cd backend && uv add holidays`

**Step 2: Verify it installs**

Run: `cd backend && uv run python -c "import holidays; print(holidays.US(years=2026))"`
Expected: prints a dict of 2026 US holidays

**Step 3: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "feat: add holidays library for country-based holiday data"
```

---

## Task 4: Backend — New Calendar Router

**Files:**
- Modify: `backend/src/travel_planner/routers/calendar.py` — replace entire router

**Step 1: Replace the calendar router**

Remove all old endpoints (plans, blocks). Add new endpoints:

```python
from datetime import date
from uuid import UUID

import holidays as holidays_lib
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.db import get_db
from travel_planner.models.calendar import CustomDay, HolidayCalendar
from travel_planner.schemas.calendar import (
    CustomDayCreate,
    CustomDayResponse,
    EnableCountryRequest,
    HolidayCalendarResponse,
    HolidayEntry,
    HolidaysResponse,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Map of supported country codes to holidays classes
SUPPORTED_COUNTRIES = {
    "US": holidays_lib.US,
    "UK": holidays_lib.UK,
    "CA": holidays_lib.CA,
    "AU": holidays_lib.AU,
    "DE": holidays_lib.DE,
    "FR": holidays_lib.FR,
    "JP": holidays_lib.JP,
    "MX": holidays_lib.MX,
    "BR": holidays_lib.BR,
    "IN": holidays_lib.IN,
}


def get_holidays_for_country(country_code: str, year: int) -> list[HolidayEntry]:
    """Generate holiday entries for a country and year."""
    cls = SUPPORTED_COUNTRIES.get(country_code)
    if cls is None:
        return []
    country_holidays = cls(years=year)
    return [
        HolidayEntry(date=d, name=name, country_code=country_code)
        for d, name in sorted(country_holidays.items())
    ]


@router.get("/holidays", response_model=HolidaysResponse)
async def get_holidays(
    year: int,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Get holidays and custom days for a year."""
    # Get enabled country calendars
    result = await db.execute(
        select(HolidayCalendar)
        .where(HolidayCalendar.user_id == user_id)
        .where(HolidayCalendar.year == year)
    )
    enabled = result.scalars().all()

    # Compute holidays from enabled countries
    all_holidays: list[HolidayEntry] = []
    for cal in enabled:
        all_holidays.extend(get_holidays_for_country(cal.country_code, year))
    all_holidays.sort(key=lambda h: h.date)

    # Get custom days (non-recurring for this year + recurring from any year)
    result = await db.execute(
        select(CustomDay).where(CustomDay.user_id == user_id)
    )
    all_custom = result.scalars().all()
    custom_days = []
    for cd in all_custom:
        if cd.recurring or cd.date.year == year:
            custom_days.append(cd)

    enabled_responses = [HolidayCalendarResponse.model_validate(e) for e in enabled]
    custom_responses = [CustomDayResponse.model_validate(cd) for cd in custom_days]

    return HolidaysResponse(
        holidays=all_holidays,
        custom_days=custom_responses,
        enabled_countries=enabled_responses,
    )


@router.get("/supported-countries")
async def list_supported_countries() -> list[dict[str, str]]:
    """List supported country codes for holiday calendars."""
    return [{"code": code, "name": code} for code in sorted(SUPPORTED_COUNTRIES.keys())]


@router.post("/holidays/country", response_model=HolidayCalendarResponse, status_code=201)
async def enable_country(
    data: EnableCountryRequest,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Enable a country's holiday calendar for a year."""
    if data.country_code not in SUPPORTED_COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Unsupported country: {data.country_code}")

    # Check for duplicate
    result = await db.execute(
        select(HolidayCalendar)
        .where(HolidayCalendar.user_id == user_id)
        .where(HolidayCalendar.country_code == data.country_code)
        .where(HolidayCalendar.year == data.year)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Country already enabled for this year")

    cal = HolidayCalendar(
        user_id=user_id,
        country_code=data.country_code,
        year=data.year,
    )
    db.add(cal)
    await db.commit()
    await db.refresh(cal)

    return HolidayCalendarResponse.model_validate(cal)


@router.delete("/holidays/country/{country_code}", status_code=204)
async def disable_country(
    country_code: str,
    year: int,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Disable a country's holiday calendar for a year."""
    result = await db.execute(
        select(HolidayCalendar)
        .where(HolidayCalendar.user_id == user_id)
        .where(HolidayCalendar.country_code == country_code)
        .where(HolidayCalendar.year == year)
    )
    cal = result.scalar_one_or_none()
    if cal is None:
        raise HTTPException(status_code=404, detail="Country calendar not found")

    await db.delete(cal)
    await db.commit()
    return Response(status_code=204)


@router.post("/custom-days", response_model=CustomDayResponse, status_code=201)
async def create_custom_day(
    data: CustomDayCreate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Add a custom day (birthday, company event, etc.)."""
    custom_day = CustomDay(
        user_id=user_id,
        name=data.name,
        date=data.date,
        recurring=data.recurring,
    )
    db.add(custom_day)
    await db.commit()
    await db.refresh(custom_day)

    return CustomDayResponse.model_validate(custom_day)


@router.delete("/custom-days/{custom_day_id}", status_code=204)
async def delete_custom_day(
    custom_day_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom day."""
    result = await db.execute(
        select(CustomDay).where(CustomDay.id == custom_day_id)
    )
    cd = result.scalar_one_or_none()
    if cd is None:
        raise HTTPException(status_code=404, detail="Custom day not found")
    if cd.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this custom day")

    await db.delete(cd)
    await db.commit()
    return Response(status_code=204)
```

**Step 2: Commit**

```bash
git add backend/src/travel_planner/routers/calendar.py
git commit -m "feat: replace calendar router with holiday/custom day endpoints"
```

---

## Task 5: Backend — New Tests

**Files:**
- Modify: `backend/tests/test_calendar.py` — replace all tests

**Step 1: Write tests for new schemas and endpoints**

Replace the entire test file. Test:
1. `CustomDayCreate` schema validation
2. `EnableCountryRequest` schema validation
3. `GET /calendar/holidays` — returns holidays + custom days
4. `POST /calendar/holidays/country` — enable country
5. `POST /calendar/holidays/country` — duplicate returns 409
6. `POST /calendar/holidays/country` — unsupported country returns 400
7. `DELETE /calendar/holidays/country/{code}` — disable country
8. `POST /calendar/custom-days` — create custom day
9. `DELETE /calendar/custom-days/{id}` — delete custom day, 403 for other user's day
10. `GET /calendar/supported-countries` — returns list

```python
from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from tests.conftest import OTHER_USER_ID, TEST_USER_ID
from travel_planner.models.calendar import CustomDay, HolidayCalendar
from travel_planner.schemas.calendar import CustomDayCreate, EnableCountryRequest

HOLIDAY_CAL_ID = UUID("aaa14567-e89b-12d3-a456-426614174010")
CUSTOM_DAY_ID = UUID("bbb24567-e89b-12d3-a456-426614174011")


# --- Schema Tests ---


def test_custom_day_create_valid():
    cd = CustomDayCreate(name="Mom's birthday", date=date(2026, 5, 15), recurring=True)
    assert cd.name == "Mom's birthday"
    assert cd.recurring is True


def test_enable_country_valid():
    req = EnableCountryRequest(country_code="US", year=2026)
    assert req.country_code == "US"
    assert req.year == 2026


# --- API Tests ---


def test_get_supported_countries(client, auth_headers):
    response = client.get("/calendar/supported-countries", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    codes = [c["code"] for c in data]
    assert "US" in codes


def test_enable_country(client, auth_headers, override_get_db, mock_db_session):
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    async def mock_refresh(obj):
        obj.id = HOLIDAY_CAL_ID
        obj.country_code = "US"
        obj.year = 2026

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        "/calendar/holidays/country",
        headers=auth_headers,
        json={"country_code": "US", "year": 2026},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["country_code"] == "US"
    assert data["year"] == 2026


def test_enable_country_duplicate(client, auth_headers, override_get_db, mock_db_session):
    existing = MagicMock(spec=HolidayCalendar)
    existing.id = HOLIDAY_CAL_ID
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = existing
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.post(
        "/calendar/holidays/country",
        headers=auth_headers,
        json={"country_code": "US", "year": 2026},
    )
    assert response.status_code == 409


def test_enable_country_unsupported(client, auth_headers, override_get_db, mock_db_session):
    response = client.post(
        "/calendar/holidays/country",
        headers=auth_headers,
        json={"country_code": "ZZ", "year": 2026},
    )
    assert response.status_code == 400


def test_disable_country(client, auth_headers, override_get_db, mock_db_session):
    cal = MagicMock(spec=HolidayCalendar)
    cal.id = HOLIDAY_CAL_ID
    cal.user_id = TEST_USER_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = cal
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        "/calendar/holidays/country/US?year=2026",
        headers=auth_headers,
    )
    assert response.status_code == 204


def test_create_custom_day(client, auth_headers, override_get_db, mock_db_session):
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    from datetime import UTC, datetime

    async def mock_refresh(obj):
        obj.id = CUSTOM_DAY_ID
        obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        "/calendar/custom-days",
        headers=auth_headers,
        json={"name": "Mom's birthday", "date": "2026-05-15", "recurring": True},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Mom's birthday"
    assert data["recurring"] is True


def test_delete_custom_day(client, auth_headers, override_get_db, mock_db_session):
    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = TEST_USER_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = cd
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        f"/calendar/custom-days/{CUSTOM_DAY_ID}",
        headers=auth_headers,
    )
    assert response.status_code == 204


def test_delete_custom_day_not_owner(client, auth_headers, override_get_db, mock_db_session):
    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = OTHER_USER_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = cd
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.delete(
        f"/calendar/custom-days/{CUSTOM_DAY_ID}",
        headers=auth_headers,
    )
    assert response.status_code == 403


def test_get_holidays(client, auth_headers, override_get_db, mock_db_session):
    from datetime import UTC, datetime

    cal = MagicMock(spec=HolidayCalendar)
    cal.id = HOLIDAY_CAL_ID
    cal.user_id = TEST_USER_ID
    cal.country_code = "US"
    cal.year = 2026

    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = TEST_USER_ID
    cd.name = "Birthday"
    cd.date = date(2026, 5, 15)
    cd.recurring = False
    cd.created_at = datetime(2026, 1, 1, tzinfo=UTC)

    result_mock1 = MagicMock()
    result_mock1.scalars.return_value.all.return_value = [cal]

    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [cd]

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get("/calendar/holidays?year=2026", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["holidays"]) > 0
    assert any(h["name"] == "New Year's Day" for h in data["holidays"])
    assert len(data["custom_days"]) == 1
    assert data["custom_days"][0]["name"] == "Birthday"
    assert len(data["enabled_countries"]) == 1
```

**Step 2: Run tests**

Run: `cd backend && uv run pytest tests/test_calendar.py -v`
Expected: all tests pass

**Step 3: Run full backend checks**

Run: `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest`
Expected: all pass

**Step 4: Commit**

```bash
git add backend/tests/test_calendar.py
git commit -m "test: add tests for holiday/custom day calendar endpoints"
```

---

## Task 6: Backend — Alembic Migration

**Files:**
- Create: `backend/alembic/versions/006_planning_center.py`

**Step 1: Create the migration**

Run: `cd backend && uv run alembic revision -m "replace calendar blocks with holidays and custom days"`

This will create a new migration file. Edit it to:

```python
"""replace calendar blocks with holidays and custom days"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "006"
down_revision = "005_add_coordinates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old tables
    op.drop_table("calendar_blocks")
    op.drop_table("annual_plans")

    # Create new tables
    op.create_table(
        "holiday_calendars",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "custom_days",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("recurring", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("custom_days")
    op.drop_table("holiday_calendars")

    # Recreate old tables
    op.create_table(
        "annual_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "calendar_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("annual_plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("annual_plans.id"), nullable=False),
        sa.Column("type", sa.Enum("pto", "holiday", name="blocktype"), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("destination", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
```

Note: The actual `down_revision` must match the latest existing migration head. Check with `uv run alembic heads` and adjust. If there's a merge head, set `down_revision` accordingly.

**Step 2: Verify migration file is valid**

Run: `cd backend && uv run alembic check`
Expected: no errors

**Step 3: Commit**

```bash
git add backend/alembic/versions/006_*.py
git commit -m "migration: replace calendar_blocks/annual_plans with holiday_calendars/custom_days"
```

---

## Task 7: Frontend — Update Types and API Layer

**Files:**
- Modify: `frontend/src/lib/types.ts` — remove old calendar types, add new ones
- Modify: `frontend/src/lib/api.ts` — replace `calendarApi` methods

**Step 1: Update types.ts**

Remove these types: `BlockType`, `AnnualPlan`, `CalendarBlock`, `TripSummaryForCalendar`, `CalendarYearResponse`, `CreateAnnualPlan`, `CreateCalendarBlock`, `UpdateCalendarBlock`.

Add these types:

```typescript
export interface HolidayEntry {
  date: string
  name: string
  country_code: string
}

export interface CustomDay {
  id: string
  user_id: string
  name: string
  date: string
  recurring: boolean
  created_at: string
}

export interface CreateCustomDay {
  name: string
  date: string
  recurring?: boolean
}

export interface HolidayCalendarEntry {
  id: string
  country_code: string
  year: number
}

export interface HolidaysResponse {
  holidays: HolidayEntry[]
  custom_days: CustomDay[]
  enabled_countries: HolidayCalendarEntry[]
}

export interface SupportedCountry {
  code: string
  name: string
}
```

**Step 2: Update api.ts**

Replace `calendarApi` with:

```typescript
export const calendarApi = {
  getHolidays: (year: number) =>
    api.get<HolidaysResponse>(`/calendar/holidays`, { params: { year } }),

  getSupportedCountries: () =>
    api.get<SupportedCountry[]>('/calendar/supported-countries'),

  enableCountry: (data: { country_code: string; year: number }) =>
    api.post<HolidayCalendarEntry>('/calendar/holidays/country', data),

  disableCountry: (countryCode: string, year: number) =>
    api.delete(`/calendar/holidays/country/${countryCode}`, { params: { year } }),

  createCustomDay: (data: CreateCustomDay) =>
    api.post<CustomDay>('/calendar/custom-days', data),

  deleteCustomDay: (id: string) =>
    api.delete(`/calendar/custom-days/${id}`),
}
```

Update the import line at the top of api.ts to reference the new types.

**Step 3: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "refactor: replace calendar block types/api with holiday/custom day types"
```

---

## Task 8: Frontend — New useHolidays Hook

**Files:**
- Create: `frontend/src/hooks/useHolidays.ts`
- Delete: `frontend/src/hooks/useCalendar.ts`

**Step 1: Create useHolidays.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../lib/api'
import type { CreateCustomDay } from '../lib/types'

export const holidayKeys = {
  all: ['holidays'] as const,
  year: (year: number) => [...holidayKeys.all, 'year', year] as const,
  countries: ['holidays', 'countries'] as const,
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: holidayKeys.year(year),
    queryFn: async () => {
      const { data } = await calendarApi.getHolidays(year)
      return data
    },
    enabled: !!year,
  })
}

export function useSupportedCountries() {
  return useQuery({
    queryKey: holidayKeys.countries,
    queryFn: async () => {
      const { data } = await calendarApi.getSupportedCountries()
      return data
    },
    staleTime: Infinity,
  })
}

export function useEnableCountry(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (countryCode: string) => {
      const { data } = await calendarApi.enableCountry({ country_code: countryCode, year })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}

export function useDisableCountry(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (countryCode: string) => {
      await calendarApi.disableCountry(countryCode, year)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}

export function useCreateCustomDay(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCustomDay) => {
      const { data: result } = await calendarApi.createCustomDay(data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}

export function useDeleteCustomDay(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await calendarApi.deleteCustomDay(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}
```

**Step 2: Delete old hook**

Delete: `frontend/src/hooks/useCalendar.ts`

**Step 3: Commit**

```bash
git add frontend/src/hooks/useHolidays.ts
git rm frontend/src/hooks/useCalendar.ts
git commit -m "feat: add useHolidays hook, remove useCalendar"
```

---

## Task 9: Frontend — useDragSelect Hook

**Files:**
- Create: `frontend/src/components/planning/useDragSelect.ts`

**Step 1: Create the drag selection hook**

```typescript
import { useState, useCallback, useRef } from 'react'

export interface DragSelection {
  startDate: string
  endDate: string
}

export function useDragSelect() {
  const [selection, setSelection] = useState<DragSelection | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<string | null>(null)

  const onDragStart = useCallback((dateStr: string) => {
    dragStartRef.current = dateStr
    setIsDragging(true)
    setSelection({ startDate: dateStr, endDate: dateStr })
  }, [])

  const onDragMove = useCallback((dateStr: string) => {
    if (!isDragging || !dragStartRef.current) return
    const start = dragStartRef.current
    // Ensure startDate <= endDate
    if (start <= dateStr) {
      setSelection({ startDate: start, endDate: dateStr })
    } else {
      setSelection({ startDate: dateStr, endDate: start })
    }
  }, [isDragging])

  const onDragEnd = useCallback((): DragSelection | null => {
    setIsDragging(false)
    dragStartRef.current = null
    const result = selection
    return result
  }, [selection])

  const clearSelection = useCallback(() => {
    setSelection(null)
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  return {
    selection,
    isDragging,
    onDragStart,
    onDragMove,
    onDragEnd,
    clearSelection,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planning/useDragSelect.ts
git commit -m "feat: add useDragSelect hook for click-drag date selection"
```

---

## Task 10: Frontend — DayCell Component

**Files:**
- Create: `frontend/src/components/planning/DayCell.tsx`

**Step 1: Create the day cell component**

Used by all three zoom levels with different sizes. Handles mouse events for drag selection.

```typescript
import { memo } from 'react'

interface DayCellProps {
  date: string  // YYYY-MM-DD
  dayNumber: number
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  holidayLabel?: string
  customDayLabel?: string
  compact?: boolean  // true for quarter/year views
  onMouseDown?: (date: string) => void
  onMouseEnter?: (date: string) => void
  onClick?: (date: string) => void
}

export const DayCell = memo(function DayCell({
  date,
  dayNumber,
  isToday,
  isCurrentMonth,
  isSelected,
  holidayLabel,
  customDayLabel,
  compact = false,
  onMouseDown,
  onMouseEnter,
  onClick,
}: DayCellProps) {
  const label = holidayLabel || customDayLabel

  if (compact) {
    return (
      <div
        className={`w-full aspect-square flex items-center justify-center text-xs rounded-sm cursor-pointer
          ${isCurrentMonth ? 'text-cloud-700' : 'text-cloud-300'}
          ${isToday ? 'ring-2 ring-indigo-500 ring-inset font-bold' : ''}
          ${isSelected ? 'bg-indigo-100' : ''}
          ${holidayLabel ? 'font-semibold text-red-600' : ''}
          ${customDayLabel ? 'font-semibold text-amber-600' : ''}
        `}
        onClick={() => onClick?.(date)}
        title={label}
      >
        {dayNumber}
      </div>
    )
  }

  return (
    <div
      className={`min-h-[5rem] p-1.5 border-b border-r border-cloud-100 cursor-pointer select-none transition-colors
        ${isCurrentMonth ? 'bg-white' : 'bg-cloud-50/50'}
        ${isSelected ? 'bg-indigo-50' : ''}
        hover:bg-cloud-50
      `}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown?.(date)
      }}
      onMouseEnter={() => onMouseEnter?.(date)}
    >
      <span
        className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full
          ${isToday ? 'bg-indigo-600 text-white font-bold' : ''}
          ${!isToday && isCurrentMonth ? 'text-cloud-800' : ''}
          ${!isToday && !isCurrentMonth ? 'text-cloud-400' : ''}
        `}
      >
        {dayNumber}
      </span>
      {label && (
        <p className={`text-[10px] leading-tight mt-0.5 truncate ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
          {label}
        </p>
      )}
    </div>
  )
})
```

**Step 2: Commit**

```bash
git add frontend/src/components/planning/DayCell.tsx
git commit -m "feat: add DayCell component for planning center calendar grid"
```

---

## Task 11: Frontend — TripSpan Component

**Files:**
- Create: `frontend/src/components/planning/TripSpan.tsx`

**Step 1: Create the trip span component**

Renders a colored horizontal bar representing a trip's date range on the month grid.

```typescript
import type { TripStatus } from '../../lib/types'

const TRIP_COLORS: Record<string, string> = {
  dreaming: 'bg-purple-200 text-purple-800 hover:bg-purple-300',
  planning: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  booked: 'bg-green-200 text-green-800 hover:bg-green-300',
  active: 'bg-orange-200 text-orange-800 hover:bg-orange-300',
  completed: 'bg-cloud-200 text-cloud-600 hover:bg-cloud-300',
}

interface TripSpanProps {
  destination: string
  status: TripStatus
  /** Column index (0-6) where the span starts in this row */
  startCol: number
  /** Number of columns the span covers in this row */
  colSpan: number
  /** Vertical offset for stacking overlapping trips */
  stackIndex: number
  onClick: () => void
}

export function TripSpan({
  destination,
  status,
  startCol,
  colSpan,
  stackIndex,
  onClick,
}: TripSpanProps) {
  const colorClasses = TRIP_COLORS[status] || TRIP_COLORS.planning

  return (
    <button
      type="button"
      className={`absolute left-0 h-5 rounded-sm text-[11px] font-medium px-1.5 truncate cursor-pointer transition-colors ${colorClasses}`}
      style={{
        gridColumnStart: startCol + 1,
        gridColumnEnd: startCol + colSpan + 1,
        top: `${2.5 + stackIndex * 1.5}rem`,
        width: `${(colSpan / 7) * 100}%`,
        marginLeft: `${(startCol / 7) * 100}%`,
      }}
      onClick={onClick}
      title={destination}
    >
      {destination}
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planning/TripSpan.tsx
git commit -m "feat: add TripSpan component for trip bars on calendar grid"
```

---

## Task 12: Frontend — PlanSidebar Container + Content Components

**Files:**
- Create: `frontend/src/components/planning/PlanSidebar.tsx`
- Create: `frontend/src/components/planning/SidebarTripDetail.tsx`
- Create: `frontend/src/components/planning/SidebarTripCreate.tsx`
- Create: `frontend/src/components/planning/SidebarHolidayDetail.tsx`
- Create: `frontend/src/components/planning/SidebarCustomDayForm.tsx`

**Step 1: Create PlanSidebar.tsx**

Slide-in container that animates from the right:

```typescript
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface PlanSidebarProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function PlanSidebar({ isOpen, onClose, children }: PlanSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/10 md:hidden"
          onClick={onClose}
        />
      )}
      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-[350px] max-w-[90vw] bg-white border-l border-cloud-200 shadow-xl z-40
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex items-center justify-end p-4">
          <button
            onClick={onClose}
            className="p-1.5 text-cloud-400 hover:text-cloud-600 hover:bg-cloud-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {children}
        </div>
      </div>
    </>
  )
}
```

**Step 2: Create SidebarTripDetail.tsx**

```typescript
import { Link } from '@tanstack/react-router'
import { ArrowRight, Trash2 } from 'lucide-react'
import { TripStatusBadge } from '../trips/TripStatusBadge'
import type { TripSummary } from '../../lib/types'

interface SidebarTripDetailProps {
  trip: TripSummary
  onDelete: (tripId: string) => void
}

export function SidebarTripDetail({ trip, onDelete }: SidebarTripDetailProps) {
  const start = new Date(trip.start_date + 'T00:00:00')
  const end = new Date(trip.end_date + 'T00:00:00')
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-cloud-900">{trip.destination}</h3>
        <p className="text-sm text-cloud-500 mt-1">
          {trip.start_date} to {trip.end_date} ({days} days)
        </p>
      </div>

      <TripStatusBadge status={trip.status} />

      <div className="space-y-2 pt-2">
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          View Trip Details
          <ArrowRight className="w-4 h-4" />
        </Link>
        <button
          type="button"
          onClick={() => onDelete(trip.id)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Trip
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Create SidebarTripCreate.tsx**

```typescript
import { useState } from 'react'
import { LocationAutocomplete } from '../form/LocationAutocomplete'
import { useCreateTrip } from '../../hooks/useTrips'
import type { TripType, GeocodeSuggestion } from '../../lib/types'

interface SidebarTripCreateProps {
  startDate: string
  endDate: string
  onCreated: () => void
}

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'remote_week', label: 'Remote Week' },
  { value: 'sabbatical', label: 'Sabbatical' },
]

export function SidebarTripCreate({ startDate, endDate, onCreated }: SidebarTripCreateProps) {
  const [destination, setDestination] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [tripType, setTripType] = useState<TripType>('vacation')
  const createTrip = useCreateTrip()

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    setDestination(suggestion.place_name)
    setCoords({ lat: suggestion.latitude, lng: suggestion.longitude })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return

    await createTrip.mutateAsync({
      destination: destination.trim(),
      type: tripType,
      start_date: startDate,
      end_date: endDate,
      status: 'planning',
      destination_latitude: coords?.lat ?? null,
      destination_longitude: coords?.lng ?? null,
    })
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-cloud-900">New Trip</h3>
        <p className="text-sm text-cloud-500 mt-1">
          {startDate} to {endDate}
        </p>
      </div>

      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-cloud-700 mb-1">
          Destination
        </label>
        <LocationAutocomplete
          id="destination"
          value={destination}
          onChange={setDestination}
          onSelect={handleSelect}
          required
        />
      </div>

      <div>
        <label htmlFor="trip-type" className="block text-sm font-medium text-cloud-700 mb-1">
          Trip Type
        </label>
        <select
          id="trip-type"
          value={tripType}
          onChange={(e) => setTripType(e.target.value as TripType)}
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
        >
          {TRIP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={createTrip.isPending || !destination.trim()}
        className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {createTrip.isPending ? 'Creating...' : 'Create Trip'}
      </button>
    </form>
  )
}
```

**Step 4: Create SidebarHolidayDetail.tsx**

```typescript
interface SidebarHolidayDetailProps {
  name: string
  date: string
  countryCode: string
}

export function SidebarHolidayDetail({ name, date, countryCode }: SidebarHolidayDetailProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-cloud-900">{name}</h3>
      <p className="text-sm text-cloud-500">{date}</p>
      <p className="text-sm text-cloud-600">
        Federal Holiday ({countryCode})
      </p>
    </div>
  )
}
```

**Step 5: Create SidebarCustomDayForm.tsx**

```typescript
import { useState } from 'react'
import { useCreateCustomDay } from '../../hooks/useHolidays'

interface SidebarCustomDayFormProps {
  year: number
  onCreated: () => void
}

export function SidebarCustomDayForm({ year, onCreated }: SidebarCustomDayFormProps) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const createCustomDay = useCreateCustomDay(year)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !date) return

    await createCustomDay.mutateAsync({ name: name.trim(), date, recurring })
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-cloud-900">Add Custom Day</h3>

      <div>
        <label htmlFor="day-name" className="block text-sm font-medium text-cloud-700 mb-1">
          Name
        </label>
        <input
          id="day-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mom's birthday"
          required
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white placeholder:text-cloud-400 text-cloud-800"
        />
      </div>

      <div>
        <label htmlFor="day-date" className="block text-sm font-medium text-cloud-700 mb-1">
          Date
        </label>
        <input
          id="day-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-cloud-700">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="rounded border-cloud-300 text-indigo-600 focus:ring-indigo-500"
        />
        Recurring annually
      </label>

      <button
        type="submit"
        disabled={createCustomDay.isPending || !name.trim() || !date}
        className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {createCustomDay.isPending ? 'Adding...' : 'Add Day'}
      </button>
    </form>
  )
}
```

**Step 6: Commit**

```bash
git add frontend/src/components/planning/PlanSidebar.tsx frontend/src/components/planning/SidebarTripDetail.tsx frontend/src/components/planning/SidebarTripCreate.tsx frontend/src/components/planning/SidebarHolidayDetail.tsx frontend/src/components/planning/SidebarCustomDayForm.tsx
git commit -m "feat: add sidebar components for planning center"
```

---

## Task 13: Frontend — PlanningHeader Component

**Files:**
- Create: `frontend/src/components/planning/PlanningHeader.tsx`

**Step 1: Create the header component**

```typescript
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useSupportedCountries, useEnableCountry, useDisableCountry } from '../../hooks/useHolidays'
import type { HolidayCalendarEntry } from '../../lib/types'

export type ZoomLevel = 'month' | 'quarter' | 'year'

interface PlanningHeaderProps {
  zoomLevel: ZoomLevel
  onZoomChange: (level: ZoomLevel) => void
  /** For month: "February 2026", for quarter: "Q1 2026", for year: "2026" */
  periodLabel: string
  onPrev: () => void
  onNext: () => void
  year: number
  enabledCountries: HolidayCalendarEntry[]
  onAddCustomDay: () => void
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

export function PlanningHeader({
  zoomLevel,
  onZoomChange,
  periodLabel,
  onPrev,
  onNext,
  year,
  enabledCountries,
  onAddCustomDay,
}: PlanningHeaderProps) {
  const { data: supportedCountries } = useSupportedCountries()
  const enableCountry = useEnableCountry(year)
  const disableCountry = useDisableCountry(year)

  const enabledCodes = enabledCountries.map((c) => c.country_code)

  const handleCountryToggle = async (code: string) => {
    if (enabledCodes.includes(code)) {
      await disableCountry.mutateAsync(code)
    } else {
      await enableCountry.mutateAsync(code)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {/* Zoom toggle */}
        <div className="flex rounded-lg border border-cloud-200 overflow-hidden">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onZoomChange(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors
                ${zoomLevel === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-cloud-600 hover:bg-cloud-50'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-1.5 text-cloud-400 hover:text-cloud-600 hover:bg-cloud-100 rounded-lg transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-cloud-900 min-w-[10rem] text-center tabular-nums">
            {periodLabel}
          </span>
          <button
            onClick={onNext}
            className="p-1.5 text-cloud-400 hover:text-cloud-600 hover:bg-cloud-100 rounded-lg transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Country holiday toggles */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-cloud-500 mr-1">Holidays:</span>
          {supportedCountries?.slice(0, 5).map((c) => (
            <button
              key={c.code}
              onClick={() => handleCountryToggle(c.code)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors
                ${enabledCodes.includes(c.code)
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-cloud-100 text-cloud-500 hover:bg-cloud-200'
                }
              `}
            >
              {c.code}
            </button>
          ))}
        </div>

        {/* Add custom day */}
        <button
          onClick={onAddCustomDay}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Day
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planning/PlanningHeader.tsx
git commit -m "feat: add PlanningHeader with zoom toggle and holiday country picker"
```

---

## Task 14: Frontend — MonthView Component

**Files:**
- Create: `frontend/src/components/planning/MonthView.tsx`

**Step 1: Create the month view**

This is the most complex component. It builds a 7-column grid for a single month, overlays trip spans, and handles drag selection.

```typescript
import { useMemo } from 'react'
import { DayCell } from './DayCell'
import { TripSpan } from './TripSpan'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'
import type { DragSelection } from './useDragSelect'

interface MonthViewProps {
  year: number
  month: number  // 0-indexed (0 = January)
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  selection: DragSelection | null
  onDragStart: (date: string) => void
  onDragMove: (date: string) => void
  onTripClick: (trip: TripSummary) => void
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: { date: string; dayNumber: number; isCurrentMonth: boolean }[] = []

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    days.push({ date: formatDate(prevYear, prevMonth, d), dayNumber: d, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: formatDate(year, month, d), dayNumber: d, isCurrentMonth: true })
  }

  // Next month padding (fill to 6 rows)
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    days.push({ date: formatDate(nextYear, nextMonth, d), dayNumber: d, isCurrentMonth: false })
  }

  return days
}

export function MonthView({
  year,
  month,
  trips,
  holidays,
  customDays,
  selection,
  onDragStart,
  onDragMove,
  onTripClick,
}: MonthViewProps) {
  const today = new Date().toISOString().split('T')[0]
  const days = useMemo(() => getMonthGrid(year, month), [year, month])

  // Build lookup maps
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of holidays) {
      map.set(h.date, h.name)
    }
    return map
  }, [holidays])

  const customDayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cd of customDays) {
      // For recurring, map to this year's date
      const dateStr = cd.recurring
        ? `${year}-${cd.date.slice(5)}`
        : cd.date
      map.set(dateStr, cd.name)
    }
    return map
  }, [customDays, year])

  const isInSelection = (dateStr: string) => {
    if (!selection) return false
    return dateStr >= selection.startDate && dateStr <= selection.endDate
  }

  // Compute trip spans per week row
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const tripsInMonth = trips.filter((t) => {
    const monthStart = formatDate(year, month, 1)
    const monthEnd = formatDate(year, month, new Date(year, month + 1, 0).getDate())
    return t.start_date <= monthEnd && t.end_date >= monthStart
  })

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-cloud-200">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-medium text-cloud-500 uppercase">
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="relative">
          <div className="grid grid-cols-7">
            {week.map((day) => (
              <DayCell
                key={day.date}
                date={day.date}
                dayNumber={day.dayNumber}
                isToday={day.date === today}
                isCurrentMonth={day.isCurrentMonth}
                isSelected={isInSelection(day.date)}
                holidayLabel={holidayMap.get(day.date)}
                customDayLabel={customDayMap.get(day.date)}
                onMouseDown={onDragStart}
                onMouseEnter={onDragMove}
              />
            ))}
          </div>

          {/* Trip spans for this week */}
          {tripsInMonth.map((trip, tripIdx) => {
            const weekStart = week[0].date
            const weekEnd = week[6].date
            if (trip.start_date > weekEnd || trip.end_date < weekStart) return null

            const startCol = Math.max(0, week.findIndex((d) => d.date >= trip.start_date))
            const endCol = (() => {
              const idx = week.findIndex((d) => d.date > trip.end_date)
              return idx === -1 ? 7 : idx
            })()
            const colSpan = endCol - startCol

            if (colSpan <= 0) return null

            return (
              <TripSpan
                key={trip.id}
                destination={trip.destination}
                status={trip.status}
                startCol={startCol}
                colSpan={colSpan}
                stackIndex={tripIdx}
                onClick={() => onTripClick(trip)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planning/MonthView.tsx
git commit -m "feat: add MonthView component with trip spans and drag selection"
```

---

## Task 15: Frontend — QuarterView and YearView Components

**Files:**
- Create: `frontend/src/components/planning/QuarterView.tsx`
- Create: `frontend/src/components/planning/YearView.tsx`

**Step 1: Create QuarterView.tsx**

Shows 3 months side-by-side in condensed form.

```typescript
import { useMemo } from 'react'
import { DayCell } from './DayCell'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

interface QuarterViewProps {
  year: number
  quarter: number  // 0-3 (Q1-Q4)
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  onMonthClick: (month: number) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getMiniGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: { date: string; dayNumber: number; isCurrentMonth: boolean }[] = []
  for (let i = 0; i < startPadding; i++) {
    days.push({ date: '', dayNumber: 0, isCurrentMonth: false })
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: formatDate(year, month, d), dayNumber: d, isCurrentMonth: true })
  }
  return days
}

export function QuarterView({
  year,
  quarter,
  trips,
  holidays,
  customDays,
  onMonthClick,
}: QuarterViewProps) {
  const months = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2]
  const today = new Date().toISOString().split('T')[0]

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])
  const customDaySet = useMemo(() => {
    return new Set(customDays.map((cd) =>
      cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
    ))
  }, [customDays, year])

  const tripDates = useMemo(() => {
    const set = new Set<string>()
    for (const trip of trips) {
      const start = new Date(trip.start_date + 'T00:00:00')
      const end = new Date(trip.end_date + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(d.toISOString().split('T')[0])
      }
    }
    return set
  }, [trips])

  return (
    <div className="grid grid-cols-3 gap-6">
      {months.map((month) => {
        const days = getMiniGrid(year, month)
        return (
          <div key={month}>
            <button
              onClick={() => onMonthClick(month)}
              className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
            >
              {MONTH_NAMES[month]}
            </button>
            <div className="grid grid-cols-7 gap-px">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-cloud-400 pb-1">{d}</div>
              ))}
              {days.map((day, i) => {
                if (!day.isCurrentMonth) {
                  return <div key={i} className="aspect-square" />
                }
                return (
                  <DayCell
                    key={day.date}
                    date={day.date}
                    dayNumber={day.dayNumber}
                    isToday={day.date === today}
                    isCurrentMonth
                    isSelected={tripDates.has(day.date)}
                    holidayLabel={holidaySet.has(day.date) ? 'holiday' : undefined}
                    customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
                    compact
                    onClick={() => onMonthClick(month)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Create YearView.tsx**

```typescript
import { useMemo } from 'react'
import { DayCell } from './DayCell'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

interface YearViewProps {
  year: number
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  onMonthClick: (month: number) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getMiniGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: { date: string; dayNumber: number; isCurrentMonth: boolean }[] = []
  for (let i = 0; i < startPadding; i++) {
    days.push({ date: '', dayNumber: 0, isCurrentMonth: false })
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: formatDate(year, month, d), dayNumber: d, isCurrentMonth: true })
  }
  return days
}

export function YearView({
  year,
  trips,
  holidays,
  customDays,
  onMonthClick,
}: YearViewProps) {
  const today = new Date().toISOString().split('T')[0]

  const tripDates = useMemo(() => {
    const set = new Set<string>()
    for (const trip of trips) {
      const start = new Date(trip.start_date + 'T00:00:00')
      const end = new Date(trip.end_date + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(d.toISOString().split('T')[0])
      }
    }
    return set
  }, [trips])

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {MONTH_NAMES.map((name, month) => {
        const days = getMiniGrid(year, month)
        return (
          <div key={month}>
            <button
              onClick={() => onMonthClick(month)}
              className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
            >
              {name}
            </button>
            <div className="grid grid-cols-7 gap-px">
              {days.map((day, i) => {
                if (!day.isCurrentMonth) {
                  return <div key={i} className="aspect-square" />
                }
                return (
                  <DayCell
                    key={day.date}
                    date={day.date}
                    dayNumber={day.dayNumber}
                    isToday={day.date === today}
                    isCurrentMonth
                    isSelected={tripDates.has(day.date)}
                    holidayLabel={holidaySet.has(day.date) ? 'holiday' : undefined}
                    compact
                    onClick={() => onMonthClick(month)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/planning/QuarterView.tsx frontend/src/components/planning/YearView.tsx
git commit -m "feat: add QuarterView and YearView components"
```

---

## Task 16: Frontend — PlanningCenterPage

**Files:**
- Create: `frontend/src/pages/PlanningCenterPage.tsx`

**Step 1: Create the main page**

This is the orchestration component that manages zoom level, sidebar state, and drag selection.

```typescript
import { useState, useCallback } from 'react'
import { PlanningHeader, type ZoomLevel } from '../components/planning/PlanningHeader'
import { MonthView } from '../components/planning/MonthView'
import { QuarterView } from '../components/planning/QuarterView'
import { YearView } from '../components/planning/YearView'
import { PlanSidebar } from '../components/planning/PlanSidebar'
import { SidebarTripDetail } from '../components/planning/SidebarTripDetail'
import { SidebarTripCreate } from '../components/planning/SidebarTripCreate'
import { SidebarHolidayDetail } from '../components/planning/SidebarHolidayDetail'
import { SidebarCustomDayForm } from '../components/planning/SidebarCustomDayForm'
import { useDragSelect } from '../components/planning/useDragSelect'
import { useTrips, useDeleteTrip } from '../hooks/useTrips'
import { useHolidays } from '../hooks/useHolidays'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { TripSummary } from '../lib/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type SidebarContent =
  | { type: 'trip-detail'; trip: TripSummary }
  | { type: 'trip-create'; startDate: string; endDate: string }
  | { type: 'holiday'; name: string; date: string; countryCode: string }
  | { type: 'custom-day-form' }

export function PlanningCenterPage() {
  const now = new Date()
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month')
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [sidebarContent, setSidebarContent] = useState<SidebarContent | null>(null)

  const { selection, isDragging, onDragStart, onDragMove, onDragEnd, clearSelection } = useDragSelect()
  const { data: trips, isLoading: tripsLoading } = useTrips()
  const { data: holidayData, isLoading: holidaysLoading } = useHolidays(currentYear)
  const deleteTrip = useDeleteTrip()

  const currentQuarter = Math.floor(currentMonth / 3)

  const closeSidebar = useCallback(() => {
    setSidebarContent(null)
    clearSelection()
  }, [clearSelection])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    const result = onDragEnd()
    if (result && result.startDate !== result.endDate) {
      setSidebarContent({ type: 'trip-create', startDate: result.startDate, endDate: result.endDate })
    } else if (result) {
      setSidebarContent({ type: 'trip-create', startDate: result.startDate, endDate: result.startDate })
    }
  }, [isDragging, onDragEnd])

  const handleTripClick = useCallback((trip: TripSummary) => {
    setSidebarContent({ type: 'trip-detail', trip })
  }, [])

  const handleDeleteTrip = useCallback(async (tripId: string) => {
    await deleteTrip.mutateAsync(tripId)
    closeSidebar()
  }, [deleteTrip, closeSidebar])

  const handleMonthClick = useCallback((month: number) => {
    setCurrentMonth(month)
    setZoomLevel('month')
  }, [])

  // Navigation
  const handlePrev = () => {
    if (zoomLevel === 'month') {
      if (currentMonth === 0) {
        setCurrentMonth(11)
        setCurrentYear((y) => y - 1)
      } else {
        setCurrentMonth((m) => m - 1)
      }
    } else if (zoomLevel === 'quarter') {
      if (currentQuarter === 0) {
        setCurrentMonth(9) // Q4 of prev year
        setCurrentYear((y) => y - 1)
      } else {
        setCurrentMonth((currentQuarter - 1) * 3)
      }
    } else {
      setCurrentYear((y) => y - 1)
    }
  }

  const handleNext = () => {
    if (zoomLevel === 'month') {
      if (currentMonth === 11) {
        setCurrentMonth(0)
        setCurrentYear((y) => y + 1)
      } else {
        setCurrentMonth((m) => m + 1)
      }
    } else if (zoomLevel === 'quarter') {
      if (currentQuarter === 3) {
        setCurrentMonth(0) // Q1 of next year
        setCurrentYear((y) => y + 1)
      } else {
        setCurrentMonth((currentQuarter + 1) * 3)
      }
    } else {
      setCurrentYear((y) => y + 1)
    }
  }

  const periodLabel = (() => {
    if (zoomLevel === 'month') return `${MONTH_NAMES[currentMonth]} ${currentYear}`
    if (zoomLevel === 'quarter') return `Q${currentQuarter + 1} ${currentYear}`
    return String(currentYear)
  })()

  if (tripsLoading || holidaysLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  const allTrips = trips ?? []
  const allHolidays = holidayData?.holidays ?? []
  const allCustomDays = holidayData?.custom_days ?? []
  const enabledCountries = holidayData?.enabled_countries ?? []

  return (
    <div
      className="space-y-4"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <PlanningHeader
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        periodLabel={periodLabel}
        onPrev={handlePrev}
        onNext={handleNext}
        year={currentYear}
        enabledCountries={enabledCountries}
        onAddCustomDay={() => setSidebarContent({ type: 'custom-day-form' })}
      />

      <div className="bg-white rounded-2xl border border-cloud-200 shadow-sm overflow-hidden">
        {zoomLevel === 'month' && (
          <MonthView
            year={currentYear}
            month={currentMonth}
            trips={allTrips}
            holidays={allHolidays}
            customDays={allCustomDays}
            selection={selection}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onTripClick={handleTripClick}
          />
        )}
        {zoomLevel === 'quarter' && (
          <QuarterView
            year={currentYear}
            quarter={currentQuarter}
            trips={allTrips}
            holidays={allHolidays}
            customDays={allCustomDays}
            onMonthClick={handleMonthClick}
          />
        )}
        {zoomLevel === 'year' && (
          <YearView
            year={currentYear}
            trips={allTrips}
            holidays={allHolidays}
            customDays={allCustomDays}
            onMonthClick={handleMonthClick}
          />
        )}
      </div>

      <PlanSidebar isOpen={sidebarContent !== null} onClose={closeSidebar}>
        {sidebarContent?.type === 'trip-detail' && (
          <SidebarTripDetail
            trip={sidebarContent.trip}
            onDelete={handleDeleteTrip}
          />
        )}
        {sidebarContent?.type === 'trip-create' && (
          <SidebarTripCreate
            startDate={sidebarContent.startDate}
            endDate={sidebarContent.endDate}
            onCreated={closeSidebar}
          />
        )}
        {sidebarContent?.type === 'holiday' && (
          <SidebarHolidayDetail
            name={sidebarContent.name}
            date={sidebarContent.date}
            countryCode={sidebarContent.countryCode}
          />
        )}
        {sidebarContent?.type === 'custom-day-form' && (
          <SidebarCustomDayForm
            year={currentYear}
            onCreated={closeSidebar}
          />
        )}
      </PlanSidebar>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PlanningCenterPage.tsx
git commit -m "feat: add PlanningCenterPage with zoom levels and sidebar orchestration"
```

---

## Task 17: Frontend — Update Router and Remove Old Calendar Components

**Files:**
- Modify: `frontend/src/router.tsx` — point `/calendar` to PlanningCenterPage
- Delete: `frontend/src/pages/CalendarPage.tsx`
- Delete: `frontend/src/components/calendar/AnnualCalendar.tsx`
- Delete: `frontend/src/components/calendar/MonthGrid.tsx`
- Delete: `frontend/src/components/calendar/CreateBlockModal.tsx`

**Step 1: Update router.tsx**

Replace `CalendarPage` import with `PlanningCenterPage`:

```typescript
import { PlanningCenterPage } from './pages/PlanningCenterPage'

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: PlanningCenterPage,
})
```

**Step 2: Delete old files**

```bash
rm frontend/src/pages/CalendarPage.tsx
rm frontend/src/components/calendar/AnnualCalendar.tsx
rm frontend/src/components/calendar/MonthGrid.tsx
rm frontend/src/components/calendar/CreateBlockModal.tsx
```

**Step 3: Commit**

```bash
git rm frontend/src/pages/CalendarPage.tsx frontend/src/components/calendar/AnnualCalendar.tsx frontend/src/components/calendar/MonthGrid.tsx frontend/src/components/calendar/CreateBlockModal.tsx
git add frontend/src/router.tsx
git commit -m "refactor: replace CalendarPage with PlanningCenterPage, remove old calendar components"
```

---

## Task 18: Frontend — Update DevSeedPage

**Files:**
- Modify: `frontend/src/pages/DevSeedPage.tsx` — replace calendar seeding with holiday/custom day seeding

**Step 1: Update calendar seed logic**

Replace `seedCalendar` function: instead of creating annual plans and calendar blocks, enable US holiday calendar and create a few custom days.

Replace `calendarApi` calls with:
```typescript
// Enable US holidays
await calendarApi.enableCountry({ country_code: 'US', year: 2026 })

// Add custom days
const customDays = [
  { name: "Mom's Birthday", date: '2026-05-15', recurring: true },
  { name: 'Company Retreat', date: '2026-09-20', recurring: false },
  { name: 'Wedding Anniversary', date: '2026-08-01', recurring: true },
]
for (const day of customDays) {
  await calendarApi.createCustomDay(day)
}
```

Remove all references to `CreateAnnualPlan`, `CreateCalendarBlock`, `calendarApi.createPlan`, `calendarApi.createBlock`, `calendarApi.deleteBlock`.

Also update `clearAllData` to call the new API methods.

**Step 2: Commit**

```bash
git add frontend/src/pages/DevSeedPage.tsx
git commit -m "refactor: update DevSeedPage to use holiday/custom day API"
```

---

## Task 19: Frontend — Update Tests

**Files:**
- Delete: `frontend/src/__tests__/CalendarPage.test.tsx`
- Delete: `frontend/src/__tests__/useCalendar.test.ts`
- Create: `frontend/src/__tests__/PlanningCenterPage.test.tsx`
- Create: `frontend/src/__tests__/useHolidays.test.ts`

**Step 1: Write useHolidays tests**

Test: `useHolidays` fetches holidays, `useEnableCountry` calls API, `useDeleteCustomDay` calls API.

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getHolidays: (year: number) => mockGet('/calendar/holidays', { params: { year } }),
    getSupportedCountries: () => mockGet('/calendar/supported-countries'),
    enableCountry: (data: unknown) => mockPost('/calendar/holidays/country', data),
    disableCountry: (code: string, year: number) => mockDelete(`/calendar/holidays/country/${code}`, { params: { year } }),
    createCustomDay: (data: unknown) => mockPost('/calendar/custom-days', data),
    deleteCustomDay: (id: string) => mockDelete(`/calendar/custom-days/${id}`),
  },
}))

import { useHolidays, useEnableCountry, useCreateCustomDay } from '../hooks/useHolidays'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useHolidays', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches holidays for a year', async () => {
    const holidayData = {
      holidays: [{ date: '2026-01-01', name: "New Year's Day", country_code: 'US' }],
      custom_days: [],
      enabled_countries: [{ id: 'cal-1', country_code: 'US', year: 2026 }],
    }
    mockGet.mockResolvedValue({ data: holidayData })

    const { result } = renderHook(() => useHolidays(2026), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.holidays).toHaveLength(1)
  })
})

describe('useEnableCountry', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('enables a country calendar', async () => {
    mockPost.mockResolvedValue({ data: { id: 'cal-1', country_code: 'US', year: 2026 } })

    const { result } = renderHook(() => useEnableCountry(2026), { wrapper: createWrapper() })
    result.current.mutate('US')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/calendar/holidays/country', { country_code: 'US', year: 2026 })
  })
})

describe('useCreateCustomDay', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a custom day', async () => {
    mockPost.mockResolvedValue({ data: { id: 'cd-1', name: 'Birthday', date: '2026-05-15', recurring: true } })

    const { result } = renderHook(() => useCreateCustomDay(2026), { wrapper: createWrapper() })
    result.current.mutate({ name: 'Birthday', date: '2026-05-15', recurring: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

**Step 2: Write PlanningCenterPage tests**

Test: renders page with zoom toggle and month names, clicking Quarter changes view.

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { PlanningCenterPage } from '../pages/PlanningCenterPage'

const mockGet = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getHolidays: () => mockGet('/calendar/holidays'),
    getSupportedCountries: () => mockGet('/calendar/supported-countries'),
    enableCountry: vi.fn(),
    disableCountry: vi.fn(),
    createCustomDay: vi.fn(),
    deleteCustomDay: vi.fn(),
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
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute()
  const calRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/calendar',
    component: PlanningCenterPage,
  })
  const routeTree = rootRoute.addChildren([calRoute])
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

describe('PlanningCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: [] } })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'US' }] })
      }
      // trips
      return Promise.resolve({ data: [] })
    })
  })

  it('renders zoom toggle with Month, Quarter, Year', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument()
      expect(screen.getByText('Quarter')).toBeInTheDocument()
      expect(screen.getByText('Year')).toBeInTheDocument()
    })
  })

  it('shows day headers in month view', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument()
      expect(screen.getByText('Mon')).toBeInTheDocument()
    })
  })

  it('switches to year view on Year click', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Year'))

    // Year view shows all 12 month names
    await waitFor(() => {
      expect(screen.getByText('January')).toBeInTheDocument()
      expect(screen.getByText('December')).toBeInTheDocument()
    })
  })
})
```

**Step 3: Delete old test files and commit**

```bash
git rm frontend/src/__tests__/CalendarPage.test.tsx frontend/src/__tests__/useCalendar.test.ts
git add frontend/src/__tests__/PlanningCenterPage.test.tsx frontend/src/__tests__/useHolidays.test.ts
git commit -m "test: replace calendar page/hook tests with planning center tests"
```

---

## Task 20: Full Verification

**Step 1: Run backend checks**

Run: `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest`
Expected: all pass

**Step 2: Run frontend checks**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all pass

**Step 3: Fix any issues found in steps 1-2**

Iterate until all checks pass.

**Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve lint/type/test issues from planning center refactor"
```

---

## Task 21: E2E Browser Verification

Follow the E2E validation protocol from `.claude/rules/e2e-validation.md`:

**Step 1: Apply migration**

Run: `cd backend && uv run alembic upgrade head`

**Step 2: Start servers**

Run: `cd backend && uv run uvicorn travel_planner.main:app --port 8000`
Run: `cd frontend && npm run dev`

**Step 3: Browser verification with Playwright MCP**

1. Navigate to `http://localhost:5173/calendar`
2. Verify month view renders with day grid and zoom toggle
3. Click "Quarter" — verify 3 months appear
4. Click "Year" — verify 12 mini-months appear
5. Click "US" holiday toggle — verify holidays appear on the calendar
6. Click "+ Add Day" — verify sidebar opens with custom day form
7. Test drag-select on month view — verify sidebar opens with trip creation form
8. Navigate to `/dev/seed`, click "Seed Everything" — verify data seeds correctly
9. Return to `/calendar` — verify trips appear as colored spans

**Step 4: Check for errors**

Use `browser_console_messages` — verify zero errors.
Use `browser_network_requests` — verify no failed requests.

**Step 5: Clean up servers**

```bash
kill $(lsof -ti:8000) 2>/dev/null
kill $(lsof -ti:5173) 2>/dev/null
```
