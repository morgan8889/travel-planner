# Auto-Complete Past Trips & Event Title Display — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-update past trips to `completed` status on the backend, and show the event name (from notes) as the primary title for event-type trips on TripCard and TripDetailPage.

**Architecture:** Two independent features. Feature 1: in `list_trips` and `get_trip`, check for trips where `end_date < today` and `status != completed`, update in-memory + commit before returning. Feature 2: extract `getEventName` to a shared `tripUtils.ts`, then use it in TripCard (event name as `<h3>`, destination as secondary line) and TripDetailPage (event name in `<h1>`, breadcrumb, delete dialog; destination shown below with MapPin icon).

**Tech Stack:** FastAPI + SQLAlchemy async (backend), React + TypeScript + Vitest + Testing Library (frontend), lucide-react icons.

---

### Task 1: Auto-complete past trips in `list_trips`

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py`
- Modify: `backend/tests/test_trips.py`

**Context:** `list_trips` is at line 163. After `trips = result.scalars().all()` (line 181), there is a stats query block. Auto-complete logic goes between these two. The `date` import needs to be added. `mock_db_session.commit` is already an `AsyncMock` in conftest — no change to conftest needed.

**Step 1: Write the failing test**

Add to `backend/tests/test_trips.py` after `test_list_trips_status_filter` (after line 207):

```python
def test_list_trips_auto_completes_past_trips(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips auto-updates past non-completed trips to 'completed' in response."""
    owner_member = _make_member()
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2024, 1, 1)   # clearly in the past
    trip.status = TripStatus.planning  # not yet completed

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["status"] == "completed"
    mock_db_session.commit.assert_called()
```

Also add `date` to the imports at the top of `test_trips.py` if not already present:
```python
from datetime import date, datetime
```

**Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_trips_auto_completes_past_trips -v
```

Expected: FAIL — `data[0]["status"]` is `"planning"`, not `"completed"`.

**Step 3: Add `date` import and auto-complete logic to `list_trips`**

In `backend/src/travel_planner/routers/trips.py`:

Add `date` to the top import (line 1):
```python
from datetime import date
```

In `list_trips`, after `trips = result.scalars().all()` and before the `trip_ids = [t.id for t in trips]` line, insert:

```python
    # Auto-complete past trips
    today = date.today()
    past_ids = [t.id for t in trips if t.end_date < today and t.status != TripStatus.completed]
    if past_ids:
        past_id_set = set(past_ids)
        for t in trips:
            if t.id in past_id_set:
                t.status = TripStatus.completed
        await db.commit()
```

**Step 4: Run test to verify it passes**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_trips_auto_completes_past_trips -v
```

Expected: PASS

**Step 5: Run all backend tests**

```bash
cd backend && uv run pytest tests/test_trips.py -v
```

Expected: All pass.

**Step 6: Commit**

```bash
git add backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py
git commit -m "feat: auto-complete past trips to 'completed' on GET /trips"
```

---

### Task 2: Auto-complete past trip in `get_trip`

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py:288-296`
- Modify: `backend/tests/test_trips.py`

**Context:** `get_trip` calls `get_trip_with_membership` which does a single `db.execute`. After that call returns the trip, we check the date and update in-memory + commit. No extra `db.execute` needed — SQLAlchemy tracks the attribute change on the loaded ORM object.

**Step 1: Write the failing test**

Add to `backend/tests/test_trips.py` after `test_get_trip_detail_success` (after line ~342):

```python
def test_get_trip_auto_completes_past_trip(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips/{id} auto-updates a past non-completed trip to 'completed'."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])
    trip.end_date = date(2024, 1, 1)   # past
    trip.status = TripStatus.booked    # not yet completed
    trip.destination_latitude = None
    trip.destination_longitude = None

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(f"/trips/{trip.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    mock_db_session.commit.assert_called()
```

**Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_trips.py::test_get_trip_auto_completes_past_trip -v
```

Expected: FAIL — status is `"booked"`.

**Step 3: Implement in `get_trip`**

In `backend/src/travel_planner/routers/trips.py`, replace the `get_trip` function body (lines 288-296):

```python
@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> TripResponse:
    """Get trip detail with members and children. Requires membership."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db)
    today = date.today()
    if trip.end_date < today and trip.status != TripStatus.completed:
        trip.status = TripStatus.completed
        await db.commit()
    return _build_trip_response(trip)
```

(`date` is already imported from Task 1.)

**Step 4: Run test to verify it passes**

```bash
cd backend && uv run pytest tests/test_trips.py::test_get_trip_auto_completes_past_trip -v
```

Expected: PASS

**Step 5: Run full backend suite + lint**

```bash
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check . && uv run pyright
```

Expected: All pass.

**Step 6: Commit**

```bash
git add backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py
git commit -m "feat: auto-complete past trip on GET /trips/{id}"
```

---

### Task 3: Extract `getEventName` to shared `tripUtils.ts`

**Files:**
- Create: `frontend/src/lib/tripUtils.ts`
- Modify: `frontend/src/components/planning/TripSpan.tsx`

**Context:** `getEventName` is currently defined locally in `TripSpan.tsx` at lines 48-52. It will live in `tripUtils.ts` and be imported in TripSpan, TripCard, and TripDetailPage. Convention: notes field starts with event name, followed by ` — ` (em-dash, not a hyphen) and details.

**Step 1: Create `frontend/src/lib/tripUtils.ts`**

```typescript
/**
 * Parse event name from trip notes.
 * Convention: notes begin with "Event Name — details" (em-dash separator).
 * Returns the text before the em-dash, or the first 60 chars if no dash.
 */
export function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}
```

**Step 2: Update `TripSpan.tsx` to import from `tripUtils`**

In `frontend/src/components/planning/TripSpan.tsx`:

Add import (after the existing imports at the top):
```typescript
import { getEventName } from '../../lib/tripUtils'
```

Delete the local `getEventName` function (lines 48-52):
```typescript
function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}
```

**Step 3: Verify type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

**Step 4: Run all frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: All pass (TripSpan and YearView tests should pass unchanged).

**Step 5: Commit**

```bash
git add frontend/src/lib/tripUtils.ts frontend/src/components/planning/TripSpan.tsx
git commit -m "refactor: extract getEventName to shared lib/tripUtils.ts"
```

---

### Task 4: TripCard — event name as title, destination as location line

**Files:**
- Modify: `frontend/src/components/trips/TripCard.tsx`
- Modify: `frontend/src/__tests__/TripCard.test.tsx`

**Context:** TripCard currently shows `{trip.destination}` as the `<h3>` title (line 65). `MapPin` is already imported (used for booking chips). Add `getEventName` import from tripUtils, compute `displayTitle`, update the header JSX to show destination as a secondary line for event trips.

**Step 1: Write failing tests**

Add at the end of `frontend/src/__tests__/TripCard.test.tsx`:

```typescript
describe('TripCard event trips', () => {
  const eventTrip: TripSummary = {
    ...mockTrip,
    type: 'event',
    destination: 'Austin, TX',
    notes: '3M Half Marathon — local Austin race',
  }

  it('shows event name (not destination) as h3 title for event trips', async () => {
    const { container } = renderWithProviders(<TripCard trip={eventTrip} />)
    const h3 = container.querySelector('h3')
    expect(h3?.textContent).toBe('3M Half Marathon')
  })

  it('shows destination as secondary location line for event trips', async () => {
    renderWithProviders(<TripCard trip={eventTrip} />)
    expect(await screen.findByText('Austin, TX')).toBeInTheDocument()
  })

  it('shows destination as h3 title for non-event trips', async () => {
    const { container } = renderWithProviders(<TripCard trip={mockTrip} />)
    const h3 = container.querySelector('h3')
    expect(h3?.textContent).toBe('Paris, France')
  })

  it('falls back to destination as title if event has no notes', async () => {
    const noNotesEvent: TripSummary = { ...eventTrip, notes: null }
    const { container } = renderWithProviders(<TripCard trip={noNotesEvent} />)
    const h3 = container.querySelector('h3')
    expect(h3?.textContent).toBe('Austin, TX')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: FAIL — `h3` shows `"Austin, TX"` instead of `"3M Half Marathon"`.

**Step 3: Update `TripCard.tsx`**

In `frontend/src/components/trips/TripCard.tsx`:

Add import after existing imports:
```typescript
import { getEventName } from '../../lib/tripUtils'
```

Inside `TripCard`, before the `return`, add:
```typescript
  const isEvent = trip.type === 'event'
  const displayTitle = isEvent ? (getEventName(trip.notes) ?? trip.destination) : trip.destination
```

Replace the header block (lines 63-68, currently):
```tsx
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-cloud-900 group-hover:text-indigo-700 transition-colors duration-300 truncate mr-2">
            {trip.destination}
          </h3>
          <TripTypeBadge type={trip.type} />
        </div>
```

With:
```tsx
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="text-lg font-semibold text-cloud-900 group-hover:text-indigo-700 transition-colors duration-300 truncate">
              {displayTitle}
            </h3>
            {isEvent && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-cloud-500">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{trip.destination}</span>
              </div>
            )}
          </div>
          <TripTypeBadge type={trip.type} />
        </div>
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: All pass.

**Step 5: Run full suite + checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add frontend/src/components/trips/TripCard.tsx frontend/src/__tests__/TripCard.test.tsx
git commit -m "feat: show event name as TripCard title with destination as location line"
```

---

### Task 5: TripDetailPage — event name in h1, breadcrumb, delete dialog

**Files:**
- Modify: `frontend/src/pages/TripDetailPage.tsx`

**Context:** Three places show `trip.destination` that should use the event name for event trips: (1) `<h1>` at line ~353, (2) breadcrumb at line ~315, (3) delete confirm message at line ~671. `MapPin` is NOT currently imported — it needs to be added to the lucide-react import. The computed `displayTitle` is defined once after the `if (!trip)` guard (around line 307, after the return for not-found state).

**Step 1: Add `MapPin` to lucide-react import**

In `frontend/src/pages/TripDetailPage.tsx`, line 2, change:
```typescript
import { TriangleAlert, ArrowLeft, ChevronRight, SquarePen, Calendar, Trash2, MapPinOff, Plus } from 'lucide-react'
```
To:
```typescript
import { TriangleAlert, ArrowLeft, ChevronRight, SquarePen, Calendar, Trash2, MapPin, MapPinOff, Plus } from 'lucide-react'
```

**Step 2: Add `getEventName` import**

After the existing lib imports, add:
```typescript
import { getEventName } from '../lib/tripUtils'
```

**Step 3: Add computed `displayTitle`**

After the `if (!trip) { return ... }` block (around line 307, just before the `return (` that starts the main JSX), add:

```typescript
  const isEvent = trip.type === 'event'
  const displayTitle = isEvent ? (getEventName(trip.notes) ?? trip.destination) : trip.destination
```

**Step 4: Update the `<h1>` (around line 353)**

Replace:
```tsx
                <h1 className="text-3xl font-bold text-cloud-900">
                  {trip.destination}
                </h1>
```

With:
```tsx
                <div>
                  <h1 className="text-3xl font-bold text-cloud-900">
                    {displayTitle}
                  </h1>
                  {isEvent && (
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-cloud-500">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>{trip.destination}</span>
                    </div>
                  )}
                </div>
```

**Step 5: Update breadcrumb (around line 315)**

Replace:
```tsx
        <span className="text-cloud-900 font-medium truncate">{trip.destination}</span>
```

With:
```tsx
        <span className="text-cloud-900 font-medium truncate">{displayTitle}</span>
```

**Step 6: Update delete dialog (around line 671)**

Replace:
```tsx
        message={`Are you sure you want to delete "${trip.destination}"? This action cannot be undone and will remove all members and associated data.`}
```

With:
```tsx
        message={`Are you sure you want to delete "${displayTitle}"? This action cannot be undone and will remove all members and associated data.`}
```

**Step 7: Verify type check + lint + tests**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: All pass.

**Step 8: Commit**

```bash
git add frontend/src/pages/TripDetailPage.tsx
git commit -m "feat: show event name as title in TripDetailPage with destination as location"
```

---

## Verification

After all tasks complete:

```bash
# Backend
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest

# Frontend
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Manual checks:
- Load the trips page — past trips (end_date before today) should show "Completed" badge
- Event trips on the trips page should show event name (e.g. "3M Half Marathon") as title, with "Austin, TX" below
- Click an event trip — detail page h1 shows event name, destination appears below with pin icon, breadcrumb shows event name
- Non-event trips are unchanged
