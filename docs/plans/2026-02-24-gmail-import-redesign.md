# Gmail Import Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the per-trip Gmail scan with a centralized Settings-based scan that streams real-time progress via SSE, auto-matches emails to trips by date+location, and provides a unified accept/reject inbox with debug tooling.

**Architecture:** A `POST /gmail/scan` endpoint spawns an `asyncio.create_task` background worker that processes emails and writes `scan_events` rows to Postgres as it goes. A separate `GET /gmail/scan/{scan_id}/stream` SSE endpoint polls those rows every second and streams them to the frontend. The frontend opens a `fetch`-based SSE connection (not `EventSource`, which doesn't support auth headers) and renders per-email progress in real time.

**Tech Stack:** Python/FastAPI, `sse-starlette`, SQLAlchemy async, React/TypeScript, TanStack Query, native `fetch` for SSE

---

## Context: Codebase Conventions

- **Backend models** extend `Base, UUIDMixin` (and `TimestampMixin` for `created_at`). See `backend/src/travel_planner/models/base.py`.
- **Enums** use `enum.StrEnum` (e.g. `ActivityCategory`, `ImportStatus` in `models/itinerary.py`).
- **Auth** uses `CurrentUserId` dependency from `travel_planner.auth`. All router functions take `user_id: CurrentUserId`.
- **DB session** is injected via `db: AsyncSession = Depends(get_db)`.
- **Schemas** follow `XxxCreate` / `XxxResponse` naming, use `model_config = {"from_attributes": True}`.
- **Tests** use `pytest` with `TestClient` (sync), `override_get_db` fixture, `auth_headers` fixture. Mock DB calls with `mock_db_session.execute.side_effect = [...]`.
- **Frontend API** calls go through `api` axios instance in `lib/api.ts`, namespaced (e.g. `gmailApi`, `itineraryApi`).
- **Frontend hooks** use TanStack Query `useQuery`/`useMutation` with query key factories.
- **Alembic** migrations live in `backend/alembic/versions/`. Generate with `uv run alembic revision -m "desc"` then edit.

---

## Task 1: Install sse-starlette

**Files:**
- Modify: `backend/pyproject.toml`

**Step 1: Add the dependency**

```bash
cd backend && uv add sse-starlette
```

**Step 2: Verify import works**

```bash
cd backend && uv run python -c "from sse_starlette.sse import EventSourceResponse; print('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
cd backend && git add pyproject.toml uv.lock && git commit -m "chore: add sse-starlette dependency"
```

---

## Task 2: DB Migration — scan_runs, scan_events, unmatched_imports

**Files:**
- Create: `backend/alembic/versions/<hash>_add_scan_tables.py` (auto-generated)

**Step 1: Create the migration**

```bash
cd backend && uv run alembic revision -m "add scan_runs scan_events unmatched_imports"
```

**Step 2: Edit the generated file — add upgrade()**

Find the generated file in `backend/alembic/versions/` and replace `upgrade()` and `downgrade()` with:

```python
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    op.create_table(
        "scan_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emails_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unmatched_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rescan_rejected", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["user_id"], ["user_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_runs_user_id", "scan_runs", ["user_id"])

    op.create_table(
        "scan_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("scan_run_id", sa.UUID(), nullable=False),
        sa.Column("email_id", sa.String(255), nullable=False),
        sa.Column("gmail_subject", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("skip_reason", sa.String(50), nullable=True),
        sa.Column("trip_id", sa.UUID(), nullable=True),
        sa.Column("raw_claude_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["scan_run_id"], ["scan_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_events_scan_run_id", "scan_events", ["scan_run_id"])

    op.create_table(
        "unmatched_imports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("scan_run_id", sa.UUID(), nullable=False),
        sa.Column("email_id", sa.String(255), nullable=False),
        sa.Column("parsed_data", postgresql.JSONB(), nullable=False),
        sa.Column("assigned_trip_id", sa.UUID(), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user_profiles.id"]),
        sa.ForeignKeyConstraint(["scan_run_id"], ["scan_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_unmatched_imports_user_id", "unmatched_imports", ["user_id"])


def downgrade() -> None:
    op.drop_table("unmatched_imports")
    op.drop_table("scan_events")
    op.drop_table("scan_runs")
```

**Step 3: Apply the migration**

```bash
cd backend && uv run alembic upgrade head
```
Expected: `Running upgrade ... -> <hash>, add scan_runs scan_events unmatched_imports`

**Step 4: Commit**

```bash
cd backend && git add alembic/versions/ && git commit -m "feat: migration for scan_runs, scan_events, unmatched_imports"
```

---

## Task 3: SQLAlchemy Models

**Files:**
- Modify: `backend/src/travel_planner/models/gmail.py`

**Step 1: Add models to the existing gmail.py**

Append to the bottom of `backend/src/travel_planner/models/gmail.py`:

```python
import enum as _enum


class ScanRunStatus(_enum.StrEnum):
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class ScanEventStatus(_enum.StrEnum):
    imported = "imported"
    skipped = "skipped"
    unmatched = "unmatched"


class ScanEventSkipReason(_enum.StrEnum):
    no_text = "no_text"
    not_travel = "not_travel"
    no_date = "no_date"
    no_matching_trip = "no_matching_trip"
    ambiguous_trip = "ambiguous_trip"
    claude_error = "claude_error"


class ScanRun(Base, UUIDMixin):
    __tablename__ = "scan_runs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    status: Mapped[str] = mapped_column(String(20), default="running")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    emails_found: Mapped[int] = mapped_column(default=0)
    imported_count: Mapped[int] = mapped_column(default=0)
    skipped_count: Mapped[int] = mapped_column(default=0)
    unmatched_count: Mapped[int] = mapped_column(default=0)
    rescan_rejected: Mapped[bool] = mapped_column(default=False)


class ScanEvent(Base, UUIDMixin):
    __tablename__ = "scan_events"

    scan_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_runs.id", ondelete="CASCADE")
    )
    email_id: Mapped[str] = mapped_column(String(255))
    gmail_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    skip_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    raw_claude_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UnmatchedImport(Base, UUIDMixin):
    __tablename__ = "unmatched_imports"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    scan_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_runs.id", ondelete="CASCADE")
    )
    email_id: Mapped[str] = mapped_column(String(255))
    parsed_data: Mapped[dict] = mapped_column(JSONB)
    assigned_trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    dismissed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

You also need to add these imports at the top of the file (add to the existing imports):
```python
from sqlalchemy import Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
```
(Check existing imports in the file — `String`, `ForeignKey`, `UUID`, `DateTime` may already be there.)

**Step 2: Verify models import cleanly**

```bash
cd backend && uv run python -c "from travel_planner.models.gmail import ScanRun, ScanEvent, UnmatchedImport; print('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
cd backend && git add src/ && git commit -m "feat: add ScanRun, ScanEvent, UnmatchedImport ORM models"
```

---

## Task 4: Pydantic Schemas

**Files:**
- Modify: `backend/src/travel_planner/schemas/gmail.py`

**Step 1: Replace the entire file**

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GmailScanStart(BaseModel):
    rescan_rejected: bool = False


class ScanStartResponse(BaseModel):
    scan_id: UUID


class ScanRunResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    status: str
    started_at: datetime
    finished_at: datetime | None
    emails_found: int
    imported_count: int
    skipped_count: int
    unmatched_count: int
    rescan_rejected: bool


class UnmatchedImportResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    email_id: str
    parsed_data: dict
    created_at: datetime


class AssignUnmatchedBody(BaseModel):
    trip_id: UUID
```

**Step 2: Verify schemas import cleanly**

```bash
cd backend && uv run python -c "from travel_planner.schemas.gmail import GmailScanStart, ScanStartResponse, ScanRunResponse; print('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
cd backend && git add src/ && git commit -m "feat: update Gmail schemas for redesign"
```

---

## Task 5: Trip Matching Logic (Pure Function)

This is the core business logic — write it test-first.

**Files:**
- Create: `backend/src/travel_planner/routers/_gmail_matching.py`
- Test: `backend/tests/test_gmail_matching.py`

**Step 1: Write the failing tests**

Create `backend/tests/test_gmail_matching.py`:

```python
"""Tests for Gmail trip matching logic."""
from datetime import date
from unittest.mock import MagicMock

import pytest

from travel_planner.routers._gmail_matching import match_to_trip


def _make_trip(trip_id: str, destination: str, start: date, end: date) -> MagicMock:
    t = MagicMock()
    t.id = trip_id
    t.destination = destination
    t.start_date = start
    t.end_date = end
    return t


# ------- date matching -------

def test_single_date_match_returns_trip():
    """One trip whose range contains the parsed date → return that trip."""
    trips = [_make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22))]
    result = match_to_trip(parsed_date=date(2026, 3, 15), parsed_location="", trips=trips)
    assert result == "t1"


def test_no_date_match_returns_none():
    """No trip covers the parsed date → return None (unmatched)."""
    trips = [_make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22))]
    result = match_to_trip(parsed_date=date(2026, 7, 1), parsed_location="", trips=trips)
    assert result is None


def test_boundary_dates_match():
    """start_date and end_date are inclusive."""
    trips = [_make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22))]
    assert match_to_trip(date(2026, 3, 11), "", trips) == "t1"
    assert match_to_trip(date(2026, 3, 22), "", trips) == "t1"


# ------- multiple trips, location tiebreaker -------

def test_multiple_date_matches_location_tiebreaker():
    """Two trips overlap in date; location narrows it to one."""
    trips = [
        _make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22)),
        _make_trip("t2", "Austin, TX", date(2026, 3, 10), date(2026, 3, 20)),
    ]
    result = match_to_trip(date(2026, 3, 15), "Florida", trips)
    assert result == "t1"


def test_multiple_date_matches_ambiguous_returns_none():
    """Two trips overlap in date and location doesn't resolve it → None."""
    trips = [
        _make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22)),
        _make_trip("t2", "Miami, Florida", date(2026, 3, 10), date(2026, 3, 20)),
    ]
    result = match_to_trip(date(2026, 3, 15), "Florida", trips)
    assert result is None


def test_location_match_is_case_insensitive():
    """Location matching ignores case."""
    trips = [
        _make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22)),
        _make_trip("t2", "Austin", date(2026, 3, 10), date(2026, 3, 20)),
    ]
    result = match_to_trip(date(2026, 3, 15), "FLORIDA", trips)
    assert result == "t1"


def test_empty_trips_returns_none():
    """No trips at all → None."""
    result = match_to_trip(date(2026, 3, 15), "Florida", [])
    assert result is None
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_gmail_matching.py -v
```
Expected: `ModuleNotFoundError: No module named 'travel_planner.routers._gmail_matching'`

**Step 3: Implement the matching function**

Create `backend/src/travel_planner/routers/_gmail_matching.py`:

```python
"""Pure trip-matching logic for Gmail import.

Given a parsed booking date and location string, returns the single best-matching
trip ID, or None if ambiguous / no match.
"""
from datetime import date


def match_to_trip(
    parsed_date: date,
    parsed_location: str,
    trips: list,
) -> str | None:
    """Return trip.id of the best matching trip, or None if unmatched/ambiguous."""
    # Step 1: filter by date range
    date_matches = [
        t for t in trips
        if t.start_date and t.end_date
        and t.start_date <= parsed_date <= t.end_date
    ]

    if not date_matches:
        return None

    if len(date_matches) == 1:
        return str(date_matches[0].id)

    # Step 2: use location as tiebreaker (case-insensitive substring)
    if parsed_location:
        loc_lower = parsed_location.lower()
        location_matches = [
            t for t in date_matches
            if loc_lower in (t.destination or "").lower()
            or (t.destination or "").lower() in loc_lower
        ]
        if len(location_matches) == 1:
            return str(location_matches[0].id)

    # Ambiguous
    return None
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_gmail_matching.py -v
```
Expected: all 7 tests `PASSED`

**Step 5: Commit**

```bash
cd backend && git add src/ tests/ && git commit -m "feat: add trip matching logic with tests"
```

---

## Task 6: Background Scan Task

**Files:**
- Modify: `backend/src/travel_planner/routers/gmail.py`

**Step 1: Write a failing test for the scan run lifecycle**

Add to `backend/tests/test_gmail.py`:

```python
def test_post_scan_returns_scan_id(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/scan creates a scan_run and returns its ID."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from uuid import UUID

    # Mock gmail connection present
    conn_mock = MagicMock()
    conn_mock.scalar_one_or_none.return_value = _make_conn()

    # Mock no running scan
    running_mock = MagicMock()
    running_mock.scalar_one_or_none.return_value = None

    mock_db_session.execute.side_effect = [conn_mock, running_mock]

    import asyncio
    with patch("travel_planner.routers.gmail.asyncio.create_task"):
        response = client.post(
            "/gmail/scan",
            json={"rescan_rejected": False},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "scan_id" in data
    assert mock_db_session.add.called  # ScanRun was added


def test_post_scan_409_when_already_running(
    client, auth_headers, override_get_db, mock_db_session
):
    """POST /gmail/scan returns 409 when a scan is already running for user."""
    from unittest.mock import MagicMock
    from uuid import uuid4

    conn_mock = MagicMock()
    conn_mock.scalar_one_or_none.return_value = _make_conn()

    existing_scan = MagicMock()
    existing_scan.id = uuid4()
    running_mock = MagicMock()
    running_mock.scalar_one_or_none.return_value = existing_scan

    mock_db_session.execute.side_effect = [conn_mock, running_mock]

    response = client.post(
        "/gmail/scan",
        json={"rescan_rejected": False},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "scan_id" in response.json()
```

**Step 2: Run to verify they fail**

```bash
cd backend && uv run pytest tests/test_gmail.py::test_post_scan_returns_scan_id tests/test_gmail.py::test_post_scan_409_when_already_running -v
```
Expected: FAIL (endpoint doesn't exist yet / wrong signature)

**Step 3: Rewrite the scan router**

Replace the existing `scan_gmail` endpoint and add the new background task infrastructure in `backend/src/travel_planner/routers/gmail.py`.

Remove the old `@router.post("/scan")` endpoint entirely. Replace with:

```python
import asyncio
import uuid as _uuid
from datetime import UTC, datetime

from sse_starlette.sse import EventSourceResponse

from travel_planner.models.gmail import (
    GmailConnection, ImportRecord, ScanRun, ScanEvent, UnmatchedImport,
    ScanRunStatus, ScanEventStatus, ScanEventSkipReason,
)
from travel_planner.schemas.gmail import (
    GmailScanStart, ScanStartResponse, ScanRunResponse,
    UnmatchedImportResponse, AssignUnmatchedBody,
)


@router.post("/scan", response_model=ScanStartResponse)
async def start_scan(
    body: GmailScanStart,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> ScanStartResponse:
    """Start a background Gmail scan for all trips. Returns scan_id immediately."""
    # Verify Gmail connected
    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=400, detail="Gmail not connected")

    # 409 if already running
    result = await db.execute(
        select(ScanRun).where(
            ScanRun.user_id == user_id,
            ScanRun.status == ScanRunStatus.running,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"scan_id": str(existing.id)},
        )

    scan_run = ScanRun(
        user_id=user_id,
        rescan_rejected=body.rescan_rejected,
    )
    db.add(scan_run)
    await db.commit()
    await db.refresh(scan_run)

    # Spawn background task (runs in the same event loop)
    asyncio.create_task(
        _run_scan_background(scan_run.id, user_id, body.rescan_rejected)
    )

    return ScanStartResponse(scan_id=scan_run.id)
```

The actual `_run_scan_background` coroutine (add below the endpoint):

```python
async def _run_scan_background(
    scan_run_id: _uuid.UUID,
    user_id: _uuid.UUID,
    rescan_rejected: bool,
) -> None:
    """Background task: scan Gmail and write scan_events to DB."""
    from datetime import date as _date
    from travel_planner.db import async_session
    from travel_planner.models.itinerary import (
        Activity, ActivityCategory, ActivitySource, ImportStatus, ItineraryDay,
    )
    from travel_planner.models.trip import Trip, TripMember
    from travel_planner.routers._gmail_matching import match_to_trip

    async with async_session() as db:
        try:
            # Load scan_run
            result = await db.execute(select(ScanRun).where(ScanRun.id == scan_run_id))
            scan_run = result.scalar_one()

            # Load Gmail connection
            result = await db.execute(
                select(GmailConnection).where(GmailConnection.user_id == user_id)
            )
            conn = result.scalar_one_or_none()
            if conn is None:
                scan_run.status = ScanRunStatus.failed
                await db.commit()
                return

            # Load all user trips with date ranges
            result = await db.execute(
                select(Trip)
                .join(TripMember, TripMember.trip_id == Trip.id)
                .where(
                    TripMember.user_id == user_id,
                    Trip.start_date.isnot(None),
                    Trip.end_date.isnot(None),
                )
            )
            trips = result.scalars().all()

            # Load all itinerary days for those trips
            trip_ids = [t.id for t in trips]
            days_result = await db.execute(
                select(ItineraryDay).where(ItineraryDay.trip_id.in_(trip_ids))
            )
            all_days = days_result.scalars().all()
            days_by_trip_date: dict[tuple, ItineraryDay] = {
                (str(d.trip_id), d.date): d for d in all_days
            }

            # Load already-imported email IDs
            imp_result = await db.execute(
                select(ImportRecord.email_id).where(ImportRecord.user_id == user_id)
            )
            already_imported: set[str] = set(imp_result.scalars().all())

            # Optionally subtract rejected (if rescan_rejected, we re-process those)
            # ImportRecord has no "rejected" flag — rejected activities are deleted
            # but their ImportRecord stays. For rescan_rejected, we pass the flag
            # but don't remove from already_imported here; instead we check
            # whether the email has a live Activity linked to it (see scan loop).
            # Simple approach: when rescan_rejected=True, clear already_imported
            # so all emails get re-processed. Claude will deduplicate via
            # activity-level checks.
            if rescan_rejected:
                already_imported = set()

            # Fetch emails from Gmail
            service = await _build_service(conn)
            msgs_result = await asyncio.to_thread(
                lambda: (
                    service.users()
                    .messages()
                    .list(userId="me", q=TRAVEL_SEARCH, maxResults=50)
                    .execute()
                )
            )
            messages = msgs_result.get("messages", [])
            scan_run.emails_found = len(messages)
            await db.commit()

            imported = skipped = unmatched = 0

            for meta in messages:
                # Check cancellation
                await db.refresh(scan_run)
                if scan_run.status == ScanRunStatus.cancelled:
                    break

                email_id = meta["id"]

                if email_id in already_imported:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.not_travel,  # already done
                    ))
                    await db.commit()
                    continue

                # Fetch full message
                try:
                    msg = await asyncio.to_thread(
                        lambda eid=email_id: (
                            service.users()
                            .messages()
                            .get(userId="me", id=eid, format="full")
                            .execute()
                        )
                    )
                except Exception:
                    skipped += 1
                    continue

                # Extract subject for display
                headers = {
                    h["name"].lower(): h["value"]
                    for h in msg.get("payload", {}).get("headers", [])
                }
                subject = headers.get("subject")

                content = _extract_text(msg)
                if not content:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.no_text,
                    ))
                    await db.commit()
                    continue

                try:
                    parsed = await _parse_with_claude(content)
                except Exception:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.claude_error,
                    ))
                    await db.commit()
                    continue

                if parsed is None:
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.not_travel,
                    ))
                    await db.commit()
                    continue

                try:
                    activity_date = _date.fromisoformat(parsed.get("date", ""))
                except (ValueError, TypeError):
                    skipped += 1
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.skipped,
                        skip_reason=ScanEventSkipReason.no_date,
                        raw_claude_json=parsed,
                    ))
                    await db.commit()
                    continue

                matched_trip_id = match_to_trip(
                    parsed_date=activity_date,
                    parsed_location=parsed.get("location") or "",
                    trips=trips,
                )

                if matched_trip_id is None:
                    unmatched += 1
                    db.add(UnmatchedImport(
                        user_id=user_id,
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        parsed_data=parsed,
                    ))
                    db.add(ScanEvent(
                        scan_run_id=scan_run_id,
                        email_id=email_id,
                        gmail_subject=subject,
                        status=ScanEventStatus.unmatched,
                        raw_claude_json=parsed,
                    ))
                    await db.commit()
                    continue

                # Find the itinerary day for this trip + date
                day = days_by_trip_date.get((matched_trip_id, activity_date))
                if day is None:
                    # Day exists in trip range but no ItineraryDay row — create it
                    day = ItineraryDay(
                        trip_id=_uuid.UUID(matched_trip_id),
                        date=activity_date,
                    )
                    db.add(day)
                    await db.flush()

                try:
                    category = ActivityCategory(parsed.get("category", "activity"))
                except ValueError:
                    category = ActivityCategory.activity

                db.add(ImportRecord(
                    user_id=user_id,
                    email_id=email_id,
                    parsed_data=parsed,
                ))
                db.add(Activity(
                    itinerary_day_id=day.id,
                    title=parsed.get("title", "Imported booking"),
                    category=category,
                    location=parsed.get("location"),
                    confirmation_number=parsed.get("confirmation_number"),
                    notes=parsed.get("notes"),
                    source=ActivitySource.gmail_import,
                    source_ref=email_id,
                    import_status=ImportStatus.pending_review,
                    sort_order=999,
                ))
                db.add(ScanEvent(
                    scan_run_id=scan_run_id,
                    email_id=email_id,
                    gmail_subject=subject,
                    status=ScanEventStatus.imported,
                    trip_id=_uuid.UUID(matched_trip_id),
                    raw_claude_json=parsed,
                ))
                imported += 1
                await db.commit()

            # Finalize scan_run
            scan_run.imported_count = imported
            scan_run.skipped_count = skipped
            scan_run.unmatched_count = unmatched
            if scan_run.status != ScanRunStatus.cancelled:
                scan_run.status = ScanRunStatus.completed
            scan_run.finished_at = datetime.now(tz=UTC)
            await db.commit()
            logger.info(
                "Scan %s complete: imported=%d skipped=%d unmatched=%d",
                scan_run_id, imported, skipped, unmatched,
            )

        except Exception:
            logger.exception("Scan %s failed", scan_run_id)
            try:
                await db.execute(
                    sa_update(ScanRun)
                    .where(ScanRun.id == scan_run_id)
                    .values(status=ScanRunStatus.failed, finished_at=datetime.now(tz=UTC))
                )
                await db.commit()
            except Exception:
                pass
```

You'll need to add this import at the top of `gmail.py`:
```python
from sqlalchemy import update as sa_update
```

**Step 4: Run the tests**

```bash
cd backend && uv run pytest tests/test_gmail.py::test_post_scan_returns_scan_id tests/test_gmail.py::test_post_scan_409_when_already_running -v
```
Expected: both `PASSED`

**Step 5: Run all Gmail tests to ensure nothing is broken**

```bash
cd backend && uv run pytest tests/test_gmail.py -v
```
Expected: all pass

**Step 6: Commit**

```bash
cd backend && git add src/ tests/ && git commit -m "feat: background scan task with per-email scan_events"
```

---

## Task 7: SSE Stream Endpoint

SSE uses `sse-starlette`. Since `EventSource` in the browser doesn't support custom headers, the frontend will pass the JWT as a `?token=` query parameter for this endpoint only.

**Files:**
- Modify: `backend/src/travel_planner/routers/gmail.py`

**Step 1: Write a failing test**

Add to `backend/tests/test_gmail.py`:

```python
def test_scan_stream_404_for_unknown_scan(client, auth_headers, override_get_db, mock_db_session):
    """Streaming an unknown scan_id returns 404 when scan belongs to a different user."""
    from unittest.mock import MagicMock

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    response = client.get(
        "/gmail/scan/00000000-0000-0000-0000-000000000099/stream",
        headers=auth_headers,
    )
    assert response.status_code == 404
```

**Step 2: Run to verify it fails**

```bash
cd backend && uv run pytest tests/test_gmail.py::test_scan_stream_404_for_unknown_scan -v
```
Expected: FAIL (endpoint missing)

**Step 3: Add the stream endpoint**

Add to `backend/src/travel_planner/routers/gmail.py`:

```python
import json as _json_mod

@router.get("/scan/{scan_id}/stream")
async def stream_scan(
    scan_id: _uuid.UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """SSE stream of scan_events for a running or completed scan."""
    from travel_planner.db import async_session

    # Verify scan belongs to user before starting the SSE stream so that
    # a missing/unauthorised scan_id returns a proper 404 HTTP status.
    result = await db.execute(
        select(ScanRun).where(
            ScanRun.id == scan_id,
            ScanRun.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    async def event_generator():
        sent_ids: set[str] = set()

        async with async_session() as stream_db:
            result = await stream_db.execute(
                select(ScanRun).where(ScanRun.id == scan_id)
            )
            scan_run = result.scalar_one_or_none()
            if scan_run is None:
                return

            while True:
                await stream_db.refresh(scan_run)

                # Fetch new events
                query = select(ScanEvent).where(
                    ScanEvent.scan_run_id == scan_id,
                    ScanEvent.id.not_in(sent_ids) if sent_ids else True,
                ).order_by(ScanEvent.created_at)
                result = await stream_db.execute(query)
                new_events = result.scalars().all()

                for ev in new_events:
                    sent_ids.add(str(ev.id))
                    payload = {
                        "email_id": ev.email_id,
                        "subject": ev.gmail_subject,
                        "status": ev.status,
                        "skip_reason": ev.skip_reason,
                        "trip_id": str(ev.trip_id) if ev.trip_id else None,
                        "raw_claude_json": ev.raw_claude_json,
                    }
                    yield {"event": "progress", "data": _json_mod.dumps(payload)}

                if scan_run.status in (
                    ScanRunStatus.completed,
                    ScanRunStatus.failed,
                    ScanRunStatus.cancelled,
                ):
                    summary = {
                        "imported": scan_run.imported_count,
                        "skipped": scan_run.skipped_count,
                        "unmatched": scan_run.unmatched_count,
                        "status": scan_run.status,
                    }
                    yield {"event": "done", "data": _json_mod.dumps(summary)}
                    break

                await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
```

**Step 4: Run the test**

```bash
cd backend && uv run pytest tests/test_gmail.py::test_scan_stream_404_for_unknown_scan -v
```
Expected: `PASSED`

**Step 5: Run all backend tests**

```bash
cd backend && uv run pytest -v
```

**Step 6: Commit**

```bash
cd backend && git add src/ tests/ && git commit -m "feat: SSE stream endpoint for scan progress"
```

---

## Task 8: Inbox and Latest Endpoints

**Files:**
- Modify: `backend/src/travel_planner/routers/gmail.py`

**Step 1: Write failing tests**

Add to `backend/tests/test_gmail.py`:

```python
def test_get_inbox_returns_grouped_pending_and_unmatched(
    client, auth_headers, override_get_db, mock_db_session
):
    """GET /gmail/inbox returns pending activities grouped by trip and unmatched list."""
    from unittest.mock import MagicMock
    from travel_planner.models.itinerary import ActivitySource, ImportStatus

    pending_activity = MagicMock()
    pending_activity.id = "act-1"
    pending_activity.itinerary_day_id = "day-1"
    pending_activity.title = "Flight AA123"
    pending_activity.category = "transport"
    pending_activity.start_time = None
    pending_activity.end_time = None
    pending_activity.location = "JFK"
    pending_activity.latitude = None
    pending_activity.longitude = None
    pending_activity.notes = None
    pending_activity.confirmation_number = "XYZ"
    pending_activity.sort_order = 999
    pending_activity.check_out_date = None
    pending_activity.source = ActivitySource.gmail_import
    pending_activity.source_ref = "email123"
    pending_activity.import_status = ImportStatus.pending_review
    from datetime import datetime, UTC
    pending_activity.created_at = datetime(2026, 3, 1, tzinfo=UTC)
    # trip_id comes from the itinerary_day join
    pending_activity.trip_id = "trip-1"
    pending_activity.trip_destination = "Florida"

    unmatched = MagicMock()
    unmatched.id = "um-1"
    unmatched.email_id = "email456"
    unmatched.parsed_data = {"title": "Hotel Boston", "date": "2026-04-10"}
    from datetime import datetime, UTC
    unmatched.created_at = datetime(2026, 3, 1, tzinfo=UTC)

    # DB calls: 1 for pending activities with trip join, 1 for unmatched
    pending_r = MagicMock()
    pending_r.all.return_value = [(pending_activity, "trip-1", "Florida")]

    unmatched_r = MagicMock()
    unmatched_r.scalars.return_value.all.return_value = [unmatched]

    mock_db_session.execute.side_effect = [pending_r, unmatched_r]

    response = client.get("/gmail/inbox", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "pending" in data
    assert "unmatched" in data


def test_get_scan_latest_returns_most_recent(
    client, auth_headers, override_get_db, mock_db_session
):
    """GET /gmail/scan/latest returns the most recent scan_run."""
    from unittest.mock import MagicMock
    from uuid import uuid4
    from datetime import datetime, UTC

    scan = MagicMock()
    scan.id = uuid4()
    scan.status = "completed"
    scan.started_at = datetime(2026, 2, 24, tzinfo=UTC)
    scan.finished_at = datetime(2026, 2, 24, tzinfo=UTC)
    scan.emails_found = 50
    scan.imported_count = 3
    scan.skipped_count = 45
    scan.unmatched_count = 2
    scan.rescan_rejected = False

    r = MagicMock()
    r.scalar_one_or_none.return_value = scan
    mock_db_session.execute.return_value = r

    response = client.get("/gmail/scan/latest", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 3
    assert data["status"] == "completed"
```

**Step 2: Run to verify they fail**

```bash
cd backend && uv run pytest tests/test_gmail.py::test_get_inbox_returns_grouped_pending_and_unmatched tests/test_gmail.py::test_get_scan_latest_returns_most_recent -v
```
Expected: both FAIL

**Step 3: Implement the endpoints**

Add to `backend/src/travel_planner/routers/gmail.py`:

```python
@router.get("/scan/latest", response_model=ScanRunResponse | None)
async def get_latest_scan(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> ScanRun | None:
    result = await db.execute(
        select(ScanRun)
        .where(ScanRun.user_id == user_id)
        .order_by(ScanRun.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/inbox")
async def get_inbox(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from travel_planner.models.itinerary import Activity, ImportStatus, ItineraryDay
    from travel_planner.models.trip import Trip
    from travel_planner.schemas.itinerary import ActivityResponse

    # Pending activities with trip info
    result = await db.execute(
        select(Activity, ItineraryDay.trip_id, Trip.destination)
        .join(ItineraryDay, Activity.itinerary_day_id == ItineraryDay.id)
        .join(Trip, ItineraryDay.trip_id == Trip.id)
        .join(TripMember, TripMember.trip_id == Trip.id)
        .where(
            TripMember.user_id == user_id,
            Activity.import_status == ImportStatus.pending_review,
        )
        .order_by(Trip.id, Activity.sort_order)
    )
    rows = result.all()

    # Group by trip
    from collections import defaultdict
    grouped: dict[str, dict] = defaultdict(lambda: {"trip_destination": "", "activities": []})
    for activity, trip_id, destination in rows:
        key = str(trip_id)
        grouped[key]["trip_id"] = key
        grouped[key]["trip_destination"] = destination
        grouped[key]["activities"].append(ActivityResponse.model_validate(activity).model_dump(mode="json"))

    # Unmatched
    unmatched_result = await db.execute(
        select(UnmatchedImport)
        .where(
            UnmatchedImport.user_id == user_id,
            UnmatchedImport.assigned_trip_id.is_(None),
            UnmatchedImport.dismissed_at.is_(None),
        )
        .order_by(UnmatchedImport.created_at.desc())
    )
    unmatched = [
        UnmatchedImportResponse.model_validate(u).model_dump(mode="json")
        for u in unmatched_result.scalars().all()
    ]

    return {"pending": list(grouped.values()), "unmatched": unmatched}


@router.post("/inbox/unmatched/{unmatched_id}/assign", status_code=201)
async def assign_unmatched(
    unmatched_id: _uuid.UUID,
    body: AssignUnmatchedBody,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from travel_planner.models.itinerary import (
        Activity, ActivityCategory, ActivitySource, ImportStatus, ItineraryDay,
    )
    from travel_planner.deps import get_trip_with_membership
    from datetime import date as _date

    result = await db.execute(
        select(UnmatchedImport).where(
            UnmatchedImport.id == unmatched_id,
            UnmatchedImport.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")

    # Verify the authenticated user is a member of the target trip before
    # creating any itinerary resources — raises 404/403 if not authorised.
    await get_trip_with_membership(body.trip_id, user_id, db)

    parsed = item.parsed_data
    try:
        activity_date = _date.fromisoformat(parsed.get("date", ""))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Cannot determine activity date")

    # Find or create itinerary day
    day_result = await db.execute(
        select(ItineraryDay).where(
            ItineraryDay.trip_id == body.trip_id,
            ItineraryDay.date == activity_date,
        )
    )
    day = day_result.scalar_one_or_none()
    if day is None:
        day = ItineraryDay(trip_id=body.trip_id, date=activity_date)
        db.add(day)
        await db.flush()

    try:
        category = ActivityCategory(parsed.get("category", "activity"))
    except ValueError:
        category = ActivityCategory.activity

    db.add(ImportRecord(user_id=user_id, email_id=item.email_id, parsed_data=parsed))
    db.add(Activity(
        itinerary_day_id=day.id,
        title=parsed.get("title", "Imported booking"),
        category=category,
        location=parsed.get("location"),
        confirmation_number=parsed.get("confirmation_number"),
        notes=parsed.get("notes"),
        source=ActivitySource.gmail_import,
        source_ref=item.email_id,
        import_status=ImportStatus.pending_review,
        sort_order=999,
    ))

    item.assigned_trip_id = body.trip_id
    await db.commit()
    return {"status": "assigned"}


@router.delete("/inbox/unmatched/{unmatched_id}", status_code=204)
async def dismiss_unmatched(
    unmatched_id: _uuid.UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(UnmatchedImport).where(
            UnmatchedImport.id == unmatched_id,
            UnmatchedImport.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Not found")

    # Create ImportRecord so it won't re-appear on next scan
    db.add(ImportRecord(user_id=user_id, email_id=item.email_id, parsed_data=item.parsed_data))
    item.dismissed_at = datetime.now(tz=UTC)
    await db.commit()
```

Also add `TripMember` import at the top of the router:
```python
from travel_planner.models.trip import TripMember
```

**Step 4: Run the new tests**

```bash
cd backend && uv run pytest tests/test_gmail.py::test_get_inbox_returns_grouped_pending_and_unmatched tests/test_gmail.py::test_get_scan_latest_returns_most_recent -v
```

**Step 5: Run all backend tests**

```bash
cd backend && uv run pytest -v
```

**Step 6: Commit**

```bash
cd backend && git add src/ tests/ && git commit -m "feat: add inbox, latest scan, and unmatched assignment endpoints"
```

---

## Task 9: Remove Old Trip-Scoped Scan + Run Full Lint

**Files:**
- Modify: `backend/src/travel_planner/routers/gmail.py`
- Modify: `backend/src/travel_planner/schemas/gmail.py`

**Step 1: Delete `GmailScanCreate` from schemas** (already replaced by `GmailScanStart` in Task 4)

**Step 2: Remove the old `scan_gmail` function** from `gmail.py` (the one that accepted `trip_id`). It has been replaced by the new `start_scan` + `_run_scan_background` pair.

**Step 3: Run linting**

```bash
cd backend && uv run ruff check . && uv run ruff format --check .
```
Fix any issues, then:
```bash
cd backend && uv run ruff check . --fix && uv run ruff format .
```

**Step 4: Run type check**

```bash
cd backend && uv run pyright
```

**Step 5: Run all tests**

```bash
cd backend && uv run pytest -v
```

**Step 6: Commit**

```bash
cd backend && git add src/ tests/ && git commit -m "refactor: remove trip-scoped scan, finalize backend lint"
```

---

## Task 10: Frontend — API Layer

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/types.ts`

**Step 1: Add types to `types.ts`**

Add to `frontend/src/lib/types.ts`:

```typescript
export interface ScanRun {
  id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  finished_at: string | null
  emails_found: number
  imported_count: number
  skipped_count: number
  unmatched_count: number
  rescan_rejected: boolean
}

export interface ScanProgressEvent {
  email_id: string
  subject: string | null
  status: 'imported' | 'skipped' | 'unmatched'
  skip_reason: string | null
  trip_id: string | null
  raw_claude_json: Record<string, unknown> | null
}

export interface UnmatchedImport {
  id: string
  email_id: string
  parsed_data: {
    title?: string
    category?: string
    date?: string
    location?: string
    confirmation_number?: string
  }
  created_at: string
}

export interface GmailInbox {
  pending: Array<{
    trip_id: string
    trip_destination: string
    activities: Activity[]
  }>
  unmatched: UnmatchedImport[]
}
```

**Step 2: Update `gmailApi` in `api.ts`**

Replace the existing `gmailApi` object with:

```typescript
export const gmailApi = {
  getStatus: () =>
    api
      .get<{ connected: boolean; last_sync_at: string | null }>('/gmail/status')
      .then((r) => r.data),

  getAuthUrl: (tripId?: string) =>
    api
      .get<{ url: string }>('/gmail/auth-url', {
        params: tripId ? { trip_id: tripId } : undefined,
      })
      .then((r) => r.data),

  disconnect: () => api.delete('/gmail/disconnect'),

  startScan: (rescanRejected = false) =>
    api
      .post<{ scan_id: string }>('/gmail/scan', { rescan_rejected: rescanRejected })
      .then((r) => r.data),

  getLatestScan: () =>
    api.get<ScanRun | null>('/gmail/scan/latest').then((r) => r.data),

  getInbox: () =>
    api.get<GmailInbox>('/gmail/inbox').then((r) => r.data),

  assignUnmatched: (unmatchedId: string, tripId: string) =>
    api
      .post(`/gmail/inbox/unmatched/${unmatchedId}/assign`, { trip_id: tripId })
      .then((r) => r.data),

  dismissUnmatched: (unmatchedId: string) =>
    api.delete(`/gmail/inbox/unmatched/${unmatchedId}`),
}
```

Note: The SSE stream connection is NOT done through axios — it uses `fetch` directly. That's handled in the hook (Task 11).

**Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

**Step 4: Commit**

```bash
cd frontend && git add src/lib/ && git commit -m "feat: update Gmail API types and methods"
```

---

## Task 11: Frontend — useGmail Hook

**Files:**
- Modify: `frontend/src/hooks/useGmail.ts`

**Step 1: Rewrite the hook file**

```typescript
import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gmailApi, itineraryApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { ScanProgressEvent, ScanRun } from '../lib/types'
import { itineraryKeys } from './useItinerary'
import { tripKeys } from './useTrips'

export const gmailKeys = {
  status: ['gmail', 'status'] as const,
  latestScan: ['gmail', 'latestScan'] as const,
  inbox: ['gmail', 'inbox'] as const,
}

export function useGmailStatus() {
  return useQuery({
    queryKey: gmailKeys.status,
    queryFn: gmailApi.getStatus,
  })
}

export function useLatestScan() {
  return useQuery({
    queryKey: gmailKeys.latestScan,
    queryFn: gmailApi.getLatestScan,
  })
}

export function useGmailInbox() {
  return useQuery({
    queryKey: gmailKeys.inbox,
    queryFn: gmailApi.getInbox,
  })
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: gmailApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.status })
    },
  })
}

