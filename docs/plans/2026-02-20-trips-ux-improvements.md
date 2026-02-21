# Trips UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Five independent UX improvements: show all member avatars on trip cards, sort trips by date, show per-category booking status on trip cards, fix cross-day drag-and-drop reliability, and add hotel check-out date display.

**Architecture:** Tasks 1–3 are backend-first (schema/query changes) with frontend display updates. Task 4 is frontend-only (DnD architecture fix). Task 5 spans backend (new DB column + migration) and frontend (form + display). All tasks are independent and can be committed separately.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query + @dnd-kit/core (frontend), Alembic (migrations), pytest + vitest

---

## Test Commands

```bash
# Backend
cd /Users/nick/Code/travel-planner/backend && uv run pytest

# Frontend unit tests
cd /Users/nick/Code/travel-planner/frontend && npx vitest run

# TypeScript check
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit

# Backend lint
cd /Users/nick/Code/travel-planner/backend && uv run ruff check . && uv run ruff format --check .

# Frontend lint
cd /Users/nick/Code/travel-planner/frontend && npm run lint
```

---

## Task 1: Show all member avatars (remove top-3 cap)

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py` (line ~216: `sorted_members[:3]`)
- Modify: `frontend/src/components/trips/TripCard.tsx` (member avatar section)
- Test: `backend/tests/test_trips.py`

### Context

The backend currently sends only the top 3 member previews (`sorted_members[:3]`). The frontend shows those 3 plus a "+N" chip when `member_count > 3`. The fix is to send all member previews from the backend and remove the overflow chip.

### Step 1: Write the failing backend test

In `backend/tests/test_trips.py`, find the existing `test_list_trips_includes_member_previews` test. Add a new test immediately after it:

```python
@pytest.mark.asyncio
async def test_list_trips_returns_all_member_previews(client, auth_headers, mock_db_session):
    """All member previews are returned, not just the first 3."""
    # Create 5 members
    members = [_make_member(user_id=uuid.uuid4(), role=MemberRole.owner if i == 0 else MemberRole.member)
               for i in range(5)]
    for m in members:
        m.user = _make_user_profile(m.user_id, f"User {i}", f"user{i}@test.com")
    trip = _make_trip(members=members)

    mock_db_session.execute = AsyncMock(side_effect=[
        _make_scalar_result([trip]),
        _make_scalar_result([]),  # stats query returns nothing
    ])

    response = await client.get("/api/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data[0]["member_previews"]) == 5
```

> **Note:** The existing test fixtures in `test_trips.py` use helpers like `_make_trip`, `_make_member`, `_make_user_profile`. Look at how they're used in existing tests — replicate the same pattern exactly.

### Step 2: Run the test to verify it fails

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_trips.py::test_list_trips_returns_all_member_previews -v
```

Expected: FAIL (currently only 3 previews returned)

### Step 3: Fix the backend — remove the [:3] slice

In `backend/src/travel_planner/routers/trips.py`, find this line (around line 216):

```python
for m in sorted_members[:3]
```

Change it to:

```python
for m in sorted_members
```

### Step 4: Run the test to verify it passes

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_trips.py::test_list_trips_returns_all_member_previews -v
```

Expected: PASS

### Step 5: Update TripCard frontend to remove overflow chip

In `frontend/src/components/trips/TripCard.tsx`, find the member avatar section. Currently it looks like:

```tsx
{member_previews.map((m, i) => (
  <div key={i} ...>
    <span ...>{m.initials}</span>
  </div>
))}
{member_count > 3 && (
  <div className="w-7 h-7 rounded-full bg-cloud-200 border-2 border-white flex items-center justify-center">
    <span className="text-[10px] font-medium text-cloud-600">
      +{member_count - 3}
    </span>
  </div>
)}
```

Remove the `{member_count > 3 && (...)}` block entirely. The `member_previews.map(...)` now covers all members so no overflow chip is needed.

### Step 6: Run all tests

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
```

Expected: All pass

### Step 7: Commit

```bash
git add backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py frontend/src/components/trips/TripCard.tsx
git commit -m "feat: show all member avatars on trip card"
```

---

## Task 2: Sort trips by start date

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py` (the `list_trips` query)
- Test: `backend/tests/test_trips.py`

### Context

`list_trips` currently returns trips in DB insertion order. Add `.order_by(Trip.start_date)` to return soonest trip first.

### Step 1: Write the failing test

In `backend/tests/test_trips.py`, add:

```python
@pytest.mark.asyncio
async def test_list_trips_ordered_by_start_date(client, auth_headers, mock_db_session):
    """Trips are returned sorted by start_date ascending."""
    import datetime
    trip_a = _make_trip()
    trip_a.start_date = datetime.date(2027, 6, 1)
    trip_b = _make_trip()
    trip_b.start_date = datetime.date(2026, 3, 1)

    mock_db_session.execute = AsyncMock(side_effect=[
        _make_scalar_result([trip_a, trip_b]),  # DB returns a before b
        _make_scalar_result([]),  # stats
    ])

    response = await client.get("/api/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Earlier date should be first
    assert data[0]["start_date"] == "2026-03-01"
    assert data[1]["start_date"] == "2027-06-01"
```

> **Note:** The mock returns trips in a fixed order. Since sorting happens in the SQL query (which the mock bypasses), this test validates the query construction by checking the SQL statement, OR you can test it as an integration concern and instead just verify the endpoint works. If the mock approach can't test DB ordering, skip this test and test it manually. See note below.

> **Alternative approach if the mock can't verify SQL ORDER BY:** Instead of the above test, add a simpler smoke test that just verifies the endpoint still returns 200 with a start_date field in the expected format after the change. The actual sort order is guaranteed by the DB query.

### Step 2: Add ORDER BY to the query

In `backend/src/travel_planner/routers/trips.py`, find the `list_trips` function. The query currently ends with:

```python
stmt = (
    select(Trip)
    .join(TripMember)
    .where(TripMember.user_id == user_id)
    .options(selectinload(Trip.members).joinedload(TripMember.user))
)
if status is not None:
    stmt = stmt.where(Trip.status == status)
```

Add `.order_by(Trip.start_date)` at the end of the base query:

```python
stmt = (
    select(Trip)
    .join(TripMember)
    .where(TripMember.user_id == user_id)
    .options(selectinload(Trip.members).joinedload(TripMember.user))
    .order_by(Trip.start_date)
)
```

### Step 3: Run all tests

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
```

Expected: All pass

### Step 4: Commit

```bash
git add backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py
git commit -m "feat: sort trips by start date ascending"
```

---

## Task 3: Activity booking status on TripCard

**Files:**
- Modify: `backend/src/travel_planner/schemas/trip.py` — add booking stat fields to `TripSummary`
- Modify: `backend/src/travel_planner/routers/trips.py` — extend bulk stats query
- Modify: `frontend/src/lib/types.ts` — add new fields to `TripSummary`
- Modify: `frontend/src/components/trips/TripCard.tsx` — render booking status row
- Test: `backend/tests/test_trips.py`

### Context

Show a compact row on each TripCard with how many flights/hotels/activities have a `confirmation_number`. Use the existing bulk stats query pattern (no N+1). Categories: `transport` = flights, `lodging` = hotels, `activity` = activities. `food` is excluded from the card display.

### Step 1: Write the failing backend test

In `backend/tests/test_trips.py`, add:

```python
@pytest.mark.asyncio
async def test_list_trips_includes_booking_stats(client, auth_headers, mock_db_session):
    """TripSummary includes per-category booking counts."""
    trip = _make_trip()
    # Stats mock row: (trip_id, day_count, active_count, transport_total, transport_confirmed,
    #                   lodging_total, lodging_confirmed, activity_total, activity_confirmed)
    stats_row = MagicMock()
    stats_row.trip_id = trip.id
    stats_row.day_count = 3
    stats_row.active_count = 2
    stats_row.transport_total = 2
    stats_row.transport_confirmed = 1
    stats_row.lodging_total = 1
    stats_row.lodging_confirmed = 1
    stats_row.activity_total = 4
    stats_row.activity_confirmed = 2

    mock_db_session.execute = AsyncMock(side_effect=[
        _make_scalar_result([trip]),
        _make_rows_result([stats_row]),
    ])

    response = await client.get("/api/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()[0]
    assert data["transport_total"] == 2
    assert data["transport_confirmed"] == 1
    assert data["lodging_total"] == 1
    assert data["lodging_confirmed"] == 1
    assert data["activity_total"] == 4
    assert data["activity_confirmed"] == 2
```

> **Note:** Look at how the existing `_make_rows_result` helper or `_make_scalar_result` is defined in `conftest.py` or `test_trips.py`. If there's no rows-result helper, use the same MagicMock pattern as the existing stats test.

### Step 2: Run the test to verify it fails

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_trips.py::test_list_trips_includes_booking_stats -v
```

Expected: FAIL (fields not yet in schema)

### Step 3: Add fields to TripSummary schema

In `backend/src/travel_planner/schemas/trip.py`, find the `TripSummary` class. Add six new optional fields with defaults:

```python
class TripSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: TripType
    destination: str
    start_date: date
    end_date: date
    status: TripStatus
    notes: str | None
    destination_latitude: float | None
    destination_longitude: float | None
    parent_trip_id: UUID | None
    created_at: datetime
    member_count: int
    member_previews: list[MemberPreview] = []
    itinerary_day_count: int = 0
    days_with_activities: int = 0
    # New booking stat fields:
    transport_total: int = 0
    transport_confirmed: int = 0
    lodging_total: int = 0
    lodging_confirmed: int = 0
    activity_total: int = 0
    activity_confirmed: int = 0
```

### Step 4: Extend the bulk stats query in list_trips

In `backend/src/travel_planner/routers/trips.py`, find the `list_trips` function. It currently has a `stats_stmt` that counts `day_count` and `active_count`. Extend it to also count per-category totals and confirmations.

Replace the existing stats query block with:

```python
if trip_ids:
    activity_per_day = (
        select(
            Activity.itinerary_day_id,
            func.count(Activity.id).label("cnt"),
        )
        .group_by(Activity.itinerary_day_id)
        .subquery("activity_per_day")
    )
    stats_stmt = (
        select(
            ItineraryDay.trip_id,
            func.count(ItineraryDay.id).label("day_count"),
            func.count(activity_per_day.c.itinerary_day_id).label("active_count"),
            func.count(Activity.id).filter(Activity.category == "transport").label("transport_total"),
            func.count(Activity.id).filter(
                Activity.category == "transport",
                Activity.confirmation_number.isnot(None),
            ).label("transport_confirmed"),
            func.count(Activity.id).filter(Activity.category == "lodging").label("lodging_total"),
            func.count(Activity.id).filter(
                Activity.category == "lodging",
                Activity.confirmation_number.isnot(None),
            ).label("lodging_confirmed"),
            func.count(Activity.id).filter(Activity.category == "activity").label("activity_total"),
            func.count(Activity.id).filter(
                Activity.category == "activity",
                Activity.confirmation_number.isnot(None),
            ).label("activity_confirmed"),
        )
        .outerjoin(
            activity_per_day,
            activity_per_day.c.itinerary_day_id == ItineraryDay.id,
        )
        .outerjoin(Activity, Activity.itinerary_day_id == ItineraryDay.id)
        .where(ItineraryDay.trip_id.in_(trip_ids))
        .group_by(ItineraryDay.trip_id)
    )
    stats_result = await db.execute(stats_stmt)
    stats_map = {
        row.trip_id: row for row in stats_result
    }
```

Then update the `summaries.append(TripSummary(...))` call to include the new fields. Change the stats extraction from:

```python
day_count, active_count = stats_map.get(t.id, (0, 0))
```

To:

```python
row = stats_map.get(t.id)
day_count = row.day_count if row else 0
active_count = row.active_count if row else 0
transport_total = row.transport_total if row else 0
transport_confirmed = row.transport_confirmed if row else 0
lodging_total = row.lodging_total if row else 0
lodging_confirmed = row.lodging_confirmed if row else 0
activity_total = row.activity_total if row else 0
activity_confirmed = row.activity_confirmed if row else 0
```

And in `TripSummary(...)`:

```python
summaries.append(
    TripSummary(
        ...
        itinerary_day_count=day_count,
        days_with_activities=active_count,
        transport_total=transport_total,
        transport_confirmed=transport_confirmed,
        lodging_total=lodging_total,
        lodging_confirmed=lodging_confirmed,
        activity_total=activity_total,
        activity_confirmed=activity_confirmed,
    )
)
```

### Step 5: Run backend tests

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
```

Expected: All pass

### Step 6: Add fields to frontend TripSummary type

In `frontend/src/lib/types.ts`, find the `TripSummary` interface. Add:

```typescript
export interface TripSummary {
  // ... existing fields ...
  transport_total?: number
  transport_confirmed?: number
  lodging_total?: number
  lodging_confirmed?: number
  activity_total?: number
  activity_confirmed?: number
}
```

### Step 7: Add booking status row to TripCard

In `frontend/src/components/trips/TripCard.tsx`, update the component to render booking chips.

In the destructuring at the top of `TripCard`, add the new fields with defaults:

```tsx
const {
  member_count,
  member_previews = [],
  itinerary_day_count = 0,
  days_with_activities = 0,
  transport_total = 0,
  transport_confirmed = 0,
  lodging_total = 0,
  lodging_confirmed = 0,
  activity_total = 0,
  activity_confirmed = 0,
} = trip
```

Add a helper to build the chip list (only show categories that have at least one item):

```tsx
const bookingChips = [
  { icon: Plane, total: transport_total, confirmed: transport_confirmed, label: 'flight' },
  { icon: Hotel, total: lodging_total, confirmed: lodging_confirmed, label: 'hotel' },
  { icon: MapPin, total: activity_total, confirmed: activity_confirmed, label: 'activity' },
].filter((c) => c.total > 0)
```

Add the import at the top: `import { Calendar, Plane, Hotel, MapPin } from 'lucide-react'`

Then in the JSX, add the booking row between the progress bar and the bottom row (status badge + avatars):

```tsx
{bookingChips.length > 0 && (
  <div className="flex items-center gap-2 mb-3">
    {bookingChips.map(({ icon: Icon, total, confirmed, label }) => (
      <div
        key={label}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          confirmed === total
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-cloud-100 text-cloud-600'
        }`}
      >
        <Icon className="w-3 h-3" />
        <span>{confirmed}/{total}</span>
      </div>
    ))}
  </div>
)}
```

### Step 8: Run all tests

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
cd /Users/nick/Code/travel-planner/frontend && npm run lint
```

