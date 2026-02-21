# Calendar & Itinerary UX Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Five independent UX improvements: DnD drop indicator, add/cancel button toggle, multi-select trip filters, month view holiday positioning, and year view planning board with trip inventory panel.

**Architecture:** All frontend-only changes. Tasks 1–2 touch `ItineraryTimeline.tsx`. Task 3 changes `TripsPage.tsx` to filter client-side. Task 4 changes `DayCell.tsx`. Task 5 restructures `YearView.tsx` with a new trip inventory panel. No backend changes.

**Tech Stack:** React, TypeScript, @dnd-kit/core, TanStack Query, Tailwind CSS, lucide-react, vitest + @testing-library/react

---

### Task 1: DnD drop indicator for days with activities

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`
- Test: `frontend/src/__tests__/TripDetailPage.test.tsx`

**Context:** `DroppableDay` is a wrapper component in `ItineraryTimeline.tsx` that uses `useDroppable` from `@dnd-kit/core`. It receives `isOver` from the hook. Currently it only shows a faint background tint when `isOver` is true. Empty days use a separate `EmptyDayDropZone` component with a visible dashed border. Days that already have activities need the same visual treatment during drag-over.

---

**Step 1: Write the failing test**

In `frontend/src/__tests__/TripDetailPage.test.tsx`, add this test inside the `describe('TripDetailPage')` block:

```typescript
it('shows drop indicator below activities in a day that has activities', async () => {
  const mockDay = {
    id: 'day-1',
    trip_id: 'trip-1',
    date: '2026-06-15',
    notes: null,
    activity_count: 1,
  }
  const mockActivity = {
    id: 'act-1',
    itinerary_day_id: 'day-1',
    title: 'Museum Visit',
    category: 'activity',
    start_time: null,
    end_time: null,
    location: null,
    latitude: null,
    longitude: null,
    notes: null,
    confirmation_number: null,
    sort_order: 0,
    check_out_date: null,
  }
  mockGetTrip.mockResolvedValue({ data: mockTrip })
  mockItineraryListDays.mockResolvedValue({ data: [mockDay] })
  mockItineraryListActivities.mockResolvedValue({ data: [mockActivity] })
  renderWithRouter()

  // Timeline renders
  await screen.findByTestId('itinerary-timeline')
  // No drop indicator visible when not dragging
  expect(document.querySelector('[data-testid="drop-hint"]')).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripDetailPage.test.tsx
```

Expected: FAIL — `data-testid="drop-hint"` does not exist yet (test may pass vacuously — that's OK, proceed to implementation).

---

**Step 3: Implement — update `DroppableDay` in `ItineraryTimeline.tsx`**

Change the `DroppableDay` function signature and body to accept `hasActivities` and conditionally render a drop hint:

```typescript
function DroppableDay({ dayId, hasActivities, children }: { dayId: string; hasActivities: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayId}`, data: { dayId } })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[2.5rem] rounded transition-colors ${isOver && !hasActivities ? 'bg-indigo-50/50' : ''}`}
    >
      {children}
      {isOver && hasActivities && (
        <div
          data-testid="drop-hint"
          className="h-10 rounded border-2 border-dashed border-indigo-400 bg-indigo-50 mt-2 transition-colors"
        />
      )}
    </div>
  )
}
```

Update the call site in the render (inside the `days.map` block) to pass `hasActivities`:

```typescript
<DroppableDay dayId={day.id} hasActivities={dayActs.length > 0}>
```

The `EmptyDayDropZone` is still rendered when `dayActs.length === 0 && !isAdding` — no change there.

**Step 4: Run all frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add frontend/src/components/itinerary/ItineraryTimeline.tsx frontend/src/__tests__/TripDetailPage.test.tsx
git commit -m "feat: show drop indicator on days with activities during drag"
```

---