export function useConfirmImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (activityId: string) =>
      itineraryApi.updateActivity(activityId, { import_status: 'confirmed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useRejectImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (activityId: string) => itineraryApi.deleteActivity(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useAssignUnmatched() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unmatchedId, tripId }: { unmatchedId: string; tripId: string }) =>
      gmailApi.assignUnmatched(unmatchedId, tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useDismissUnmatched() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (unmatchedId: string) => gmailApi.dismissUnmatched(unmatchedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
    },
  })
}

// SSE-based scan hook
export interface ScanState {
  scanId: string | null
  isRunning: boolean
  events: ScanProgressEvent[]
  summary: { imported: number; skipped: number; unmatched: number } | null
  error: string | null
  emailsFound: number
}

export function useGmailScan() {
  const queryClient = useQueryClient()
  const abortRef = useRef<AbortController | null>(null)
  const [state, setState] = useState<ScanState>({
    scanId: null,
    isRunning: false,
    events: [],
    summary: null,
    error: null,
    emailsFound: 0,
  })

  const startScan = useCallback(async (rescanRejected = false) => {
    setState({ scanId: null, isRunning: true, events: [], summary: null, error: null, emailsFound: 0 })

    try {
      const { scan_id } = await gmailApi.startScan(rescanRejected)
      setState((s) => ({ ...s, scanId: scan_id }))

      // Get token for SSE auth
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      abortRef.current = new AbortController()
      const response = await fetch(
        `/api/gmail/scan/${scan_id}/stream`,
        {
          signal: abortRef.current.signal,
          headers: { 'Authorization': `Bearer ${token}` },
        }
      )

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = ''
        let dataLine = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            dataLine = line.slice(6).trim()
          } else if (line === '' && dataLine) {
            try {
              const payload = JSON.parse(dataLine)
              if (eventType === 'progress') {
                setState((s) => ({
                  ...s,
                  events: [...s.events, payload as ScanProgressEvent],
                }))
              } else if (eventType === 'done') {
                setState((s) => ({ ...s, isRunning: false, summary: payload }))
                queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
                queryClient.invalidateQueries({ queryKey: gmailKeys.latestScan })
              } else if (eventType === 'error') {
                setState((s) => ({ ...s, isRunning: false, error: payload.code }))
              }
            } catch {
              // ignore parse errors
            }
            eventType = ''
            dataLine = ''
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setState((s) => ({ ...s, isRunning: false, error: 'scan_failed' }))
    }
  }, [queryClient])

  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
    setState((s) => ({ ...s, isRunning: false }))
  }, [])

  return { state, startScan, cancelScan }
}