Expected: All pass

### Step 9: Commit

```bash
git add backend/src/travel_planner/schemas/trip.py \
        backend/src/travel_planner/routers/trips.py \
        backend/tests/test_trips.py \
        frontend/src/lib/types.ts \
        frontend/src/components/trips/TripCard.tsx
git commit -m "feat: show per-category booking status on trip cards"
```

---

## Task 4: Fix cross-day drag-and-drop reliability

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`
- Test: `frontend/src/__tests__/TripDetailPage.test.tsx` (smoke test only — DnD is hard to unit test)

### Context

**Root cause:** When you drag an activity over a non-empty day (dropping into the empty space below its activities, or between items), `over.id` does not match any activity ID and `handleDragEnd` returns early without doing anything. Only empty days have an `EmptyDayDropZone` droppable. Also the sensor `distance: 8` makes drag feel sluggish.

**Fix:**
1. Wrap each day's entire activity area in a `useDroppable` with id `day-${day.id}`, so dropping anywhere in a day's column registers.
2. Update `handleDragEnd` to handle three cases: (a) empty zone drop, (b) day-area drop, (c) activity-to-activity drop.
3. Reduce sensor distance from 8 to 4.

### Step 1: Add a DroppableDay wrapper component

In `frontend/src/components/itinerary/ItineraryTimeline.tsx`, add a new inner component below `EmptyDayDropZone`:

```tsx
function DroppableDay({ dayId, children }: { dayId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayId}`, data: { dayId } })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[2.5rem] rounded transition-colors ${isOver ? 'bg-indigo-50/50' : ''}`}
    >
      {children}
    </div>
  )
}
```

### Step 2: Reduce sensor distance

In the `useSensors` call, change `distance: 8` to `distance: 4`:

```tsx
useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
```

### Step 3: Update handleDragEnd to handle day-area drops

Replace the existing `handleDragEnd` function with:

```tsx
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  setActiveId(null)
  if (!over) return

  const draggedActivity = allActivities.find((a) => a.id === active.id)
  if (!draggedActivity) return

  const sourceDayId = draggedActivity.itinerary_day_id
  const overId = String(over.id)

  let targetDayId: string

  if (overId.startsWith('empty-')) {
    // Drop on empty day zone
    targetDayId = overId.replace('empty-', '')
  } else if (overId.startsWith('day-')) {
    // Drop on day container area (non-empty day, dropped below activities)
    targetDayId = overId.replace('day-', '')
  } else {
    // Drop on a specific activity — look up its day
    const overActivity = allActivities.find((a) => a.id === overId)
    if (!overActivity) return
    targetDayId = overActivity.itinerary_day_id
  }

  if (sourceDayId === targetDayId) {
    // Same day reorder — only meaningful when dropping on a specific activity
    if (!overId.startsWith('day-') && !overId.startsWith('empty-')) {
      const dayActs = activitiesByDay.get(sourceDayId) ?? []
      const oldIndex = dayActs.findIndex((a) => a.id === active.id)
      const newIndex = dayActs.findIndex((a) => a.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const reordered = [...dayActs]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      reorderActivities.mutate({ dayId: sourceDayId, activityIds: reordered.map((a) => a.id) })
    }
  } else {
    // Cross-day move
    moveActivity.mutate({ activityId: String(active.id), targetDayId })
  }
}
```

### Step 4: Wrap each day's activity area in DroppableDay

In the JSX where each day is rendered, wrap the activities section with `DroppableDay`:

```tsx
{/* Activities list */}
<div className="ml-6 space-y-2">
  <DroppableDay dayId={day.id}>
    <SortableContext
      items={dayActs.map((a) => a.id)}
      strategy={verticalListSortingStrategy}
    >
      {dayActs.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} tripId={tripId} />
      ))}
    </SortableContext>

    {dayActs.length === 0 && !isAdding && (
      <EmptyDayDropZone dayId={day.id} />
    )}
  </DroppableDay>

  {isAdding && (
    <ActivityForm ... />
  )}
