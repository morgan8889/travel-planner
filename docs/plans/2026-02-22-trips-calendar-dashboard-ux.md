# Trips, Calendar & Dashboard UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Five focused UX improvements — year view as default calendar, event count badges on year view month headings, pre-selected active filters on the trips page, uniform TripCard booking chips, and a dynamic "Needs Attention" dashboard panel.

**Architecture:** All changes are purely frontend. No backend schema changes required. All booking stats (`transport_total/confirmed`, `lodging_total/confirmed`, `activity_total/confirmed`, `days_with_activities`, `itinerary_day_count`) are already returned by `GET /api/trips` and present on the `TripSummary` type.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react

**Tests:** `cd /Users/nick/Code/travel-planner/frontend && npx vitest run`
**Type check:** `cd /Users/nick/Code/travel-planner/frontend && npx tsc -b --noEmit`
**Lint:** `cd /Users/nick/Code/travel-planner/frontend && npm run lint`

---

### Task 1: Calendar defaults to year view

**Files:**
- Modify: `frontend/src/pages/PlanningCenterPage.tsx` (line 33)
- Modify: `frontend/src/__tests__/PlanningCenterPage.test.tsx` (lines 110–116, 118–131)

**Context:**
`PlanningCenterPage` has `const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month')` at line 33. Two existing tests assume month view on load:
1. `'shows day headers in month view'` — checks `Sun`, `Mon` headers render on mount; this will break once we default to year view
2. `'switches to year view on Year click'` — clicks Year button to switch; this still works but becomes a test for switching *away* from year

**Step 1: Update the failing test**

In `frontend/src/__tests__/PlanningCenterPage.test.tsx`, replace the two tests:

```typescript
// OLD: 'shows day headers in month view'
it('shows day headers in month view', async () => {
  renderWithRouter()
  await waitFor(() => {
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })
})

// OLD: 'switches to year view on Year click'
it('switches to year view on Year click', async () => {
  renderWithRouter()
  await waitFor(() => {
    expect(screen.getByText('Month')).toBeInTheDocument()
  })
  await userEvent.click(screen.getByText('Year'))
  await waitFor(() => {
    expect(screen.getByText('January')).toBeInTheDocument()
    expect(screen.getByText('December')).toBeInTheDocument()
  })
})
```

Replace with:

```typescript
it('renders year view by default', async () => {
  renderWithRouter()
  await waitFor(() => {
    expect(screen.getByText('January')).toBeInTheDocument()
    expect(screen.getByText('December')).toBeInTheDocument()
  })
})

it('switches to month view on Month click', async () => {
  renderWithRouter()
  await waitFor(() => {
    expect(screen.getByText('January')).toBeInTheDocument()
  })
  await userEvent.click(screen.getByText('Month'))
  await waitFor(() => {
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests — expect these two tests to fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/PlanningCenterPage.test.tsx
```

Expected: the two new tests fail (year view not default yet).

**Step 3: Change default zoom level**

In `frontend/src/pages/PlanningCenterPage.tsx` line 33:

```typescript
// Change:
const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month')
// To:
const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('year')
```

**Step 4: Run tests — expect all to pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/PlanningCenterPage.test.tsx
```

Expected: all PlanningCenterPage tests pass.

**Step 5: Full suite + type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run && npx tsc -b --noEmit
```

**Step 6: Commit**

```bash
git add frontend/src/pages/PlanningCenterPage.tsx frontend/src/__tests__/PlanningCenterPage.test.tsx
git commit -m "feat: default calendar to year view"
```

---

### Task 2: Event count badge on year view month headings

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx` (around line 149–156)
- Modify: `frontend/src/__tests__/YearView.test.tsx`

**Context:**
In `YearView.tsx`, the month heading area (lines 149–156) currently looks like:
```tsx
<div key={month} ref={(el) => { monthRefs.current[month] = el }}>
  <button
    onClick={() => onMonthClick(month)}
    className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
  >
    {name}
  </button>