// Legacy — kept for trip detail banner (pending count only)
export function usePendingImportCount(tripId: string) {
  const { data: inbox } = useGmailInbox()
  const group = inbox?.pending.find((g) => g.trip_id === tripId)
  return group?.activities.length ?? 0
}
```

**Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
cd frontend && git add src/hooks/ && git commit -m "feat: rewrite useGmail hook with SSE scan support"
```

---

## Task 12: GmailScanPanel Component

This component handles the scan trigger + real-time progress feed inside Settings.

**Files:**
- Create: `frontend/src/components/gmail/GmailScanPanel.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import { useGmailScan } from '../../hooks/useGmail'
import type { ScanProgressEvent } from '../../lib/types'

interface GmailScanPanelProps {
  onScanComplete: () => void
}

function EventRow({ event, debug }: { event: ScanProgressEvent; debug: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const colorClass =
    event.status === 'imported'
      ? 'text-green-700'
      : event.status === 'unmatched'
      ? 'text-amber-700'
      : 'text-cloud-400'

  const label =
    event.status === 'imported'
      ? event.subject ?? event.email_id
      : `${event.subject ?? event.email_id} — ${event.skip_reason ?? 'skipped'}`

  return (
    <div className="text-xs">
      <div
        className={`flex items-center gap-1 py-0.5 ${colorClass} ${debug ? 'cursor-pointer hover:underline' : ''}`}
        onClick={() => debug && setExpanded((e) => !e)}
      >
        {debug && (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
        <span className="truncate">{label}</span>
      </div>
      {debug && expanded && (
        <pre className="mt-1 p-2 bg-cloud-50 rounded text-xs text-cloud-700 overflow-auto max-h-40">
          {JSON.stringify(
            { skip_reason: event.skip_reason, parsed: event.raw_claude_json },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  )
}

export function GmailScanPanel({ onScanComplete }: GmailScanPanelProps) {
  const [rescanRejected, setRescanRejected] = useState(false)
  const [debug, setDebug] = useState(false)
  const { state, startScan, cancelScan } = useGmailScan()

  const handleStart = async () => {
    await startScan(rescanRejected)
    onScanComplete()
  }

  if (!state.isRunning && !state.summary && !state.error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleStart}
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Scan all trips
          </button>
          <label className="flex items-center gap-2 text-sm text-cloud-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rescanRejected}
              onChange={(e) => setRescanRejected(e.target.checked)}
              className="rounded"
            />
            Include previously rejected
          </label>
          <label className="flex items-center gap-2 text-sm text-cloud-600 cursor-pointer">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
              className="rounded"
            />
            Show debug log
          </label>
        </div>
      </div>
    )
  }

  const total = state.events.length
  const emailsFound = state.emailsFound ?? total

  return (
    <div className="space-y-3">
      {state.isRunning && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-cloud-600">
            <Loader2 size={14} className="animate-spin" />
            <span>
              {total} / {emailsFound > 0 ? emailsFound : '?'} emails processed
            </span>
          </div>
          <button
            onClick={cancelScan}
            className="flex items-center gap-1 text-xs text-cloud-500 hover:text-red-600 transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
        </div>
      )}

      {state.summary && (
        <p className="text-sm text-cloud-600">
          Done — {state.summary.imported} imported, {state.summary.skipped} skipped
          {state.summary.unmatched > 0 && `, ${state.summary.unmatched} need assignment`}
        </p>
      )}

      {state.error && (
        <p className="text-sm text-red-600">
          {state.error === 'gmail_auth_failed'
            ? 'Gmail disconnected — please reconnect'
            : 'Scan failed — try again'}
        </p>
      )}

      <div className="max-h-48 overflow-y-auto space-y-0.5 border border-cloud-100 rounded-lg p-2 bg-cloud-50">
        {state.events.map((ev, i) => (
          <EventRow key={i} event={ev} debug={debug} />
        ))}
        {state.events.length === 0 && (
          <p className="text-xs text-cloud-400 italic">Waiting for emails...</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
cd frontend && git add src/components/ && git commit -m "feat: GmailScanPanel component with SSE progress feed"
```