</div>
```

> **Note:** `EmptyDayDropZone` stays — it provides the dashed border visual. `DroppableDay` handles the structural drop detection for non-empty days.

### Step 5: Run TypeScript check and tests

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
cd /Users/nick/Code/travel-planner/frontend && npm run lint
```

Expected: All pass

### Step 6: Commit

```bash
git add frontend/src/components/itinerary/ItineraryTimeline.tsx
git commit -m "fix: reliable cross-day drag-and-drop with DroppableDay containers"
```

---

## Task 5: Hotel check-out date (backend + frontend)

**Files:**
- Create: `backend/alembic/versions/<new_migration>.py`
- Modify: `backend/src/travel_planner/models/itinerary.py`
- Modify: `backend/src/travel_planner/schemas/itinerary.py`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/components/itinerary/ActivityForm.tsx`
- Modify: `frontend/src/components/itinerary/ActivityItem.tsx`
- Test: `backend/tests/test_itinerary.py`

### Context

Add a nullable `check_out_date` field to activities. It is only relevant for `lodging` category. Displayed in `ActivityItem` as "Dec 15–18" and editable in `ActivityForm` when category is `lodging`.

### Step 1: Write the failing backend test

In `backend/tests/test_itinerary.py`, add:

```python
@pytest.mark.asyncio
async def test_create_lodging_activity_with_check_out_date(client, auth_headers, mock_db_session):
    """Lodging activities can be created with a check_out_date."""
    day = _make_day()
    trip = _make_trip_for_day(day)
    activity = _make_activity(day_id=day.id, category="lodging")
    activity.check_out_date = datetime.date(2026, 6, 20)

    mock_db_session.execute = AsyncMock(return_value=_make_scalar_result(trip))
    mock_db_session.refresh = AsyncMock()

    # Simulate the created activity being returned
    mock_db_session.add = MagicMock()
    mock_db_session.flush = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = await client.post(
        f"/api/itinerary/days/{day.id}/activities",
        json={
            "title": "Hotel Stay",
            "category": "lodging",
            "check_out_date": "2026-06-20",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["check_out_date"] == "2026-06-20"
```

> **Note:** Look at existing activity creation tests in `test_itinerary.py` for the exact mock pattern for `mock_db_session`. The helper functions `_make_day`, `_make_trip_for_day`, `_make_activity` may already exist or may need to be adapted from similar helpers.

### Step 2: Run the test to verify it fails

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_itinerary.py::test_create_lodging_activity_with_check_out_date -v
```

Expected: FAIL (field not yet in schema)

### Step 3: Add check_out_date to the Activity model

In `backend/src/travel_planner/models/itinerary.py`, add the import and column to `Activity`:

```python
# At the top, Date is already imported. No new import needed.

class Activity(Base):
    __tablename__ = "activities"
    # ... existing columns ...
    check_out_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
```

### Step 4: Create the Alembic migration

```bash
cd /Users/nick/Code/travel-planner/backend && uv run alembic revision -m "add check_out_date to activities"
```

This creates a new file in `backend/alembic/versions/`. Open it and fill in:

```python
"""add check_out_date to activities"""

from alembic import op
import sqlalchemy as sa

revision = "<generated-id>"
down_revision = "08443a1a87aa"  # current head
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("check_out_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "check_out_date")
```

Apply it:

```bash
cd /Users/nick/Code/travel-planner/backend && uv run alembic upgrade head
```

### Step 5: Add check_out_date to schemas

In `backend/src/travel_planner/schemas/itinerary.py`:

Add to `ActivityCreate`:
```python
check_out_date: date | None = None
```

Add to `ActivityUpdate`:
```python
check_out_date: date | None = None
```

Add to `ActivityResponse`:
```python
check_out_date: date | None
```

### Step 6: Run backend tests

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
```

Expected: All pass

### Step 7: Add check_out_date to frontend types

In `frontend/src/lib/types.ts`:

Add to `Activity` interface:
```typescript
check_out_date?: string | null
```

Add to `CreateActivity` interface:
```typescript
check_out_date?: string | null
```

Add to `UpdateActivity` interface:
```typescript
check_out_date?: string | null
```

### Step 8: Add check_out_date to ActivityFormData and ActivityForm

In `frontend/src/components/itinerary/ActivityForm.tsx`:

1. Add `check_out_date: string | null` to `ActivityFormData` interface.

2. Add state:
```tsx
const [checkOutDate, setCheckOutDate] = useState(activity?.check_out_date ?? '')
```

3. Add `check_out_date: checkOutDate || null` to the `onSave(...)` call in `handleSubmit`.

4. In the JSX, add a "Check-out Date" field that only shows when category is `lodging`:

```tsx
{category === 'lodging' && (
  <div>
    <label htmlFor={`${fieldId}-check_out_date`} className="block text-sm font-medium text-cloud-700 mb-1">
      Check-out Date
    </label>
    <input
      type="date"
      id={`${fieldId}-check_out_date`}
      value={checkOutDate}
      onChange={(e) => setCheckOutDate(e.target.value)}
      disabled={isPending}
      className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
    />
  </div>
)}
```

Place this after the start/end time grid and before the location field.

### Step 9: Display date range in ActivityItem for lodging

In `frontend/src/components/itinerary/ActivityItem.tsx`, update the `timeRange` derivation. Currently:

```tsx
const timeRange = activity.start_time && activity.end_time
  ? `${activity.start_time} - ${activity.end_time}`
  : activity.start_time
    ? `${activity.start_time}`
    : null
```

Add a check-out date range display for lodging above the existing `timeRange`:

```tsx
const checkOutDisplay = activity.category === 'lodging' && activity.check_out_date
  ? (() => {
      const checkIn = new Date(/* get the day date from somewhere */)
      // We don't have the day date in ActivityItem. Use check_out_date only:
      const out = new Date(activity.check_out_date + 'T00:00:00')
      return `Check-out: ${out.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    })()
  : null
```

> **Simpler approach (recommended):** Since `ActivityItem` doesn't have the check-in day date, just show the check-out date as a label. Display it below the time range:

```tsx
{activity.category === 'lodging' && activity.check_out_date && (
  <p className="text-sm text-cloud-600 mt-1">
    Check-out: {new Date(activity.check_out_date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}
  </p>
)}
```

Place this after the `timeRange` display block and before `activity.location`.

### Step 10: Run all tests

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
cd /Users/nick/Code/travel-planner/frontend && npm run lint
```

Expected: All pass

### Step 11: Commit

```bash
git add backend/alembic/versions/<new_migration_file>.py \
        backend/src/travel_planner/models/itinerary.py \
        backend/src/travel_planner/schemas/itinerary.py \
        backend/tests/test_itinerary.py \
        frontend/src/lib/types.ts \
        frontend/src/components/itinerary/ActivityForm.tsx \
        frontend/src/components/itinerary/ActivityItem.tsx
git commit -m "feat: hotel check-out date display and storage"
```

---

## Final Validation

After all 5 tasks complete:

```bash
cd /Users/nick/Code/travel-planner/backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

All should pass before creating a PR.