```

`customDaysForYear` is already computed at line 111–116 as an array of `{ resolvedDate: string, ... }` objects sorted by date. We need to count how many fall in each `month` (0-indexed).

**Step 1: Write the failing test**

Add a new describe block at the bottom of `frontend/src/__tests__/YearView.test.tsx`:

```typescript
describe('YearView event badges', () => {
  it('renders an event count badge on the month heading when custom days exist in that month', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'cd-2', user_id: 'u-1', name: 'Fun Run', date: '2026-07-20', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { container } = render(<YearView {...baseProps} customDays={customDays} />)
    // Find the July month area — badge should show "2"
    const badges = container.querySelectorAll('.bg-amber-100')
    expect(badges.length).toBeGreaterThan(0)
    const badge = Array.from(badges).find((el) => el.textContent === '2')
    expect(badge).toBeInTheDocument()
  })

  it('does not render a badge for months with no events', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { container } = render(<YearView {...baseProps} customDays={customDays} />)
    // January has no events — no badge with bg-amber-100 near January
    const badges = container.querySelectorAll('.bg-amber-100')
    // Only 1 badge total (July)
    expect(badges.length).toBe(1)
  })
})
```

**Step 2: Run — expect fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: new tests fail (badge not rendered yet).

**Step 3: Implement the badge in YearView**

In `frontend/src/components/planning/YearView.tsx`, inside the `MONTH_NAMES.map((name, month) => {` block, add an event count computation and render the badge. Change the month heading area from:

```tsx
return (
  <div key={month} ref={(el) => { monthRefs.current[month] = el }}>
    <button
      onClick={() => onMonthClick(month)}
      className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
    >
      {name}
    </button>
```

To:

```tsx
const eventCount = customDaysForYear.filter((cd) => {
  const m = new Date(cd.resolvedDate + 'T00:00:00').getMonth()
  return m === month
}).length

return (
  <div key={month} ref={(el) => { monthRefs.current[month] = el }}>
    <div className="flex items-center gap-1 mb-2">
      <button
        onClick={() => onMonthClick(month)}
        className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors"
      >
        {name}
      </button>
      {eventCount > 0 && (
        <span className="bg-amber-100 text-amber-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
          {eventCount}
        </span>
      )}
    </div>
```

Note: `customDaysForYear` is already in scope (computed at the component level, line 111).

**Step 4: Run — expect pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

**Step 5: Full suite + type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run && npx tsc -b --noEmit
```

**Step 6: Commit**

```bash
git add frontend/src/components/planning/YearView.tsx frontend/src/__tests__/YearView.test.tsx
git commit -m "feat: show event count badge on year view month headings"
```

---

### Task 3: Trips page pre-selects dreaming, planning, booked

**Files:**
- Modify: `frontend/src/pages/TripsPage.tsx` (line 39)
- Modify: `frontend/src/__tests__/TripsPage.test.tsx`

**Context:**
`TripsPage` has `const [activeStatuses, setActiveStatuses] = useState<TripStatus[]>([])` at line 39. The mock data in the test has two trips: `'Paris, France'` (status: `planning`) and `'Lisbon, Portugal'` (status: `dreaming`). Both match the new default filters, so "renders trip cards when data loads" still passes. However, the test `'clicking a status filter pill filters trips client-side'` starts by asserting both trips are visible — that still works since both are planning/dreaming. The multi-select test and clear-All test also remain valid.

One test needs updating: `'clicking All clears active status filters'` currently clicks Planning first to add a filter, then clicks All to reset. Since Planning is already active by default, clicking it again will *deselect* it. We need to adapt the setup.

**Step 1: Update the affected test**

In `frontend/src/__tests__/TripsPage.test.tsx`, replace the `'clicking All clears active status filters'` test:

```typescript
// OLD
it('clicking All clears active status filters', async () => {
  const user = userEvent.setup()
  mockGet.mockResolvedValue({ data: mockTrips })
  renderWithProviders(<TripsPage />)

  await screen.findByText('Paris, France')

  // Select "Planning" to filter
  const filterPillsClear = screen.getAllByTestId('status-filter')
  const planningPillClear = filterPillsClear.find((el) => el.textContent === 'Planning')!
  await user.click(planningPillClear)
  expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()

  // Click All to clear
  await user.click(screen.getByRole('button', { name: 'All' }))
  expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()
})
```

Replace with:

```typescript
it('clicking All shows all trips regardless of default filters', async () => {
  const user = userEvent.setup()
  // Add a completed trip that won't show in default filters
  const tripsWithCompleted = [
    ...mockTrips,
    {
      ...mockTrips[0],
      id: 'trip-3',
      destination: 'Tokyo, Japan',
      status: 'completed' as const,
    },
  ]
  mockGet.mockResolvedValue({ data: tripsWithCompleted })
  renderWithProviders(<TripsPage />)

  // Tokyo (completed) is hidden by default
  await screen.findByText('Paris, France')
  expect(screen.queryByText('Tokyo, Japan')).not.toBeInTheDocument()

  // Click All to show everything
  await user.click(screen.getByRole('button', { name: 'All' }))
  expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument()
})
```

Also add a test for the default filter behaviour:

```typescript
it('hides completed and active trips by default', async () => {
  const tripsWithCompleted = [
    ...mockTrips,
    {
      ...mockTrips[0],
      id: 'trip-3',
      destination: 'Tokyo, Japan',
      status: 'completed' as const,
    },
  ]
  mockGet.mockResolvedValue({ data: tripsWithCompleted })
  renderWithProviders(<TripsPage />)

  await screen.findByText('Paris, France')
  expect(screen.queryByText('Tokyo, Japan')).not.toBeInTheDocument()
})
```

**Step 2: Run — expect new tests to fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

**Step 3: Change initial filter state**

In `frontend/src/pages/TripsPage.tsx` line 39:

```typescript
// Change:
const [activeStatuses, setActiveStatuses] = useState<TripStatus[]>([])
// To:
const [activeStatuses, setActiveStatuses] = useState<TripStatus[]>(['dreaming', 'planning', 'booked'])
```

**Step 4: Run — expect all pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

**Step 5: Full suite + type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run && npx tsc -b --noEmit
```

**Step 6: Commit**

```bash
git add frontend/src/pages/TripsPage.tsx frontend/src/__tests__/TripsPage.test.tsx
git commit -m "feat: pre-select dreaming, planning, booked filters on trips page"
```

---

### Task 4: TripCard always shows all 3 booking chips

**Files:**
- Modify: `frontend/src/components/trips/TripCard.tsx` (lines 45–101)
- Modify: `frontend/src/__tests__/TripCard.test.tsx`

**Context:**
Currently `bookingChips` is filtered with `.filter((c) => c.total > 0)` and only rendered when `bookingChips.length > 0`. The row is wrapped in a conditional. The existing chip renders with only two visual states (confirmed = green, otherwise grey).

New design: always 3 chips, 3 visual states:
- **Empty** (`total === 0`): `bg-cloud-50 text-cloud-300` + icon only (no count text)
- **Partial** (`confirmed < total && total > 0`): `bg-amber-50 text-amber-700` + `confirmed/total`
- **Complete** (`confirmed === total && total > 0`): `bg-emerald-50 text-emerald-700` + `confirmed/total`

**Step 1: Write failing tests**

Add to `frontend/src/__tests__/TripCard.test.tsx`:

```typescript
describe('TripCard booking chips', () => {
  it('always renders all 3 booking chips even when totals are 0', () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    // mockTrip has no transport/lodging/activity fields — defaults to 0
    // All 3 chips should still appear (as empty/muted)
    // They render as icons — check for the chip container row
    const card = document.querySelector('.bg-white')
    // The booking chip row is always present
    // We check by finding all chip spans — there should be exactly 3
    const chipRow = document.querySelector('[data-testid="booking-chips"]')
    expect(chipRow).toBeInTheDocument()
    expect(chipRow!.children.length).toBe(3)
  })

  it('renders amber chip for partially confirmed bookings', () => {
    const trip = {
      ...mockTrip,
      transport_total: 2,
      transport_confirmed: 1,
    }
    renderWithProviders(<TripCard trip={trip} />)
    const chipRow = document.querySelector('[data-testid="booking-chips"]')
    const flightChip = chipRow!.children[0]
    expect(flightChip.className).toContain('bg-amber-50')
    expect(flightChip.textContent).toContain('1/2')
  })

  it('renders green chip for fully confirmed bookings', () => {
    const trip = {
      ...mockTrip,
      lodging_total: 3,
      lodging_confirmed: 3,
    }
    renderWithProviders(<TripCard trip={trip} />)
    const chipRow = document.querySelector('[data-testid="booking-chips"]')
    const hotelChip = chipRow!.children[1]
    expect(hotelChip.className).toContain('bg-emerald-50')
    expect(hotelChip.textContent).toContain('3/3')
  })

  it('renders muted chip for empty bookings (total 0)', () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    // mockTrip has activity_total undefined (defaults to 0)
    const chipRow = document.querySelector('[data-testid="booking-chips"]')
    const activityChip = chipRow!.children[2]
    expect(activityChip.className).toContain('bg-cloud-50')
    expect(activityChip.textContent).not.toContain('/')
  })
})
```

**Step 2: Run — expect fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: new tests fail (no `data-testid="booking-chips"`, conditional render).

**Step 3: Implement the changes in TripCard**

In `frontend/src/components/trips/TripCard.tsx`, replace the `bookingChips` array and its render:

```typescript
// Replace:
const bookingChips = [
  { icon: Plane, total: transport_total, confirmed: transport_confirmed, label: 'flight' },
  { icon: Hotel, total: lodging_total, confirmed: lodging_confirmed, label: 'hotel' },
  { icon: MapPin, total: activity_total, confirmed: activity_confirmed, label: 'activity' },
].filter((c) => c.total > 0)
```

```typescript
// With:
const bookingChips = [
  { icon: Plane, total: transport_total, confirmed: transport_confirmed, label: 'flight' },
  { icon: Hotel, total: lodging_total, confirmed: lodging_confirmed, label: 'hotel' },
  { icon: MapPin, total: activity_total, confirmed: activity_confirmed, label: 'activity' },
]
```

Replace the conditional chip render (lines 89–103):

```tsx
// Replace:
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

```tsx
// With:
<div className="flex items-center gap-2 mb-3" data-testid="booking-chips">
  {bookingChips.map(({ icon: Icon, total, confirmed, label }) => {
    const chipClass =
      total === 0
        ? 'bg-cloud-50 text-cloud-300'
        : confirmed === total
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700'
    return (
      <div
        key={label}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${chipClass}`}
      >
        <Icon className="w-3 h-3" />
        {total > 0 && <span>{confirmed}/{total}</span>}
      </div>
    )
  })}
