# Dashboard & Trips Page UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a type filter to My Trips, focus the dashboard map on upcoming trips with a "Next Up" overlay, restructure Needs Attention by trip (with restaurant reminders), and cap Upcoming Trips at 5.

**Architecture:** Pure frontend changes except Task 1, which adds `restaurant_total`/`restaurant_confirmed` to the backend `TripSummary` query. All dashboard logic lives in `DashboardPage.tsx`. The map overlay is an absolutely-positioned sibling of the `<Suspense>` wrapper (not inside `MapView`). Needs Attention switches from a flat `getActionItems` list to a `getActionGroups` function that returns trips with nested items.

**Tech Stack:** React, TypeScript, Vite, FastAPI/SQLAlchemy, pytest, vitest + Testing Library

---

### Task 1: Backend — add `restaurant_total` / `restaurant_confirmed` to `TripSummary`

**Files:**
- Modify: `backend/src/travel_planner/schemas/trip.py` (add 2 fields to `TripSummary`)
- Modify: `backend/src/travel_planner/routers/trips.py` (extend stats query + summaries builder)
- Test: `backend/tests/test_trips.py`

---

**Step 1: Write the failing test**

Open `backend/tests/test_trips.py`. Locate the test `test_list_trips_returns_stats` (around line 1100). Add a new test below it:

```python
@pytest.mark.asyncio
async def test_list_trips_returns_restaurant_stats(
    client, auth_headers, mock_db_session
):
    """GET /trips returns restaurant_total and restaurant_confirmed counts."""
    trip = _make_trip("user-1-id", "test@example.com")

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]

    stats_row = MagicMock()
    stats_row.trip_id = trip.id
    stats_row.day_count = 0
    stats_row.active_count = 0
    stats_row.transport_total = 0
    stats_row.transport_confirmed = 0
    stats_row.lodging_total = 0
    stats_row.lodging_confirmed = 0
    stats_row.activity_total = 0
    stats_row.activity_confirmed = 0
    stats_row.restaurant_total = 3
    stats_row.restaurant_confirmed = 1
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([stats_row]))

    mock_db_session.execute = AsyncMock(
        side_effect=[_make_no_inv_result(), result_mock, stats_mock]
    )

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()[0]
    assert data["restaurant_total"] == 3
    assert data["restaurant_confirmed"] == 1
```

Also update the **existing** `test_list_trips_returns_stats` test — find the `stats_row` setup block and add these two lines after `stats_row.activity_confirmed = ...`:

```python
stats_row.restaurant_total = 0
stats_row.restaurant_confirmed = 0
```

**Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_trips_returns_restaurant_stats -v
```

Expected: FAIL — `KeyError: 'restaurant_total'` (field not in response)

**Step 3: Add fields to `TripSummary` schema**

Open `backend/src/travel_planner/schemas/trip.py`. In the `TripSummary` class, after `activity_confirmed`:

```python
# Before (line ~108):
    activity_total: int = 0
    activity_confirmed: int = 0
    model_config = {"from_attributes": True}

# After:
    activity_total: int = 0
    activity_confirmed: int = 0
    restaurant_total: int = 0
    restaurant_confirmed: int = 0
    model_config = {"from_attributes": True}
```

**Step 4: Extend the stats query in `list_trips`**

Open `backend/src/travel_planner/routers/trips.py`. In the `stats_stmt` `select(...)` block (around line 249), after the `activity_confirmed` label and before the closing `)`:

```python
# After activity_confirmed label, add:
                func.count(Activity.id)
                .filter(Activity.category == "food")
                .label("restaurant_total"),
                func.count(Activity.id)
                .filter(
                    Activity.category == "food",
                    Activity.confirmation_number.isnot(None),
                )
                .label("restaurant_confirmed"),
```

Then in the `summaries.append(TripSummary(...))` block (around line 314), after `activity_confirmed=activity_confirmed,` and before the closing `)`):

```python
# First extract the values above the summaries.append call:
        restaurant_total = row.restaurant_total if row else 0
        restaurant_confirmed = row.restaurant_confirmed if row else 0

