# Filter & Card Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three focused UI improvements: cap Needs Attention at 3 groups with a Show more button, merge filter rows into one with teal type pills (new defaults), and make TripCards the same height within grid rows.

**Architecture:** All frontend-only changes across three files. No backend changes. Each task is self-contained and independently testable.

**Tech Stack:** React, TypeScript, Tailwind CSS, vitest + Testing Library

---

### Task 1: Dashboard — Needs Attention "Show more" (cap 3 groups)

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

The `DashboardPage` component currently renders all `getActionGroups()` results. Add an `expanded` state (default `false`) that slices the groups array to 3 when collapsed. Render a "Show more (N more)" button below when there are more than 3 groups.

---

**Step 1: Write the failing test**

Open `frontend/src/__tests__/DashboardPage.test.tsx`. Inside `describe('DashboardPage Needs Attention')`, add after the existing tests:

```typescript
  it('shows only 3 trip groups by default when more than 3 have action items', async () => {
    const trips = Array.from({ length: 4 }, (_, i) =>
      makeTrip({
        id: `trip-${i + 1}`,
        destination: `City ${i + 1}`,
        status: 'booked',
        transport_total: 1,
        transport_confirmed: 0,
        start_date: `2026-0${i + 3}-01`,
      })
    )
    mockUseTrips.mockReturnValue({ data: trips, isLoading: false })
    renderDashboard()

    // Only first 3 group headers visible
    expect(await screen.findByText('City 1')).toBeInTheDocument()
    expect(screen.getByText('City 2')).toBeInTheDocument()
    expect(screen.getByText('City 3')).toBeInTheDocument()
    expect(screen.queryByText('City 4')).not.toBeInTheDocument()

    // Show more button visible
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
  })

  it('shows all trip groups after clicking Show more', async () => {
    const user = userEvent.setup()
    const trips = Array.from({ length: 4 }, (_, i) =>
      makeTrip({
        id: `trip-${i + 1}`,
        destination: `City ${i + 1}`,
        status: 'booked',
        transport_total: 1,
        transport_confirmed: 0,
        start_date: `2026-0${i + 3}-01`,
      })
    )
    mockUseTrips.mockReturnValue({ data: trips, isLoading: false })
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /show more/i }))

    expect(screen.getByText('City 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })
```

Also ensure `userEvent` is imported at the top of the test file. Check the existing imports — if `@testing-library/user-event` is not yet imported, add:

```typescript
import userEvent from '@testing-library/user-event'
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: the 2 new tests fail (City 4 is always shown, no Show more button).

**Step 3: Update DashboardPage.tsx**

Open `frontend/src/pages/DashboardPage.tsx`.

**3a.** At the top of `DashboardPage`, add `useState` to the React import. The file already imports from 'react' — update:

```typescript
// Before (line 1):
import { Suspense, lazy } from 'react'
// After:
import { Suspense, lazy, useState } from 'react'
```

**3b.** Inside the `DashboardPage` function body, add `expanded` state after the `navigate` declaration:

```typescript
const [needsAttentionExpanded, setNeedsAttentionExpanded] = useState(false)
```

**3c.** In the Needs Attention JSX section, locate the `(() => { const groups = getActionGroups(trips ?? [])` IIFE. Inside it, after computing `groups` and before the `if (groups.length === 0)` check, add the slice:

```typescript
const groups = getActionGroups(trips ?? [])
const visibleGroups = needsAttentionExpanded ? groups : groups.slice(0, 3)
const hiddenCount = groups.length - visibleGroups.length
```

Then change `groups.map(...)` to `visibleGroups.map(...)`.

After the closing `</div>` of the `space-y-3` groups container (but still inside the outer `return`), add the Show more button:

```tsx
{hiddenCount > 0 && (
  <button
    onClick={() => setNeedsAttentionExpanded(true)}
    className="w-full mt-2 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
  >
    Show more ({hiddenCount} more)
  </button>
)}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DashboardPage.test.tsx
```

Expected: all DashboardPage tests pass.

**Step 5: Run all frontend checks**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/DashboardPage.test.tsx && git commit -m "feat: cap Needs Attention at 3 groups with Show more button"
```

---

### Task 2: My Trips — single filter row with teal type pills + new defaults

**Files:**
- Modify: `frontend/src/pages/TripsPage.tsx`
- Test: `frontend/src/__tests__/TripsPage.test.tsx`

Currently two separate `<div>` rows of filter pills. Merge into one `flex-wrap` row with a thin vertical divider between status and type pills. Change type pill active color from indigo to teal. Change default `activeTypes` from `[]` to `['vacation', 'remote_week', 'sabbatical']`.

---

**Step 1: Write the failing tests**

Open `frontend/src/__tests__/TripsPage.test.tsx`. Add these tests inside the main `describe('TripsPage')` block:

```typescript
  it('renders type filter pills in the same container as status pills', async () => {
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    // Both status and type pills should be present
    expect(await screen.findByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All Types' })).toBeInTheDocument()

    // Both should be in a single filter row (check they share a parent)
    const allBtn = screen.getByRole('button', { name: 'All' })
    const allTypesBtn = screen.getByRole('button', { name: 'All Types' })
    expect(allBtn.closest('[data-testid="filter-row"]')).toBe(
      allTypesBtn.closest('[data-testid="filter-row"]')
    )
  })

  it('defaults type filter to vacation, remote_week, sabbatical', async () => {
    const tripsAllTypes = [
      ...mockTrips,
      { ...mockTrips[0], id: 'ev-1', type: 'event' as const, destination: 'Boston Marathon', status: 'booked' as const },
      { ...mockTrips[0], id: 'sb-1', type: 'sabbatical' as const, destination: 'Tor de Géants', status: 'planning' as const },
    ]
    mockGet.mockResolvedValue({ data: tripsAllTypes })
    renderWithProviders(<TripsPage />)

    // Click All status to show all statuses
    await userEvent.setup().click(await screen.findByRole('button', { name: 'All' }))

    // Sabbatical should be visible (in default)
    expect(screen.getByText('Tor de Géants')).toBeInTheDocument()
    // Event should NOT be visible (not in default)
    expect(screen.queryByText('Boston Marathon')).not.toBeInTheDocument()
  })

  it('type filter pills use teal color when active', async () => {
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    // "Vacation" pill is active by default — should have teal classes
    const vacationBtn = await screen.findByRole('button', { name: 'Vacation' })
    expect(vacationBtn.className).toContain('teal')
  })
```

Also ensure `userEvent` is imported — add if not present:

```typescript
import userEvent from '@testing-library/user-event'
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

Expected: all 3 new tests fail.

**Step 3: Update TripsPage.tsx**

Open `frontend/src/pages/TripsPage.tsx`.

**3a.** Change the `activeTypes` default value:

```typescript
// Before:
const [activeTypes, setActiveTypes] = useState<TripType[]>([])
// After:
const [activeTypes, setActiveTypes] = useState<TripType[]>(['vacation', 'remote_week', 'sabbatical'])
```

**3b.** Replace the two separate filter `<div>` blocks (Status Filter Pills and Type Filter Pills) with a single unified row:

```tsx
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6" data-testid="filter-row">
        {statusFilters.map((filter) => {
          const isActive =
            filter.value === undefined
              ? activeStatuses.length === 0
              : activeStatuses.includes(filter.value)
          return (
            <button
              key={filter.label}
              data-testid="status-filter"
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

        <div className="w-px h-6 bg-cloud-200 self-center mx-1" aria-hidden="true" />

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
                  ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-600/20 ring-offset-1'
                  : 'bg-white text-cloud-600 border border-teal-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/50'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
```

**3c.** Update the `toggleType` function — when "All Types" is clicked (value === undefined), it should reset to `[]` (which means all types visible), not to the original default. The current logic is correct — `undefined` sets `activeTypes` to `[]`. No change needed here.

**Step 4: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripsPage.test.tsx
```

Expected: all TripsPage tests pass.

**Step 5: Run all frontend checks**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass. If the existing `'clicking Event type filter shows only event-type trips'` test fails because events are now hidden by default, update it: click "All Types" before clicking "Event" to reset the type filter first.

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/pages/TripsPage.tsx frontend/src/__tests__/TripsPage.test.tsx && git commit -m "feat: merge filter rows, teal type pills, default to vacation/remote_week/sabbatical"
```

---

### Task 3: TripCard — equal height within grid rows

**Files:**
- Modify: `frontend/src/components/trips/TripCard.tsx`
- Test: `frontend/src/__tests__/TripCard.test.tsx`

The grid uses CSS Grid with `align-items: stretch` (default). Making the inner card `div` `h-full flex flex-col` and the bottom row `mt-auto` ensures the status/member row always anchors to the bottom, creating visually uniform cards.

---

**Step 1: Write the failing test**

Open `frontend/src/__tests__/TripCard.test.tsx`. Read it first to understand the existing `mockTrip` fixture and `renderWithProviders` helper. Add inside the `describe` block:

```typescript
  it('card link and inner div have h-full class for equal grid height', () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('h-full')
    const innerDiv = link.querySelector('div')
    expect(innerDiv).toHaveClass('h-full')
    expect(innerDiv).toHaveClass('flex-col')
  })
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: FAIL — link does not have `h-full` class.

**Step 3: Update TripCard.tsx**

Open `frontend/src/components/trips/TripCard.tsx`.

**3a.** Add `h-full` to the `<Link>` wrapper:

```tsx
// Before (line 64):
<Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block group">
// After:
<Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block group h-full">
```

**3b.** Add `h-full flex flex-col` to the inner `<div>`:

```tsx
// Before (line 65):
<div className="bg-white rounded-2xl border border-cloud-200 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-cloud-300/20 hover:-translate-y-0.5 hover:border-indigo-200 animate-card-enter">
// After:
<div className="bg-white rounded-2xl border border-cloud-200 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-cloud-300/20 hover:-translate-y-0.5 hover:border-indigo-200 animate-card-enter h-full flex flex-col">
```

**3c.** Add `mt-auto` to the bottom row `<div>` (the one containing `TripStatusBadge` and member avatars):

```tsx
// Before (line 120):
<div className="flex items-center justify-between">
// After:
<div className="flex items-center justify-between mt-auto">
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: all TripCard tests pass.

**Step 5: Run all frontend checks**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/trips/TripCard.tsx frontend/src/__tests__/TripCard.test.tsx && git commit -m "feat: equal height trip cards in grid with h-full flex-col"
```

---

## Verification

After all tasks:

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

All checks should pass. Then manually verify in the browser (seed data at `/dev/seed`):
1. Dashboard → Needs Attention: if 4+ trips have action items, only 3 group cards appear; "Show more (N more)" button is visible; clicking reveals all
2. My Trips → filter row is a single merged row; status pills are indigo, type pills are teal; default shows vacation/remote_week/sabbatical (events hidden by default)
3. My Trips → trip cards within the same row are the same height; bottom row (status badge + avatars) always aligns at card bottom