</div>
```

**Step 4: Run — expect all pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

**Step 5: Full suite + type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run && npx tsc -b --noEmit
```

**Step 6: Commit**

```bash
git add frontend/src/components/trips/TripCard.tsx frontend/src/__tests__/TripCard.test.tsx
git commit -m "feat: always show all 3 booking chips on TripCard with empty/partial/complete states"
```

---

### Task 5: Dashboard "Needs Attention" panel

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/__tests__/DashboardPage.test.tsx`

**Context:**
`DashboardPage` currently has:
- `upcomingTrips`: non-completed trips sorted by start date, max 3
- "Quick Actions" section with static links (New Trip, View Calendar)
- `TripSummary` has: `transport_total`, `transport_confirmed`, `lodging_total`, `lodging_confirmed`, `activity_total` (note: no `activity_confirmed` in the type — check `frontend/src/lib/types.ts`)

Action items scan trips with status in `['planning', 'booked', 'active']`:
- Unconfirmed flights: `transport_total > 0 && transport_confirmed < transport_total`
- Unconfirmed hotels: `lodging_total > 0 && lodging_confirmed < lodging_total`
- Unplanned days: `itinerary_day_count > 0 && days_with_activities < itinerary_day_count`

Sort order: active first, then booked, then planning. Within same status, sort by start_date ascending. Cap at 5 items.

Quick links (New Trip + View Calendar) move below the panel as a compact row.

**Step 1: Check `TripSummary` type for `activity_confirmed`**

Run: `grep -n "activity_confirmed\|lodging_confirmed\|transport_confirmed" /Users/nick/Code/travel-planner/frontend/src/lib/types.ts`

If `activity_confirmed` is missing, only use `transport_confirmed` and `lodging_confirmed` for the action item checks. (The `activity` chip on TripCard uses `activity_confirmed` from trip data — check the full type.)

**Step 2: Write failing tests**

Create `frontend/src/__tests__/DashboardPage.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { DashboardPage } from '../pages/DashboardPage'
import type { TripSummary } from '../lib/types'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  itineraryApi: { getDays: vi.fn(), getActivities: vi.fn() },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' } }),
}))