# Then add to TripSummary() constructor:
                restaurant_total=restaurant_total,
                restaurant_confirmed=restaurant_confirmed,
```

**Step 5: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_trips.py -v
```

Expected: all trip tests pass including the new `test_list_trips_returns_restaurant_stats`.

**Step 6: Run full backend checks**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest
```

Expected: all pass.

**Step 7: Commit**

```bash
git add backend/src/travel_planner/schemas/trip.py \
        backend/src/travel_planner/routers/trips.py \
        backend/tests/test_trips.py
git commit -m "feat: add restaurant_total and restaurant_confirmed to TripSummary"
```

---

### Task 2: My Trips — type filter pill row

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/pages/TripsPage.tsx`
- Test: `frontend/src/__tests__/TripsPage.test.tsx`

---

**Step 1: Add restaurant fields to frontend `TripSummary`**

Open `frontend/src/lib/types.ts`. In `TripSummary`, after `activity_confirmed?:`:

```typescript
  activity_total?: number
  activity_confirmed?: number
  restaurant_total?: number      // ← add
  restaurant_confirmed?: number  // ← add
```

**Step 2: Write failing tests for type filter**

Open `frontend/src/__tests__/TripsPage.test.tsx`. Add these tests to the `describe('TripsPage')` block:

```typescript
  it('renders type filter pills', async () => {
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    expect(await screen.findByText('All Types')).toBeInTheDocument()
    expect(screen.getByText('Vacation')).toBeInTheDocument()
    expect(screen.getByText('Event')).toBeInTheDocument()
    expect(screen.getByText('Remote Week')).toBeInTheDocument()
    expect(screen.getByText('Sabbatical')).toBeInTheDocument()
  })

  it('clicking Event type filter shows only event-type trips', async () => {
    const user = userEvent.setup()
    const tripsWithEvent = [
      ...mockTrips,
      {
        ...mockTrips[0],
        id: 'trip-3',
        type: 'event' as const,
        destination: 'Boston Marathon',
        status: 'booked' as const,
      },
    ]
    mockGet.mockResolvedValue({ data: tripsWithEvent })
    renderWithProviders(<TripsPage />)

    // Click All status filter so all trips are visible
    await user.click(await screen.findByRole('button', { name: 'All' }))

    expect(await screen.findByText('Boston Marathon')).toBeInTheDocument()
    expect(screen.getByText('Paris, France')).toBeInTheDocument()

    // Click 'Event' type pill — only Boston Marathon should remain
    await user.click(screen.getByRole('button', { name: 'Event' }))

    expect(screen.getByText('Boston Marathon')).toBeInTheDocument()
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument()
    expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()
  })

  it('clicking All Types resets type filter', async () => {
    const user = userEvent.setup()
    const tripsWithEvent = [
      ...mockTrips,
      {
        ...mockTrips[0],
        id: 'trip-3',
        type: 'event' as const,
        destination: 'Boston Marathon',
        status: 'booked' as const,
      },
    ]
    mockGet.mockResolvedValue({ data: tripsWithEvent })
    renderWithProviders(<TripsPage />)

    await user.click(await screen.findByRole('button', { name: 'All' }))
    await user.click(screen.getByRole('button', { name: 'Event' }))
    expect(screen.queryByText('Paris, France')).not.toBeInTheDocument()

    // Reset — all trips visible again
    await user.click(screen.getByRole('button', { name: 'All Types' }))
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('Boston Marathon')).toBeInTheDocument()
  })
```

**Step 3: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

Expected: 3 new tests FAIL — `All Types` not found

**Step 4: Add type filter to `TripsPage.tsx`**

Open `frontend/src/pages/TripsPage.tsx`. Apply the following changes:

**4a.** Update the import line to include `TripType`:
```typescript
// Before:
import type { TripStatus } from '../lib/types'
// After:
import type { TripStatus, TripType } from '../lib/types'
```