---

## Task 13: GmailInbox Component

**Files:**
- Create: `frontend/src/components/gmail/GmailInbox.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import {
  useGmailInbox,
  useConfirmImport,
  useRejectImport,
  useAssignUnmatched,
  useDismissUnmatched,
} from '../../hooks/useGmail'
import { useTrips } from '../../hooks/useTrips'
import type { Activity, UnmatchedImport } from '../../lib/types'

function PendingActivityRow({ activity }: { activity: Activity }) {
  const confirmMutation = useConfirmImport()
  const rejectMutation = useRejectImport()

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
      <div className="min-w-0">
        <p className="text-sm font-medium text-cloud-800 truncate">{activity.title}</p>
        <p className="text-xs text-cloud-500 capitalize">
          {activity.category}
          {activity.confirmation_number ? ` · ${activity.confirmation_number}` : ''}
        </p>
      </div>
      <div className="flex gap-2 shrink-0 ml-3">
        <button
          onClick={() => confirmMutation.mutate(activity.id)}
          disabled={confirmMutation.isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={12} />
          Accept
        </button>
        <button
          onClick={() => rejectMutation.mutate(activity.id)}
          disabled={rejectMutation.isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          <XCircle size={12} />
          Reject
        </button>
      </div>
    </div>
  )
}

function UnmatchedRow({ item }: { item: UnmatchedImport }) {
  const [tripId, setTripId] = useState('')
  const assignMutation = useAssignUnmatched()
  const dismissMutation = useDismissUnmatched()
  const { data: trips = [] } = useTrips()

  return (
    <div className="py-2 px-3 rounded-lg bg-cloud-50 border border-cloud-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-cloud-800 truncate">
            {item.parsed_data.title ?? 'Unknown booking'}
          </p>
          <p className="text-xs text-cloud-500">
            {item.parsed_data.category ?? 'unknown'}
            {item.parsed_data.date ? ` · ${item.parsed_data.date}` : ''}
            {item.parsed_data.location ? ` · ${item.parsed_data.location}` : ''}
          </p>
        </div>
        <HelpCircle size={14} className="text-cloud-400 shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <select
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="flex-1 text-xs border border-cloud-200 rounded px-2 py-1 bg-white text-cloud-700"
        >
          <option value="">Assign to trip...</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.destination}
              {t.start_date ? ` (${t.start_date})` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => assignMutation.mutate({ unmatchedId: item.id, tripId })}
          disabled={!tripId || assignMutation.isPending}
          className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Assign
        </button>
        <button
          onClick={() => dismissMutation.mutate(item.id)}
          disabled={dismissMutation.isPending}
          className="text-xs px-2 py-1 text-cloud-500 hover:text-cloud-700 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export function GmailInbox() {
  const { data: inbox, isLoading } = useGmailInbox()

  if (isLoading) return null

  const hasPending = (inbox?.pending.length ?? 0) > 0
  const hasUnmatched = (inbox?.unmatched.length ?? 0) > 0

  if (!hasPending && !hasUnmatched) {
    return (
      <p className="text-sm text-cloud-400 italic">All caught up — no imports pending</p>
    )
  }

  return (
    <div className="space-y-5">
      {hasPending && (
        <div>
          <h3 className="text-xs font-semibold text-cloud-600 uppercase tracking-wide mb-2">
            Pending review
          </h3>
          <div className="space-y-4">
            {inbox!.pending.map((group) => (
              <div key={group.trip_id}>
                <p className="text-xs font-medium text-cloud-700 mb-1.5">
                  {group.trip_destination}
                </p>
                <div className="space-y-1.5">
                  {group.activities.map((a) => (
                    <PendingActivityRow key={a.id} activity={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasUnmatched && (
        <div>
          <h3 className="text-xs font-semibold text-cloud-600 uppercase tracking-wide mb-2">
            Needs trip assignment
          </h3>
          <div className="space-y-1.5">
            {inbox!.unmatched.map((item) => (
              <UnmatchedRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
cd frontend && git add src/components/ && git commit -m "feat: GmailInbox component with pending review and unmatched assignment"
```