function makeTrip(overrides: Partial<TripSummary>): TripSummary {
  return {
    id: 'trip-1',
    type: 'vacation',
    destination: 'Paris',
    start_date: '2026-06-01',
    end_date: '2026-06-07',
    status: 'planning',
    notes: null,
    parent_trip_id: null,
    created_at: '2026-01-01T00:00:00Z',
    member_count: 1,
    destination_latitude: null,
    destination_longitude: null,
    member_previews: [],
    itinerary_day_count: 5,
    days_with_activities: 5,
    transport_total: 0,
    transport_confirmed: 0,
    lodging_total: 0,
    lodging_confirmed: 0,
    activity_total: 0,
    activity_confirmed: 0,
    ...overrides,
  }
}

function renderWithProviders() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const TestComponent = () => <DashboardPage />
  const rootRoute = createRootRoute({ component: TestComponent })
  const routeTree = rootRoute.addChildren([])
  const memoryHistory = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({ routeTree, history: memoryHistory })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGet.mockReset()
})

describe('DashboardPage Needs Attention', () => {
  it('shows Needs Attention heading', async () => {
    mockGet.mockResolvedValue({ data: [] })
    renderWithProviders()
    expect(await screen.findByText(/needs attention/i)).toBeInTheDocument()
  })

  it('shows all caught up when no action items', async () => {
    const trip = makeTrip({
      status: 'planning',
      transport_total: 2,
      transport_confirmed: 2,
      lodging_total: 1,
      lodging_confirmed: 1,
      itinerary_day_count: 5,
      days_with_activities: 5,
    })
    mockGet.mockResolvedValue({ data: [trip] })
    renderWithProviders()
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
  })

  it('shows flight action item for unconfirmed transport', async () => {
    const trip = makeTrip({
      destination: 'Rome',
      status: 'booked',
      transport_total: 2,
      transport_confirmed: 1,
    })
    mockGet.mockResolvedValue({ data: [trip] })
    renderWithProviders()
    expect(await screen.findByText(/rome/i)).toBeInTheDocument()
    expect(await screen.findByText(/1 flight/i)).toBeInTheDocument()
  })

  it('shows hotel action item for unconfirmed lodging', async () => {
    const trip = makeTrip({
      destination: 'Tokyo',
      status: 'planning',
      lodging_total: 3,
      lodging_confirmed: 1,
    })
    mockGet.mockResolvedValue({ data: [trip] })
    renderWithProviders()
    expect(await screen.findByText(/2 hotel/i)).toBeInTheDocument()
  })

  it('shows itinerary action item for unplanned days', async () => {
    const trip = makeTrip({
      destination: 'Lisbon',
      status: 'booked',
      itinerary_day_count: 7,
      days_with_activities: 3,
    })
    mockGet.mockResolvedValue({ data: [trip] })
    renderWithProviders()
    expect(await screen.findByText(/4 day/i)).toBeInTheDocument()
  })

  it('does not show action items for completed trips', async () => {
    const trip = makeTrip({
      destination: 'Berlin',
      status: 'completed',
      transport_total: 2,
      transport_confirmed: 0,
    })
    mockGet.mockResolvedValue({ data: [trip] })
    renderWithProviders()
    await screen.findByText(/all caught up/i)
    expect(screen.queryByText(/berlin/i)).not.toBeInTheDocument()
  })
})
```

**Step 3: Run — expect fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: all new tests fail (no "Needs Attention" heading yet).

**Step 4: Implement the "Needs Attention" panel in DashboardPage**

In `frontend/src/pages/DashboardPage.tsx`:

Add `CheckCircle2, Plane, Hotel, MapPin` to the lucide-react imports (keep existing `Plus, Calendar, ArrowRight`).

Add these types and helpers above the `DashboardPage` function:

```typescript
const STATUS_ORDER: Record<string, number> = { active: 0, booked: 1, planning: 2 }

