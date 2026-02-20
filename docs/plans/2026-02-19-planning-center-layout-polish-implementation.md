# Planning Center Layout & Interaction Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix trip bar overflow in month/quarter views, add holiday click sidebar, right-align summary stats, and make "+N more" clickable.

**Architecture:** All frontend-only changes. Month/quarter views get dynamic row padding based on trip count. DayCell gets an `onHolidayClick` prop for holiday routing. TripSummaryBar switches to a flex-row layout with expandable overflow.

**Tech Stack:** React, TypeScript, Tailwind CSS, TanStack Query

---

### Task 1: Month View — Dynamic Row Height and Trip Bar Capping

**Files:**
- Modify: `frontend/src/components/planning/MonthView.tsx`

**Step 1: Update MonthView to cap visible trip bars at 3 and add dynamic row padding**

In `frontend/src/components/planning/MonthView.tsx`, the trip bar rendering currently iterates over all `tripsInMonth` with no limit. TripSpan uses `top: 2.5 + stackIndex * 1.5rem` which overflows the `min-h-[5rem]` cells.

Changes to the weeks rendering section (around line 122-169):

1. Filter `tripsInMonth` per week (currently it checks each trip against the week range but renders all matches). Add a `weekTrips` array and cap at 3.

2. Change the week row container from `<div key={weekIdx} className="relative">` to use dynamic padding:
```tsx
<div key={weekIdx} className="relative" style={{ paddingBottom: `${Math.min(weekTrips.length, 3) * 1.5}rem` }}>
```

3. Replace the trip rendering loop to use `weekTrips.slice(0, 3)` instead of iterating all `tripsInMonth`:
```tsx
{weekTrips.slice(0, 3).map((trip, tripIdx) => {
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
{weekTrips.length > 3 && (
  <span className="absolute right-1 text-[10px] text-cloud-500" style={{ bottom: '2px' }}>
    +{weekTrips.length - 3} more
  </span>
)}
```

The `weekTrips` calculation — add this before the return inside `weeks.map`:
```tsx
const weekStart = week[0].date
const weekEnd = week[6].date
const weekTrips = tripsInMonth.filter(
  (t) => t.start_date <= weekEnd && t.end_date >= weekStart
)
```

**Step 2: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/components/planning/MonthView.tsx
git commit -m "fix: cap month view trip bars at 3 per row with dynamic height"
```

---

### Task 2: Quarter View — Dynamic Row Padding

**Files:**
- Modify: `frontend/src/components/planning/QuarterView.tsx`

**Step 1: Make quarter view row padding dynamic based on trip count**

In `frontend/src/components/planning/QuarterView.tsx`, the week row container at line 106 has a fixed `className="relative pb-6"`.

Change to dynamic padding based on actual trip count per week:
```tsx
<div key={_weekIdx} className="relative" style={{ paddingBottom: `${weekTrips.length === 0 ? 4 : 12 + Math.min(weekTrips.length, 3) * 5}px` }}>
```

This gives: 0 trips = 4px, 1 trip = 17px, 2 trips = 22px, 3 trips = 27px. Bars use `bottom: 2 + stackIndex * 5px` so this keeps them contained.

**Step 2: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/components/planning/QuarterView.tsx
git commit -m "fix: dynamic quarter view row padding based on trip count"
```

---

### Task 3: DayCell — Holiday Click Routing

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`

**Step 1: Add onHolidayClick prop to DayCell**

Add to `DayCellProps`:
```typescript
onHolidayClick?: (date: string) => void
```

Add to destructured props: `onHolidayClick`.

In the compact branch, change the click handler:
```tsx
onClick={() => {
  if (holidayLabel && onHolidayClick) {
    onHolidayClick(date)
  } else {
    onClick?.(date)
  }
}}
```

In the full (month) mode, add an `onClick` handler to the outer div. Currently the full mode only has `onMouseDown` and `onMouseEnter` (for drag selection). Add a click handler that fires on holiday days:
```tsx
onClick={() => {
  if (holidayLabel && onHolidayClick) {
    onHolidayClick(date)
  }
}}
```

**Step 2: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass (new prop is optional)

**Step 3: Commit**

```bash
git add frontend/src/components/planning/DayCell.tsx
git commit -m "feat: add onHolidayClick prop to DayCell"
```

---

### Task 4: Wire Holiday Click Through Views and PlanningCenterPage

**Files:**
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`
- Modify: `frontend/src/components/planning/MonthView.tsx`
- Modify: `frontend/src/components/planning/QuarterView.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx`