---

## Task 14: Settings Page Gmail Section Redesign

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

**Step 1: Rewrite the Gmail section in SettingsPage**

Replace the existing Gmail card (the `{/* Integrations */}` block) with:

```typescript
import { useGmailStatus, useDisconnectGmail, useLatestScan } from '../hooks/useGmail'
import { GmailScanPanel } from '../components/gmail/GmailScanPanel'
import { GmailInbox } from '../components/gmail/GmailInbox'
import { gmailApi } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { gmailKeys } from '../hooks/useGmail'

// Inside the component:
const queryClient = useQueryClient()
const { data: latestScan } = useLatestScan()

// Last scan summary line:
const lastScanSummary = latestScan
  ? `Last scan: ${new Date(latestScan.started_at).toLocaleString()} — ${latestScan.imported_count} imported, ${latestScan.skipped_count} skipped`
  : null

// Replace the Gmail card JSX:
<div className="bg-white rounded-xl shadow-sm border border-cloud-200 p-6">
  <h2 className="text-lg font-semibold text-cloud-900 mb-4 flex items-center gap-2">
    <Mail className="w-4 h-4" />
    Gmail Import
  </h2>

  {/* Connection row */}
  <div className="flex items-center justify-between mb-4">
    <div>
      <p className="text-sm font-medium text-cloud-800">
        {gmailStatus?.connected ? 'Connected' : 'Not connected'}
      </p>
      {lastScanSummary && (
        <p className="text-xs text-cloud-500 mt-0.5">{lastScanSummary}</p>
      )}
      {!gmailStatus?.connected && (
        <p className="text-xs text-cloud-500 mt-0.5">
          Connect to import travel bookings from confirmation emails
        </p>
      )}
    </div>
    {gmailStatus?.connected ? (
      <button
        onClick={() => disconnectMutation.mutate()}
        disabled={disconnectMutation.isPending}
        className="text-sm px-3 py-1.5 border border-cloud-300 rounded-lg text-cloud-600 hover:bg-cloud-50 disabled:opacity-50 transition-colors"
      >
        {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
      </button>
    ) : (
      <button
        onClick={handleConnectGmail}
        className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Connect Gmail
      </button>
    )}
  </div>

  {/* Scan controls + progress */}
  {gmailStatus?.connected && (
    <>
      <div className="border-t border-cloud-100 pt-4 mb-4">
        <GmailScanPanel
          onScanComplete={() => {
            queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
            queryClient.invalidateQueries({ queryKey: gmailKeys.latestScan })
          }}
        />
      </div>

      {/* Inbox */}
      <div className="border-t border-cloud-100 pt-4">
        <GmailInbox />
      </div>
    </>
  )}
</div>
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
cd frontend && git add src/pages/ && git commit -m "feat: redesign Settings Gmail section with scan panel and inbox"
```