**4b.** After the `statusFilters` constant, add:
```typescript
const typeFilters: { value: TripType | undefined; label: string }[] = [
  { value: undefined, label: 'All Types' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'event', label: 'Event' },
  { value: 'remote_week', label: 'Remote Week' },
  { value: 'sabbatical', label: 'Sabbatical' },
]
```

**4c.** Inside `TripsPage`, add `activeTypes` state after `activeStatuses`:
```typescript
const [activeTypes, setActiveTypes] = useState<TripType[]>([])
```

**4d.** Add `toggleType` function after `toggleStatus`:
```typescript
function toggleType(value: TripType | undefined) {
  if (value === undefined) {
    setActiveTypes([])
    return
  }
  setActiveTypes((prev) =>
    prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
  )
}
```

**4e.** Replace the `trips` computation:
```typescript
// Before:
  const trips =
    activeStatuses.length === 0
      ? allTrips
      : allTrips?.filter((t) => activeStatuses.includes(t.status))

// After:
  const statusFiltered =
    activeStatuses.length === 0
      ? allTrips
      : allTrips?.filter((t) => activeStatuses.includes(t.status))

  const trips =
    activeTypes.length === 0
      ? statusFiltered
      : statusFiltered?.filter((t) => activeTypes.includes(t.type))
```

**4f.** Add the type filter pill row after the closing `</div>` of the Status Filter Pills section:
```tsx
      {/* Type Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {typeFilters.map((filter) => {
          const isActive =
            filter.value === undefined
              ? activeTypes.length === 0
              : activeTypes.includes(filter.value)
          return (
            <button
              key={filter.label}
              data-testid="type-filter"
              onClick={() => toggleType(filter.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20 ring-offset-1'
                  : 'bg-white text-cloud-600 border border-cloud-200 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
```

**Step 5: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

Expected: all TripsPage tests pass.

**Step 6: Run all frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass.

**Step 7: Commit**

```bash
git add frontend/src/lib/types.ts \
        frontend/src/pages/TripsPage.tsx \
        frontend/src/__tests__/TripsPage.test.tsx
git commit -m "feat: add type filter pill row to My Trips page"
```

---

### Task 3: Dashboard — map focused on upcoming trips + Next Up overlay

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

---

**Step 1: Write failing tests**

Open `frontend/src/__tests__/DashboardPage.test.tsx`.

First, update the existing `FUTURE_TRIP` constant — add `type` and `notes` fields (needed for `TripSummary` completeness and next-up display):

```typescript
const FUTURE_TRIP: TripSummary = {
  id: 'trip-1',
  type: 'vacation',           // already present, keep
  destination: 'Paris, France',
  start_date: '2030-06-15',
  end_date: '2030-06-22',
  status: 'planning',
  notes: null,                // already present, keep
  // ... rest of fields unchanged
}
```

The existing constant is fine — no change needed. Now delete the `'renders Quick Actions links'` test entirely (quick links are being removed):

```typescript
// DELETE this entire test:
it('renders Quick Actions links', async () => {
  ...
})
```

Add these two new tests inside `describe('DashboardPage')`:

```typescript
  it('renders Next Up overlay for nearest upcoming planning trip', async () => {
    mockUseTrips.mockReturnValue({
      data: [FUTURE_TRIP],
      isLoading: false,
    })
    renderDashboard()
    // The overlay card should show destination and a countdown
    expect(await screen.findByTestId('next-up-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('next-up-overlay')).toHaveTextContent('Paris, France')
  })

  it('does not render Next Up overlay when no upcoming trips', async () => {
    mockUseTrips.mockReturnValue({
      data: [COMPLETED_TRIP_NO_COORDS],
      isLoading: false,
    })
    renderDashboard()

    await screen.findByText(/welcome back/i)
    expect(screen.queryByTestId('next-up-overlay')).not.toBeInTheDocument()
  })
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: new overlay tests FAIL; `'renders Quick Actions links'` test removed.

**Step 3: Update `DashboardPage.tsx` — map logic + Next Up overlay**

Open `frontend/src/pages/DashboardPage.tsx`.

**3a.** Update imports — add `getEventName`, keep everything else:
```typescript
// Add to the imports from lucide-react (keep Plus — still used in empty state):
import { Plus, Calendar, ArrowRight, CheckCircle2, Plane, Hotel } from 'lucide-react'