type ActionItem = {
  tripId: string
  destination: string
  icon: React.ElementType
  label: string
}

function getActionItems(trips: import('../lib/types').TripSummary[]): ActionItem[] {
  const actionable = trips.filter((t) =>
    ['planning', 'booked', 'active'].includes(t.status)
  )
  actionable.sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    return a.start_date.localeCompare(b.start_date)
  })

  const items: ActionItem[] = []
  for (const trip of actionable) {
    const unconfirmedFlights = (trip.transport_total ?? 0) - (trip.transport_confirmed ?? 0)
    if (unconfirmedFlights > 0) {
      items.push({
        tripId: trip.id,
        destination: trip.destination,
        icon: Plane,
        label: `${unconfirmedFlights} flight${unconfirmedFlights > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unconfirmedHotels = (trip.lodging_total ?? 0) - (trip.lodging_confirmed ?? 0)
    if (unconfirmedHotels > 0) {
      items.push({
        tripId: trip.id,
        destination: trip.destination,
        icon: Hotel,
        label: `${unconfirmedHotels} hotel${unconfirmedHotels > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unplannedDays = (trip.itinerary_day_count ?? 0) - (trip.days_with_activities ?? 0)
    if (unplannedDays > 0) {
      items.push({
        tripId: trip.id,
        destination: trip.destination,
        icon: Calendar,
        label: `${unplannedDays} day${unplannedDays > 1 ? 's' : ''} not planned`,
      })
    }
    if (items.length >= 5) break
  }
  return items.slice(0, 5)
}
```

Replace the "Quick Actions" section in the JSX (the entire `<div>` with `<h2>Quick Actions</h2>`):

```tsx
{/* Needs Attention */}
<div>
  <h2 className="text-lg font-semibold text-cloud-900 mb-3">Needs Attention</h2>
  {isLoading ? (
    <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
  ) : (() => {
    const items = getActionItems(trips ?? [])
    if (items.length === 0) {
      return (
        <div className="bg-white rounded-xl border border-cloud-200 p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-sm text-cloud-600">All caught up</p>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <Link
            key={idx}
            to="/trips/$tripId"
            params={{ tripId: item.tripId }}
            className="flex items-center justify-between p-3 bg-white rounded-xl border border-cloud-200 hover:border-amber-200 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <item.icon className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-cloud-800 group-hover:text-indigo-700 truncate">{item.destination}</p>
                <p className="text-xs text-cloud-500">{item.label}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-cloud-400 group-hover:text-indigo-500 shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    )
  })()}

  {/* Quick links */}
  <div className="flex gap-3 mt-4">
    <Link
      to="/trips/new"
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cloud-700 bg-white border border-cloud-200 rounded-lg hover:border-indigo-200 hover:text-indigo-700 transition-colors"
    >
      <Plus className="w-4 h-4" />
      New Trip
    </Link>
    <Link
      to="/calendar"
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cloud-700 bg-white border border-cloud-200 rounded-lg hover:border-indigo-200 hover:text-indigo-700 transition-colors"
    >
      <Calendar className="w-4 h-4" />
      Calendar
    </Link>
  </div>
</div>
```

**Step 5: Run — expect all pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

**Step 6: Full suite + type check + lint**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run && npx tsc -b --noEmit && npm run lint
```

**Step 7: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat: replace Quick Actions with dynamic Needs Attention panel on dashboard"
```