**Step 1: Add handleHolidayClick to PlanningCenterPage**

In `frontend/src/pages/PlanningCenterPage.tsx`, add after `handleDayClick` (around line 84):
```typescript
const handleHolidayClick = useCallback((date: string) => {
  const holiday = allHolidays.find((h) => h.date === date)
  if (holiday) {
    setSidebarContent({ type: 'holiday', name: holiday.name, date: holiday.date, countryCode: holiday.country_code })
  }
}, [allHolidays])
```

Note: `allHolidays` is computed after the loading/error guards (line 169), but `handleHolidayClick` references it. Since `useCallback` captures the closure, this callback needs to be defined after `allHolidays`. Move the callback definition after line 172 OR make it a regular function (not useCallback) since it depends on `allHolidays` which changes on data refetch. Best approach: make it a plain function after `allHolidays`:

```typescript
const handleHolidayClick = (date: string) => {
  const holiday = allHolidays.find((h) => h.date === date)
  if (holiday) {
    setSidebarContent({ type: 'holiday', name: holiday.name, date: holiday.date, countryCode: holiday.country_code })
  }
}
```

Place this after `const selectedDate = ...` (line 172).

**Step 2: Pass onHolidayClick to all three views**

Add `onHolidayClick={handleHolidayClick}` to MonthView, QuarterView, and YearView renders.

**Step 3: Accept and pass through in MonthView**

Add `onHolidayClick?: (date: string) => void` to `MonthViewProps`. Pass to DayCell:
```tsx
onHolidayClick={onHolidayClick}
```

**Step 4: Accept and pass through in QuarterView**

Add `onHolidayClick?: (date: string) => void` to `QuarterViewProps`. Pass to DayCell:
```tsx
onHolidayClick={onHolidayClick}
```

**Step 5: Accept and pass through in YearView**

Add `onHolidayClick?: (date: string) => void` to `YearViewProps`. Pass to DayCell:
```tsx
onHolidayClick={onHolidayClick}
```

**Step 6: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 7: Commit**

```bash
git add frontend/src/pages/PlanningCenterPage.tsx frontend/src/components/planning/MonthView.tsx frontend/src/components/planning/QuarterView.tsx frontend/src/components/planning/YearView.tsx
git commit -m "feat: clicking a holiday day opens holiday detail sidebar"
```

---

### Task 5: TripSummaryBar — Right-Aligned Stats and Clickable Overflow

**Files:**
- Modify: `frontend/src/components/planning/TripSummaryBar.tsx`
- Modify: `frontend/src/__tests__/TripSummaryBar.test.tsx`

**Step 1: Update TripSummaryBar layout**

In `frontend/src/components/planning/TripSummaryBar.tsx`:

1. Add `useState` import:
```typescript
import { useMemo, useState, useEffect } from 'react'
```

2. Add expanded state inside the component, reset when period changes:
```typescript
const [expanded, setExpanded] = useState(false)

useEffect(() => {
  setExpanded(false)
}, [periodStart, periodEnd])
```

3. Change `visible` to respect expanded state:
```typescript
const visible = expanded ? filteredTrips : filteredTrips.slice(0, 8)
const overflow = expanded ? 0 : filteredTrips.length - Math.min(filteredTrips.length, 8)
```

4. Replace the entire return JSX. Change from `space-y-1` stacked layout to a single flex row with `justify-between`:

```tsx
return (
  <div className="flex items-start justify-between gap-4 px-4 py-2 bg-cloud-50 rounded-xl border border-cloud-200">
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      {visible.map((trip) => (
        <button
          key={trip.id}
          type="button"
          onClick={() => onTripClick(trip)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${CHIP_COLORS[trip.status] || CHIP_COLORS.planning}`}
        >
          {trip.destination}
          <span className="opacity-70">
            {formatShortDate(trip.start_date)}&ndash;{formatShortDate(trip.end_date)}
          </span>
        </button>
      ))}
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer transition-colors"
        >
          +{overflow} more
        </button>
      )}
      {expanded && filteredTrips.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer transition-colors"
        >
          Show less
        </button>
      )}
    </div>
    <p className="text-xs text-cloud-500 whitespace-nowrap shrink-0 pt-1">{statParts.join(' | ')}</p>
  </div>
)
```

**Step 2: Update TripSummaryBar tests**

In `frontend/src/__tests__/TripSummaryBar.test.tsx`, add a test for clickable overflow:

```typescript
it('expands to show all trips when +N more is clicked', () => {
  const trips = Array.from({ length: 10 }, (_, i) => ({
    ...baseMockTrip,
    id: String(i + 1),
    destination: `City ${i + 1}`,
    start_date: `2026-${String(Math.floor(i / 3) + 1).padStart(2, '0')}-01`,
    end_date: `2026-${String(Math.floor(i / 3) + 1).padStart(2, '0')}-10`,
  }))
  render(<TripSummaryBar {...defaultProps} trips={trips} />)
  expect(screen.getByText('+2 more')).toBeInTheDocument()
  expect(screen.queryByText(/City 9/)).not.toBeInTheDocument()

  fireEvent.click(screen.getByText('+2 more'))

  expect(screen.getByText(/City 9/)).toBeInTheDocument()
  expect(screen.getByText(/City 10/)).toBeInTheDocument()
  expect(screen.getByText('Show less')).toBeInTheDocument()
})
```

**Step 3: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/planning/TripSummaryBar.tsx frontend/src/__tests__/TripSummaryBar.test.tsx
git commit -m "feat: right-align summary stats and make overflow clickable"
```

---

### Task 6: Update PlanningCenterPage Tests

**Files:**
- Modify: `frontend/src/__tests__/PlanningCenterPage.test.tsx`

**Step 1: Add test for holiday click opening sidebar**

Add to the describe block:

```typescript
it('clicking a holiday day opens holiday detail sidebar', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('holidays')) {
      return Promise.resolve({
        data: {
          holidays: [{ date: `${testYear}-${testMonth}-15`, name: 'Test Holiday', country_code: 'US' }],
          custom_days: [],
          enabled_countries: ['US'],
        },
      })
    }
    if (url.includes('supported-countries')) {
      return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
    }
    return Promise.resolve({ data: [] })
  })

  renderWithRouter()
  await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Quarter'))

  await waitFor(() => {
    expect(screen.getAllByText('15')[0]).toBeInTheDocument()
  })
  await userEvent.click(screen.getAllByText('15')[0])

  await waitFor(() => {
    expect(screen.getByText('Test Holiday')).toBeInTheDocument()
    expect(screen.getByText(/Federal Holiday/)).toBeInTheDocument()
  })
})
```

**Step 2: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/__tests__/PlanningCenterPage.test.tsx
git commit -m "test: add test for holiday click opening sidebar"
```

---

### Task 7: Final Verification

**Step 1: Run full lint/type/test suite**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

**Step 2: Visual verification**

- Open http://localhost:5173/calendar
- Seed data at `/dev/seed` if needed
- **Month view**: trip bars capped at 3 per row, rows grow dynamically, no overflow
- **Quarter view**: row padding adjusts to trip count, bars stay contained
- **Holiday click**: click a holiday day in any view, sidebar shows holiday name and country
- **Summary bar**: stats right-aligned, "+N more" clickable and expands to show all trips
- Navigate between months/quarters — verify expanded state resets

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address verification issues"
```