// Add after the last import line:
import { getEventName } from '../lib/tripUtils'
```

**3b.** Update the `UpcomingTripCard` component to accept `TripSummary` and show event names:
```typescript
// Before:
function UpcomingTripCard({ trip }: { trip: { id: string; destination: string; start_date: string; end_date: string; status: import('../lib/types').TripStatus } }) {
  const start = new Date(trip.start_date + 'T00:00:00')
  const daysUntil = Math.ceil((start.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const daysText = daysUntil > 1 ? `in ${daysUntil} days` : daysUntil === 1 ? 'tomorrow' : daysUntil === 0 ? 'today' : `${Math.abs(daysUntil)} days ago`

  return (
    <Link ...>
      <div>
        <p className="font-semibold text-cloud-800 group-hover:text-indigo-700 transition-colors">
          {trip.destination}
        </p>

// After:
function UpcomingTripCard({ trip }: { trip: TripSummary }) {
  const start = new Date(trip.start_date + 'T00:00:00')
  const daysUntil = Math.ceil((start.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const daysText = daysUntil > 1 ? `in ${daysUntil} days` : daysUntil === 1 ? 'tomorrow' : daysUntil === 0 ? 'today' : `${Math.abs(daysUntil)} days ago`
  const displayTitle = trip.type === 'event' ? (getEventName(trip.notes) ?? trip.destination) : trip.destination

  return (
    <Link ...>
      <div>
        <p className="font-semibold text-cloud-800 group-hover:text-indigo-700 transition-colors">
          {displayTitle}
        </p>
```

Also add a helper function for countdown text (used in Next Up overlay and Needs Attention), placed right before `UpcomingTripCard`:

```typescript
function getDaysUntil(dateStr: string): string {
  const start = new Date(dateStr + 'T00:00:00')
  const daysUntil = Math.ceil((start.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil > 1) return `in ${daysUntil} days`
  if (daysUntil === 1) return 'tomorrow'
  if (daysUntil === 0) return 'today'
  return `${Math.abs(daysUntil)} days ago`
}
```

Then update `UpcomingTripCard` to use `getDaysUntil`:
```typescript
// Replace the daysUntil / daysText lines with:
  const daysText = getDaysUntil(trip.start_date)
```

**3c.** Inside `DashboardPage`, replace the existing `tripsWithCoords`/`fitBounds`/`singleCenter` block with new map-focused logic:

```typescript
  // Map: only show trips in next 90 days (planning/booked/active); fall back to non-completed
  const cutoffDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const upcomingMapTrips =
    trips?.filter((t) => {
      if (!['planning', 'booked', 'active'].includes(t.status)) return false
      return new Date(t.start_date + 'T00:00:00') <= cutoffDate
    }) ?? []

  const mapTrips =
    upcomingMapTrips.length > 0
      ? upcomingMapTrips
      : (trips?.filter((t) => t.status !== 'completed') ?? [])

  const tripsWithCoords = mapTrips.filter(
    (t) => t.destination_latitude !== null && t.destination_longitude !== null
  )

  const fitBounds: [[number, number], [number, number]] | undefined =
    tripsWithCoords.length >= 2
      ? [
          [
            Math.max(-180, Math.min(...tripsWithCoords.map((t) => t.destination_longitude!)) - 5),
            Math.max(-90, Math.min(...tripsWithCoords.map((t) => t.destination_latitude!)) - 5),
          ],
          [
            Math.min(180, Math.max(...tripsWithCoords.map((t) => t.destination_longitude!)) + 5),
            Math.min(90, Math.max(...tripsWithCoords.map((t) => t.destination_latitude!)) + 5),
          ],
        ]
      : undefined

  const singleCenter =
    tripsWithCoords.length === 1
      ? ([tripsWithCoords[0].destination_longitude!, tripsWithCoords[0].destination_latitude!] as [number, number])
      : undefined

  // Next Up overlay: soonest planning/booked/active trip
  const nextUpTrip =
    (trips ?? [])
      .filter((t) => ['planning', 'booked', 'active'].includes(t.status))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null
```

**3d.** Update the map container JSX. Replace the entire `{/* World Map */}` section:

```tsx
      {/* World Map */}
      <div className="bg-white rounded-2xl border border-cloud-200 shadow-sm overflow-hidden">
        <div className="h-80 md:h-[440px] relative">
          <Suspense fallback={<div className="h-full bg-cloud-100 animate-pulse" />}>
            <MapView
              center={singleCenter}
              zoom={singleCenter ? 8 : 1.5}
              fitBounds={fitBounds}
              interactive
              className="h-full"
            >
              {tripsWithCoords.map((trip) => (
                <TripMarker
                  key={trip.id}
                  tripId={trip.id}
                  longitude={trip.destination_longitude!}
                  latitude={trip.destination_latitude!}
                  destination={trip.destination}
                  status={trip.status}
                  onClick={(id) => navigate({ to: '/trips/$tripId', params: { tripId: id } })}
                />
              ))}
            </MapView>
          </Suspense>

          {/* Next Up overlay */}
          {nextUpTrip && (
            <Link
              to="/trips/$tripId"
              params={{ tripId: nextUpTrip.id }}
              className="absolute bottom-4 left-4 z-10"
              data-testid="next-up-overlay"
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-cloud-200 p-3 max-w-[240px] hover:border-indigo-300 transition-colors">
                <p className="font-semibold text-cloud-900 text-sm truncate">
                  {nextUpTrip.type === 'event'
                    ? (getEventName(nextUpTrip.notes) ?? nextUpTrip.destination)
                    : nextUpTrip.destination}
                </p>
                <p className="text-xs text-cloud-500 mt-0.5">
                  {nextUpTrip.start_date} · {getDaysUntil(nextUpTrip.start_date)}
                </p>
                <div className="mt-1.5">
                  <TripStatusBadge status={nextUpTrip.status} />
                </div>
              </div>
            </Link>
          )}
        </div>
        {tripsWithCoords.length === 0 && (
          <div className="px-6 py-3 border-t border-cloud-100 text-sm text-cloud-500">
            Create trips with locations to see them on the map.
          </div>
        )}
      </div>
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: all DashboardPage tests pass (including new overlay tests; Quick Actions test removed).

**Step 5: Run all frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx \
        frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat: focus dashboard map on upcoming trips, add Next Up overlay"
```

---

### Task 4: Dashboard — Upcoming Trips panel (cap 5, View all in header)

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

---

**Step 1: Write the failing test**

In `frontend/src/__tests__/DashboardPage.test.tsx`, add inside `describe('DashboardPage')`:

```typescript
  it('shows up to 5 upcoming trips and no more', async () => {
    const sixTrips = Array.from({ length: 6 }, (_, i) => ({
      ...FUTURE_TRIP,
      id: `trip-${i + 1}`,
      destination: `City ${i + 1}`,
      start_date: `203${i}-06-15`,
    }))
    mockUseTrips.mockReturnValue({ data: sixTrips, isLoading: false })
    renderDashboard()

    // Should show exactly 5 trip names, not 6
    for (let i = 1; i <= 5; i++) {
      expect(await screen.findByText(`City ${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByText('City 6')).not.toBeInTheDocument()
  })
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx --reporter=verbose 2>&1 | grep -A5 "up to 5"
```

Expected: FAIL — City 6 is found (current cap is 3, so actually cities 4-6 all missing... wait, current cap is 3, test expects 5 visible. So City 4 and City 5 would be missing. Still fails.)

**Step 3: Update the `upcomingTrips` slice**

In `frontend/src/pages/DashboardPage.tsx`, find:
```typescript
  const upcomingTrips = trips
    ?.filter((t) => t.status !== 'completed')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3) ?? []
```

Change `.slice(0, 3)` to `.slice(0, 5)`.

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: all pass.

**Step 5: Run all frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx \
        frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat: cap upcoming trips panel at 5 and add View all link"
```

---

### Task 5: Dashboard — Needs Attention grouped by trip + restaurant items + remove quick links

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

---

**Step 1: Write failing tests**

In `frontend/src/__tests__/DashboardPage.test.tsx`, add to `describe('DashboardPage Needs Attention')`:

```typescript
  it('shows restaurant action item for unconfirmed restaurant bookings', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({
        destination: 'Kyoto',
        status: 'booked',
        restaurant_total: 3,
        restaurant_confirmed: 1,
      })],
      isLoading: false,
    })
    renderDashboard()
    expect(await screen.findByText(/2 restaurant booking/i)).toBeInTheDocument()
  })

  it('groups action items under their trip header', async () => {
    mockUseTrips.mockReturnValue({
      data: [
        makeTrip({ id: 'trip-a', destination: 'Rome', status: 'booked', transport_total: 2, transport_confirmed: 0 }),
        makeTrip({ id: 'trip-b', destination: 'Athens', status: 'planning', lodging_total: 1, lodging_confirmed: 0 }),
      ],
      isLoading: false,
    })
    renderDashboard()

    // Both trip headers shown
    expect(await screen.findByText('Rome')).toBeInTheDocument()
    expect(screen.getByText('Athens')).toBeInTheDocument()

    // Each has its own action item
    expect(screen.getByText(/2 flight/i)).toBeInTheDocument()
    expect(screen.getByText(/1 hotel/i)).toBeInTheDocument()

    // Each header has a "View trip" link
    const viewLinks = screen.getAllByText(/view trip/i)
    expect(viewLinks).toHaveLength(2)
  })

  it('does not show quick link buttons', async () => {
    mockUseTrips.mockReturnValue({ data: [], isLoading: false })
    renderDashboard()
    await screen.findByText(/welcome back/i)
    expect(screen.queryByText('View Calendar')).not.toBeInTheDocument()
  })
```

Also update `makeTrip` helper at the bottom of the file to include restaurant fields:

```typescript
function makeTrip(overrides: Partial<TripSummary>): TripSummary {
  return {
    // ... existing fields ...
    restaurant_total: 0,      // ← add
    restaurant_confirmed: 0,  // ← add
    ...overrides,
  }
}
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: restaurant and grouping tests FAIL.

**Step 3: Update `DashboardPage.tsx` — Needs Attention refactor**

**3a.** Add `UtensilsCrossed` to lucide-react imports:
```typescript
import { Plus, Calendar, ArrowRight, CheckCircle2, Plane, Hotel, UtensilsCrossed } from 'lucide-react'
```

**3b.** Replace the `ActionItem` type and `getActionItems` function with a grouped version:

```typescript
// DELETE the old ActionItem type and getActionItems function entirely.

// ADD this in their place:
type TripActionGroup = {
  tripId: string
  displayName: string
  startDate: string
  items: { icon: React.ElementType; label: string }[]
}

function getActionGroups(trips: TripSummary[]): TripActionGroup[] {
  const actionable = trips.filter((t) =>
    ['planning', 'booked', 'active'].includes(t.status)
  )
  actionable.sort((a, b) => a.start_date.localeCompare(b.start_date))

  const groups: TripActionGroup[] = []
  for (const trip of actionable) {
    const items: { icon: React.ElementType; label: string }[] = []

    const unconfirmedFlights = (trip.transport_total ?? 0) - (trip.transport_confirmed ?? 0)
    if (unconfirmedFlights > 0) {
      items.push({
        icon: Plane,
        label: `${unconfirmedFlights} flight${unconfirmedFlights > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unconfirmedHotels = (trip.lodging_total ?? 0) - (trip.lodging_confirmed ?? 0)
    if (unconfirmedHotels > 0) {
      items.push({
        icon: Hotel,
        label: `${unconfirmedHotels} hotel${unconfirmedHotels > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unconfirmedRestaurants = (trip.restaurant_total ?? 0) - (trip.restaurant_confirmed ?? 0)
    if (unconfirmedRestaurants > 0) {
      items.push({
        icon: UtensilsCrossed,
        label: `${unconfirmedRestaurants} restaurant booking${unconfirmedRestaurants > 1 ? 's' : ''} to confirm`,
      })
    }
    const unplannedDays = (trip.itinerary_day_count ?? 0) - (trip.days_with_activities ?? 0)
    if (unplannedDays > 0) {
      items.push({
        icon: Calendar,
        label: `${unplannedDays} day${unplannedDays > 1 ? 's' : ''} not planned`,
      })
    }

    if (items.length > 0) {
      groups.push({
        tripId: trip.id,
        displayName: trip.type === 'event'
          ? (getEventName(trip.notes) ?? trip.destination)
          : trip.destination,
        startDate: trip.start_date,
        items,
      })
    }
  }
  return groups
}
```

**3c.** Replace the entire `{/* Needs Attention */}` JSX section with:

```tsx
        {/* Needs Attention */}
        <div>
          <h2 className="text-lg font-semibold text-cloud-900 mb-3">Needs Attention</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
          ) : (() => {
            const groups = getActionGroups(trips ?? [])
            if (groups.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-cloud-200 p-6 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-cloud-600">All caught up</p>
                </div>
              )
            }
            return (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.tripId} className="bg-white rounded-xl border border-cloud-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-cloud-100">
                      <div className="min-w-0 mr-2">
                        <span className="text-sm font-semibold text-cloud-800 truncate block">
                          {group.displayName}
                        </span>
                        <span className="text-xs text-cloud-500">
                          {group.startDate} · {getDaysUntil(group.startDate)}
                        </span>
                      </div>
                      <Link
                        to="/trips/$tripId"
                        params={{ tripId: group.tripId }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap shrink-0"
                      >
                        View trip →
                      </Link>
                    </div>
                    <div className="divide-y divide-cloud-50">
                      {group.items.map((item, idx) => (
                        <Link
                          key={idx}
                          to="/trips/$tripId"
                          params={{ tripId: group.tripId }}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-cloud-50/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <item.icon className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-sm text-cloud-700 group-hover:text-indigo-700 truncate">
                              {item.label}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-cloud-400 group-hover:text-indigo-500 shrink-0 ml-2" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
```

**3d.** Delete the quick links section entirely:

```tsx
// DELETE this entire block:
          {/* Quick links */}
          <div className="flex gap-3 mt-4">
            <Link to="/trips/new" ...>
              <Plus className="w-4 h-4" />
              New Trip
            </Link>
            <Link to="/calendar" ...>
              <Calendar className="w-4 h-4" />
              View Calendar
            </Link>
          </div>
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: all DashboardPage tests pass.

**Step 5: Run all frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass. If `Plus` is flagged as unused, verify it's still used in the Upcoming Trips empty state (the "Plan a Trip" button). If not used anywhere else, remove it from imports.

**Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx \
        frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat: group Needs Attention by trip with restaurant reminders, remove quick links"
```

---

## Verification

After all tasks:

```bash
# Backend
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest

# Frontend
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

All checks should pass. Then manually verify in the browser:
1. My Trips: type filter pills appear; clicking "Event" shows only events
2. Dashboard: map shows only upcoming 90-day trips (or falls back correctly)
3. Dashboard: "Next Up" card appears in map bottom-left corner with soonest trip
4. Dashboard: Needs Attention shows trips as section headers with "View trip →" links
5. Dashboard: restaurant booking reminder appears for food activities without confirmation numbers
6. Dashboard: quick link buttons ("New Trip", "View Calendar") are gone