### Task 2: "Add activity" button toggles to "Cancel"

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`
- Test: `frontend/src/__tests__/TripDetailPage.test.tsx`

**Context:** In `ItineraryTimeline.tsx`, each day header has a button that sets `expandedDayId` to show the `ActivityForm`. The button always shows `<Plus> Add activity`. When `isAdding === true` (form is open), the button should instead show `<X> Cancel`.

---

**Step 1: Write the failing test**

Add to the `describe('TripDetailPage')` block in `frontend/src/__tests__/TripDetailPage.test.tsx`:

```typescript
it('toggles Add activity button to Cancel when form is open', async () => {
  const user = userEvent.setup()
  const mockDay = {
    id: 'day-1',
    trip_id: 'trip-1',
    date: '2026-06-15',
    notes: null,
    activity_count: 0,
  }
  mockGetTrip.mockResolvedValue({ data: mockTrip })
  mockItineraryListDays.mockResolvedValue({ data: [mockDay] })
  mockItineraryListActivities.mockResolvedValue({ data: [] })
  renderWithRouter()

  // Initially shows "Add activity"
  const addBtn = await screen.findByText('Add activity')
  expect(addBtn).toBeInTheDocument()

  // Click to open form
  await user.click(addBtn)

  // Now shows "Cancel"
  expect(screen.getByText('Cancel')).toBeInTheDocument()
  expect(screen.queryByText('Add activity')).not.toBeInTheDocument()

  // Click Cancel to close
  await user.click(screen.getByText('Cancel'))
  expect(await screen.findByText('Add activity')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripDetailPage.test.tsx
```

Expected: FAIL — "Cancel" not found.

---

**Step 3: Implement**

In `ItineraryTimeline.tsx`, add `X` to the lucide-react import (line 2):

```typescript
import { Plus, Trash2, X } from 'lucide-react'
```

Replace the day header button (currently shows `<Plus className="w-3 h-3" /> Add activity`) with:

```typescript
<button
  onClick={() => setExpandedDayId(isAdding ? null : day.id)}
  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
>
  {isAdding ? (
    <>
      <X className="w-3 h-3" />
      Cancel
    </>
  ) : (
    <>
      <Plus className="w-3 h-3" />
      Add activity
    </>
  )}
</button>
```

**Step 4: Run all frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add frontend/src/components/itinerary/ItineraryTimeline.tsx frontend/src/__tests__/TripDetailPage.test.tsx
git commit -m "feat: toggle Add activity button to Cancel when form is open"
```

---

### Task 3: Multi-select status filters on My Trips

**Files:**
- Modify: `frontend/src/pages/TripsPage.tsx`
- Modify: `frontend/src/__tests__/TripsPage.test.tsx`

**Context:** `TripsPage.tsx` has a single-select filter that passes `status` to `useTrips()`. The `useTrips` hook accepts an optional `status?: TripStatus` and passes it as a query param. We switch to client-side filtering: always fetch all trips (`useTrips()` with no arg), maintain a `TripStatus[]` set, and filter the result in the component. The `useTrips` hook itself does not need to change.

---

**Step 1: Update the existing filter test and add new multi-select tests**

In `frontend/src/__tests__/TripsPage.test.tsx`, replace the test `'clicking a status filter pill refetches with status param'` (lines 140–158) with:

```typescript
it('clicking a status filter pill filters trips client-side', async () => {
  const user = userEvent.setup()
  mockGet.mockResolvedValue({ data: mockTrips })
  renderWithProviders(<TripsPage />)

  // Both trips visible initially
  expect(await screen.findByText('Paris, France')).toBeInTheDocument()
  expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()

  // Click "Planning" filter — only Paris (planning) shown
  const filterButtons = screen.getAllByText('Planning')
  const filterPill = filterButtons.find(
    (el) => el.tagName === 'BUTTON' && !el.closest('[data-testid]')
  )!
  await user.click(filterPill)

  expect(screen.getByText('Paris, France')).toBeInTheDocument()
  expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()
})

it('allows selecting multiple status filters simultaneously', async () => {
  const user = userEvent.setup()
  mockGet.mockResolvedValue({ data: mockTrips })
  renderWithProviders(<TripsPage />)

  await screen.findByText('Paris, France')

  // Select "Planning"
  const allPlanningText = screen.getAllByText('Planning')
  const planningPill = allPlanningText.find((el) => el.tagName === 'BUTTON' && !el.closest('[data-testid]'))!
  await user.click(planningPill)

  // Only Paris visible
  expect(screen.getByText('Paris, France')).toBeInTheDocument()
  expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()

  // Also select "Dreaming"
  await user.click(screen.getByRole('button', { name: 'Dreaming' }))

  // Both visible now
  expect(screen.getByText('Paris, France')).toBeInTheDocument()
  expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()
})

it('clicking All clears active status filters', async () => {
  const user = userEvent.setup()
  mockGet.mockResolvedValue({ data: mockTrips })
  renderWithProviders(<TripsPage />)

  await screen.findByText('Paris, France')

  // Select "Planning" to filter
  const allPlanningText = screen.getAllByText('Planning')
  const planningPill = allPlanningText.find((el) => el.tagName === 'BUTTON' && !el.closest('[data-testid]'))!
  await user.click(planningPill)
  expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()

  // Click All to clear
  await user.click(screen.getByRole('button', { name: 'All' }))
  expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

Expected: 2–3 failures for the new tests.

---

**Step 3: Implement changes in `TripsPage.tsx`**

Replace the full `TripsPage.tsx` content:

```typescript
import { useState } from 'react'
import { Plus, TriangleAlert } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTrips } from '../hooks/useTrips'
import { TripCard } from '../components/trips/TripCard'
import { EmptyTripsState } from '../components/trips/EmptyTripsState'
import type { TripStatus } from '../lib/types'

const statusFilters: { value: TripStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'dreaming', label: 'Dreaming' },
  { value: 'planning', label: 'Planning' },
  { value: 'booked', label: 'Booked' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-cloud-100 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-6 bg-cloud-200 rounded-lg w-2/3" />
        <div className="h-5 bg-cloud-200 rounded-full w-20" />
      </div>
      <div className="h-4 bg-cloud-200 rounded w-1/2 mb-4" />
      <div className="flex items-center justify-between">
        <div className="h-5 bg-cloud-200 rounded-full w-16" />
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full bg-cloud-200" />
          <div className="w-7 h-7 rounded-full bg-cloud-200" />
        </div>
      </div>
    </div>
  )
}

export function TripsPage() {
  const [activeStatuses, setActiveStatuses] = useState<TripStatus[]>([])
  const { data: allTrips, isLoading, error, refetch } = useTrips()

  function toggleStatus(value: TripStatus | undefined) {
    if (value === undefined) {
      setActiveStatuses([])
      return
    }
    setActiveStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  const trips =
    activeStatuses.length === 0
      ? allTrips
      : allTrips?.filter((t) => activeStatuses.includes(t.status))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-cloud-900">My Trips</h1>
        <Link
          to="/trips/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          New Trip
        </Link>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map((filter) => {
          const isActive =
            filter.value === undefined
              ? activeStatuses.length === 0
              : activeStatuses.includes(filter.value)
          return (
            <button
              key={filter.label}
              onClick={() => toggleStatus(filter.value)}
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

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-50 to-red-100/80 ring-1 ring-red-200/50 mb-4">
            <TriangleAlert className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-cloud-600 mb-4">Something went wrong loading your trips.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && trips && trips.length === 0 && (
        <EmptyTripsState />
      )}

      {/* Trip Grid */}
      {!isLoading && !error && trips && trips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run all frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add frontend/src/pages/TripsPage.tsx frontend/src/__tests__/TripsPage.test.tsx
git commit -m "feat: multi-select status filters with client-side filtering on trips page"
```

---

### Task 4: Month view — holiday label stays visible above trip bars

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`
- Modify: `frontend/src/__tests__/DayCell.test.tsx`

**Context:** In `DayCell` full (non-compact) mode, the holiday/custom-day label renders below the date number circle. Trip bars in `MonthView` are absolutely positioned starting at `top: 2.5rem`, which overlaps this label. Fix: render the label on the same horizontal line as the date number circle (right-aligned), keeping it above the `2.5rem` trip bar zone.

---

**Step 1: Write the failing test**

Add to `frontend/src/__tests__/DayCell.test.tsx`:

```typescript
describe('DayCell full mode holiday label', () => {
  it('renders holiday label on same row as date number (not below)', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
      />
    )
    // The date number and holiday label should share a parent flex row
    const flexRow = container.querySelector('.flex.items-start.justify-between')
    expect(flexRow).toBeInTheDocument()
    // Holiday label is inside that flex row
    const label = container.querySelector('.flex.items-start.justify-between span:last-child')
    expect(label?.textContent).toBe('Christmas')
  })

  it('does not render holiday label below the date number in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
      />
    )
    // No <p> tag with the label (old layout used <p>)
    const pTags = container.querySelectorAll('p')
    const labelP = Array.from(pTags).find((p) => p.textContent === 'Christmas')
    expect(labelP).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: FAIL — flex row with `justify-between` not found; `<p>` with holiday label IS found.

---

**Step 3: Implement — update full mode in `DayCell.tsx`**

Replace the full (non-compact) return in `DayCell.tsx`. The compact block is unchanged. Only the second `return` (starting at line 68) changes:

```typescript
  return (
    <div
      className={`min-h-[5rem] p-1.5 border-b border-r border-cloud-100 cursor-pointer select-none transition-colors
        ${isCurrentMonth ? 'bg-white' : 'bg-cloud-50/50'}
        ${isSelected ? 'bg-indigo-50' : ''}
        ${isSelectedForCreate ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50' : ''}
        hover:bg-cloud-50
      `}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown?.(date)
      }}
      onMouseEnter={() => onMouseEnter?.(date)}
      onClick={() => {
        if (holidayLabel && onHolidayClick) {
          onHolidayClick(date)
        }
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full shrink-0
            ${isToday ? 'bg-indigo-600 text-white font-bold' : ''}
            ${!isToday && isCurrentMonth ? 'text-cloud-800' : ''}
            ${!isToday && !isCurrentMonth ? 'text-cloud-400' : ''}
          `}
        >
          {dayNumber}
        </span>
        {label && (
          <span className={`text-[10px] leading-tight mt-1 truncate max-w-[calc(100%-2rem)] text-right ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
```

**Step 4: Run all frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add frontend/src/components/planning/DayCell.tsx frontend/src/__tests__/DayCell.test.tsx
git commit -m "fix: render holiday label inline with date number to prevent trip bar overlap"
```

---

### Task 5: Year view — 3-column grid + trip inventory panel

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/__tests__/YearView.test.tsx`

**Context:** The year view is a planning tool. Changes: (1) switch from 4-col to 3-col grid, (2) upgrade trip bars from `size="small"` (`h-1.5`) to `size="medium"` (`h-3`) so destination labels show inline, (3) increase the trip bar strip height from `h-4` to `h-8` to accommodate the taller bars, (4) add a right-side trip inventory panel showing trips chronologically with gap rows (≥14 days free between trips) and a custom days section below.

**Important:** The existing `YearView` tests check for `.relative.h-4` — this becomes `.relative.h-8` with the taller bars. Update those tests.

---

**Step 1: Update existing tests and write new ones**

Replace the contents of `frontend/src/__tests__/YearView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { YearView } from '../components/planning/YearView'
import type { TripSummary, CustomDay } from '../lib/types'

const baseProps = {
  year: 2026,
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  onMonthClick: () => {},
  onDayClick: () => {},
  onTripClick: () => {},
}

const makeTripSummary = (overrides: Partial<TripSummary>): TripSummary => ({
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
  itinerary_day_count: 0,
  days_with_activities: 0,
  ...overrides,
})

describe('YearView grid lines', () => {
  it('renders day grids with border-t border-l border-cloud-100', () => {
    const { container } = render(<YearView {...baseProps} />)
    const dayGrids = container.querySelectorAll('.grid.grid-cols-7.border-t.border-l')
    expect(dayGrids.length).toBeGreaterThan(0)
  })

  it('does not use gap-px', () => {
    const { container } = render(<YearView {...baseProps} />)
    const gapGrids = container.querySelectorAll('.gap-px')
    expect(gapGrids.length).toBe(0)
  })

  it('renders padding cells with border-b border-r border-cloud-100', () => {
    const { container } = render(<YearView {...baseProps} />)
    const paddingCells = container.querySelectorAll('.aspect-square.border-b.border-r.border-cloud-100:not(.cursor-pointer)')
    expect(paddingCells.length).toBeGreaterThan(0)
  })
})

describe('YearView week container layout', () => {
  it('week container uses flex flex-col', () => {
    const { container } = render(<YearView {...baseProps} />)
    const flexContainers = container.querySelectorAll('.flex.flex-col')
    expect(flexContainers.length).toBeGreaterThan(0)
  })

  it('renders a relative h-8 trip bar strip below the day grid', () => {
    const { container } = render(<YearView {...baseProps} />)
    const strips = container.querySelectorAll('.relative.h-8')
    expect(strips.length).toBeGreaterThan(0)
  })
})

describe('YearView layout', () => {
  it('uses 3-column grid for mini calendars', () => {
    const { container } = render(<YearView {...baseProps} />)
    const threeColGrid = container.querySelector('.grid.grid-cols-3')
    expect(threeColGrid).toBeInTheDocument()
  })
})

describe('YearView trip inventory panel', () => {
  it('renders trip inventory panel heading', () => {
    render(<YearView {...baseProps} />)
    expect(screen.getByText(/trips 2026/i)).toBeInTheDocument()
  })

  it('renders a trip row in the inventory panel', () => {
    const trips = [makeTripSummary({ destination: 'Tokyo', start_date: '2026-09-01', end_date: '2026-09-14' })]
    render(<YearView {...baseProps} trips={trips} />)
    // destination appears in inventory panel
    expect(screen.getAllByText('Tokyo').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a gap row when two trips have 14+ days between them', () => {
    const trips = [
      makeTripSummary({ id: 'trip-1', destination: 'Paris', start_date: '2026-03-01', end_date: '2026-03-07' }),
      makeTripSummary({ id: 'trip-2', destination: 'Tokyo', start_date: '2026-06-01', end_date: '2026-06-07' }),
    ]
    render(<YearView {...baseProps} trips={trips} />)
    expect(screen.getByText(/weeks free/i)).toBeInTheDocument()
  })

  it('does not render a gap row when trips are fewer than 14 days apart', () => {
    const trips = [
      makeTripSummary({ id: 'trip-1', destination: 'Paris', start_date: '2026-03-01', end_date: '2026-03-07' }),
      makeTripSummary({ id: 'trip-2', destination: 'Tokyo', start_date: '2026-03-10', end_date: '2026-03-14' }),
    ]
    render(<YearView {...baseProps} trips={trips} />)
    expect(screen.queryByText(/weeks free/i)).not.toBeInTheDocument()
  })

  it('renders custom days section when custom days exist', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Ironman Zurich', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    render(<YearView {...baseProps} customDays={customDays} />)
    expect(screen.getByText('Ironman Zurich')).toBeInTheDocument()
  })

  it('does not render custom days section when there are no custom days', () => {
    render(<YearView {...baseProps} customDays={[]} />)
    expect(screen.queryByText(/events/i)).not.toBeInTheDocument()
  })

  it('shows no trips message when year has no trips', () => {
    render(<YearView {...baseProps} trips={[]} />)
    expect(screen.getByText(/no trips planned/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify new ones fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: several failures (inventory panel, 3-col grid, h-8 strip).

---

**Step 3: Implement the new `YearView.tsx`**

Replace the entire file:

```typescript
import { useMemo } from 'react'
import { DayCell } from './DayCell'
import { TripSpan } from './TripSpan'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

interface YearViewProps {
  year: number
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  selectedDate?: string | null
  onMonthClick: (month: number) => void
  onDayClick: (date: string) => void
  onTripClick: (trip: TripSummary) => void
  onHolidayClick?: (date: string) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_DOT: Record<string, string> = {
  dreaming: 'bg-purple-400',
  planning: 'bg-blue-400',
  booked: 'bg-green-400',
  active: 'bg-orange-400',
  completed: 'bg-cloud-400',
}

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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type InventoryItem =
  | { type: 'trip'; trip: TripSummary }
  | { type: 'gap'; weeks: number }

function buildInventory(trips: TripSummary[], year: number): InventoryItem[] {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const yearTrips = trips
    .filter((t) => t.start_date <= yearEnd && t.end_date >= yearStart)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const items: InventoryItem[] = []
  for (let i = 0; i < yearTrips.length; i++) {
    if (i > 0) {
      const prevEnd = yearTrips[i - 1].end_date
      const currStart = yearTrips[i].start_date
      const gapDays = Math.floor(
        (new Date(currStart + 'T00:00:00').getTime() - new Date(prevEnd + 'T00:00:00').getTime()) /
          (1000 * 60 * 60 * 24)
      )
      if (gapDays >= 14) {
        items.push({ type: 'gap', weeks: Math.floor(gapDays / 7) })
      }
    }
    items.push({ type: 'trip', trip: yearTrips[i] })
  }
  return items
}

export function YearView({
  year,
  trips,
  holidays,
  customDays,
  selectedDate,
  onMonthClick,
  onDayClick,
  onTripClick,
  onHolidayClick,
}: YearViewProps) {
  const today = new Date().toISOString().split('T')[0]

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of holidays) {
      map.set(h.date, h.name)
    }
    return map
  }, [holidays])

  const customDaySet = useMemo(() => {
    return new Set(customDays.map((cd) => (cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date)))
  }, [customDays, year])

  const inventory = useMemo(() => buildInventory(trips, year), [trips, year])

  const customDaysForYear = useMemo(() => {
    return customDays
      .map((cd) => ({ ...cd, resolvedDate: cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date }))
      .filter((cd) => cd.resolvedDate.startsWith(String(year)))
      .sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate))
  }, [customDays, year])

  return (
    <div className="flex">
      {/* Mini calendar grid — 3 columns */}
      <div className="flex-1 grid grid-cols-3 gap-6 p-4 min-w-0">
        {MONTH_NAMES.map((name, month) => {
          const days = getMiniGrid(year, month)
          const monthStart = formatDate(year, month, 1)
          const monthEnd = formatDate(year, month, new Date(year, month + 1, 0).getDate())
          const monthTrips = trips.filter((t) => t.start_date <= monthEnd && t.end_date >= monthStart)

          const weeks: typeof days[] = []
          for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7))
          }

          return (
            <div key={month}>
              <button
                onClick={() => onMonthClick(month)}
                className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
              >
                {name}
              </button>
              {weeks.map((week, weekIdx) => {
                const weekStart = week.find((d) => d.isCurrentMonth)?.date ?? monthStart
                const weekEnd = [...week].reverse().find((d) => d.isCurrentMonth)?.date ?? monthEnd
                const weekTrips = monthTrips.filter(
                  (t) => t.start_date <= weekEnd && t.end_date >= weekStart
                )
                return (
                  <div key={weekIdx} className="flex flex-col">
                    <div className="grid grid-cols-7 border-t border-l border-cloud-100">
                      {week.map((day, i) => {
                        if (!day.isCurrentMonth) {
                          return <div key={i} className="aspect-square border-b border-r border-cloud-100" />
                        }
                        return (
                          <DayCell
                            key={day.date}
                            date={day.date}
                            dayNumber={day.dayNumber}
                            isToday={day.date === today}
                            isCurrentMonth
                            isSelected={false}
                            isSelectedForCreate={day.date === selectedDate}
                            holidayLabel={holidayMap.get(day.date)}
                            customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
                            compact
                            onClick={() => onDayClick(day.date)}
                            onHolidayClick={onHolidayClick}
                          />
                        )
                      })}
                    </div>
                    {/* Trip bar strip — h-8 to fit medium-size bars */}
                    <div className="relative h-8">
                      {weekTrips.slice(0, 2).map((trip, tripIdx) => {
                        const startCol = Math.max(
                          0,
                          week.findIndex((d) => d.isCurrentMonth && d.date >= trip.start_date)
                        )
                        const endIdx = week.findIndex((d) => d.isCurrentMonth && d.date > trip.end_date)
                        const endCol = endIdx === -1 ? 7 : endIdx
                        const colSpan = endCol - startCol
                        if (colSpan <= 0) return null

                        return (
                          <TripSpan
                            key={trip.id}
                            destination={trip.destination}
                            status={trip.status}
                            colorBy="type"
                            tripType={trip.type}
                            startCol={startCol}
                            colSpan={colSpan}
                            stackIndex={tripIdx}
                            size="medium"
                            startDate={trip.start_date}
                            endDate={trip.end_date}
                            onClick={() => onTripClick(trip)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Trip inventory panel */}
      <div className="w-60 shrink-0 border-l border-cloud-200 p-4 overflow-y-auto">
        <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
          Trips {year}
        </h3>

        {inventory.length === 0 && (
          <p className="text-xs text-cloud-400 italic">No trips planned</p>
        )}

        {inventory.map((item, idx) => {
          if (item.type === 'gap') {
            return (
              <div key={`gap-${idx}`} className="flex items-center gap-1 py-2">
                <div className="flex-1 border-t border-dashed border-cloud-200" />
                <span className="text-[10px] text-cloud-400 whitespace-nowrap shrink-0">
                  {item.weeks} weeks free
                </span>
                <div className="flex-1 border-t border-dashed border-cloud-200" />
              </div>
            )
          }

          const { trip } = item
          const dotColor = STATUS_DOT[trip.status] ?? 'bg-cloud-400'
          return (
            <button
              key={trip.id}
              onClick={() => onTripClick(trip)}
              className="w-full flex items-start gap-2 py-2 text-left hover:bg-cloud-50 rounded-lg px-1 -mx-1 transition-colors group"
            >
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${dotColor}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-cloud-800 truncate group-hover:text-indigo-700 transition-colors">
                  {trip.destination}
                </p>
                <p className="text-[10px] text-cloud-500">
                  {formatShortDate(trip.start_date)} – {formatShortDate(trip.end_date)}
                </p>
              </div>
            </button>
          )
        })}

        {/* Custom days / events section */}
        {customDaysForYear.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cloud-200">
            <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
              Events
            </h3>
            {customDaysForYear.map((cd) => (
              <div key={cd.id} className="flex items-start gap-2 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-cloud-800 truncate">{cd.name}</p>
                  <p className="text-[10px] text-cloud-500">{formatShortDate(cd.resolvedDate)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Run all frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: all tests pass.

**Step 5: Type check and lint**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint
```

Expected: no errors.

**Step 6: Commit**

```bash
git add frontend/src/components/planning/YearView.tsx frontend/src/__tests__/YearView.test.tsx
git commit -m "feat: year view planning board with 3-col grid and trip inventory panel"
```