---

## Task 15: Simplify Trip Detail Gmail Banner

**Files:**
- Modify: `frontend/src/components/trips/GmailImportSection.tsx`

**Step 1: Rewrite to a simple banner**

```typescript
import { Mail } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useGmailStatus, usePendingImportCount } from '../../hooks/useGmail'

interface GmailImportSectionProps {
  tripId: string
}

export function GmailImportSection({ tripId }: GmailImportSectionProps) {
  const { data: status } = useGmailStatus()
  const pendingCount = usePendingImportCount(tripId)

  if (!status?.connected) return null

  return (
    <div className="mt-8 border-t border-cloud-100 pt-4">
      <Link
        to="/settings"
        className="flex items-center gap-2 text-xs text-cloud-500 hover:text-indigo-600 transition-colors"
      >
        <Mail size={12} />
        {pendingCount > 0
          ? `${pendingCount} pending Gmail import${pendingCount !== 1 ? 's' : ''} · Review in Settings`
          : 'Gmail connected · Scan all trips in Settings'}
      </Link>
    </div>
  )
}
```

**Step 2: TypeScript check + lint**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

**Step 3: Commit**

```bash
cd frontend && git add src/components/ && git commit -m "refactor: simplify GmailImportSection to settings link banner"
```

---

## Task 16: Frontend Tests

**Files:**
- Create: `frontend/src/__tests__/gmailInbox.test.tsx`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GmailInbox } from '../components/gmail/GmailInbox'
import * as gmailHooks from '../hooks/useGmail'
import * as tripHooks from '../hooks/useTrips'

vi.mock('../hooks/useGmail')
vi.mock('../hooks/useTrips')

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('GmailInbox', () => {
  beforeEach(() => {
    vi.mocked(tripHooks.useTrips).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof tripHooks.useTrips>)
  })

  it('shows empty state when no pending or unmatched', () => {
    vi.mocked(gmailHooks.useGmailInbox).mockReturnValue({
      data: { pending: [], unmatched: [] },
      isLoading: false,
    } as ReturnType<typeof gmailHooks.useGmailInbox>)
    vi.mocked(gmailHooks.useConfirmImport).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useConfirmImport>)
    vi.mocked(gmailHooks.useRejectImport).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useRejectImport>)
    vi.mocked(gmailHooks.useAssignUnmatched).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useAssignUnmatched>)
    vi.mocked(gmailHooks.useDismissUnmatched).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useDismissUnmatched>)

    render(<GmailInbox />, { wrapper })
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })

  it('renders pending activities grouped by trip', () => {
    vi.mocked(gmailHooks.useConfirmImport).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useConfirmImport>)
    vi.mocked(gmailHooks.useRejectImport).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useRejectImport>)
    vi.mocked(gmailHooks.useAssignUnmatched).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useAssignUnmatched>)
    vi.mocked(gmailHooks.useDismissUnmatched).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useDismissUnmatched>)

    vi.mocked(gmailHooks.useGmailInbox).mockReturnValue({
      data: {
        pending: [{
          trip_id: 't1',
          trip_destination: 'Florida',
          activities: [{
            id: 'a1', title: 'Flight AA123', category: 'transport',
            itinerary_day_id: 'd1', start_time: null, end_time: null,
            location: null, latitude: null, longitude: null, notes: null,
            confirmation_number: null, sort_order: 999, check_out_date: null,
            source: 'gmail_import', source_ref: 'e1',
            import_status: 'pending_review',
            created_at: '2026-01-01T00:00:00Z',
          }],
        }],
        unmatched: [],
      },
      isLoading: false,
    } as ReturnType<typeof gmailHooks.useGmailInbox>)

    render(<GmailInbox />, { wrapper })
    expect(screen.getByText('Flight AA123')).toBeInTheDocument()
    expect(screen.getByText('Florida')).toBeInTheDocument()
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('renders unmatched imports with assign and dismiss buttons', () => {
    vi.mocked(gmailHooks.useConfirmImport).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useConfirmImport>)
    vi.mocked(gmailHooks.useRejectImport).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useRejectImport>)
    vi.mocked(gmailHooks.useAssignUnmatched).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useAssignUnmatched>)
    vi.mocked(gmailHooks.useDismissUnmatched).mockReturnValue({ mutate: vi.fn(), isPending: false } as ReturnType<typeof gmailHooks.useDismissUnmatched>)

    vi.mocked(gmailHooks.useGmailInbox).mockReturnValue({
      data: {
        pending: [],
        unmatched: [{
          id: 'um1',
          email_id: 'e2',
          parsed_data: { title: 'Marriott Boston', category: 'lodging', date: '2026-04-10', location: 'Boston' },
          created_at: '2026-01-01T00:00:00Z',
        }],
      },
      isLoading: false,
    } as ReturnType<typeof gmailHooks.useGmailInbox>)

    render(<GmailInbox />, { wrapper })
    expect(screen.getByText('Marriott Boston')).toBeInTheDocument()
    expect(screen.getByText('Assign')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests**

```bash
cd frontend && npx vitest run src/__tests__/gmailInbox.test.tsx
```
Expected: all pass

**Step 3: Run all frontend tests**

```bash
cd frontend && npx vitest run
```

**Step 4: Commit**

```bash
cd frontend && git add src/__tests__/ && git commit -m "test: Gmail inbox component tests"
```

---

## Task 17: Final Checks and PR

**Step 1: Full backend check**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest -v
```

**Step 2: Full frontend check**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

**Step 3: Create PR**

```bash
/create-pr
```
