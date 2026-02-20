# Planning Center Tweaks — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Planning Center with period-filtered summary, taller quarter bars, holiday labels, selected day indicator, and year view type colors.

**Architecture:** All frontend-only changes. Refactor `TripSpan` to use a `size` prop instead of boolean `compact`/`showLabel`. Extend `TripSummaryBar` with filtering and stats. Add `selectedDate` flow from page to cells.

**Tech Stack:** React, TypeScript, Tailwind CSS, TanStack Query

---

### Task 1: Refactor TripSpan — Replace compact/showLabel with size Prop

**Files:**
- Modify: `frontend/src/components/planning/TripSpan.tsx`
- Modify: `frontend/src/components/planning/QuarterView.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/pages/PlanningCenterPage.tsx` (MonthView TripSpan calls don't use compact, so no change there)

**Step 1: Update TripSpan props and rendering**

Replace the `compact` and `showLabel` boolean props with a `size` prop:

```typescript
// frontend/src/components/planning/TripSpan.tsx
import { useState } from 'react'
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
  startCol: number
  colSpan: number
  stackIndex: number
  onClick: () => void
  /** Bar size: "small" (year), "medium" (quarter), "full" (month) */
  size?: 'small' | 'medium' | 'full'
  startDate?: string
  endDate?: string
}

export function TripSpan({
  destination,
  status,
  startCol,
  colSpan,
  stackIndex,
  onClick,
  size = 'full',
  startDate,
  endDate,
}: TripSpanProps) {
  const [hovered, setHovered] = useState(false)
  const colorClasses = TRIP_COLORS[status] || TRIP_COLORS.planning

  if (size === 'small' || size === 'medium') {
    const height = size === 'small' ? 'h-1.5' : 'h-3'
    const bottomOffset = size === 'small' ? 4 : 5
    return (
      <button
        type="button"
        className={`absolute left-0 ${height} rounded-full cursor-pointer transition-colors ${colorClasses}`}
        style={{
          width: `${(colSpan / 7) * 100}%`,
          marginLeft: `${(startCol / 7) * 100}%`,
          bottom: `${2 + stackIndex * bottomOffset}px`,
        }}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {size === 'medium' && (
          <span className="absolute inset-0 flex items-center px-1 text-[7px] font-medium leading-none truncate pointer-events-none">
            {destination}
          </span>
        )}
        {hovered && startDate && endDate && (
          <div className="absolute bottom-full left-0 mb-1 px-2 py-1.5 bg-cloud-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
            <div className="font-semibold">{destination}</div>
            <div className="opacity-80">{startDate} to {endDate}</div>
            <div className="opacity-60 capitalize">{status}</div>
          </div>
        )}
      </button>
    )
  }

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

**Step 2: Update QuarterView to use size="medium"**

In `frontend/src/components/planning/QuarterView.tsx`, replace the TripSpan render:

Change:
```tsx
compact
showLabel
```
To:
```tsx
size="medium"
```

Also change `pb-5` to `pb-6` on the week row container.

**Step 3: Update YearView to use size="small"**

In `frontend/src/components/planning/YearView.tsx`, replace:

Change:
```tsx
compact
showLabel={false}
```
To:
```tsx
size="small"
```

**Step 4: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add frontend/src/components/planning/TripSpan.tsx frontend/src/components/planning/QuarterView.tsx frontend/src/components/planning/YearView.tsx
git commit -m "refactor: replace TripSpan compact/showLabel with size prop"
```

---

### Task 2: Add colorBy and tripType Props to TripSpan

**Files:**
- Modify: `frontend/src/components/planning/TripSpan.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx`

**Step 1: Add TYPE_COLORS and new props**

In `frontend/src/components/planning/TripSpan.tsx`, add a new color map and props:

```typescript
import type { TripStatus, TripType } from '../../lib/types'

const TYPE_COLORS: Record<string, string> = {
  vacation: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  remote_week: 'bg-teal-200 text-teal-800 hover:bg-teal-300',
  sabbatical: 'bg-amber-200 text-amber-800 hover:bg-amber-300',
}
```

Add to `TripSpanProps`:
```typescript
  colorBy?: 'status' | 'type'
  tripType?: TripType
```

Update the color resolution line:
```typescript
  const colorClasses = colorBy === 'type' && tripType
    ? (TYPE_COLORS[tripType] || TRIP_COLORS.planning)
    : (TRIP_COLORS[status] || TRIP_COLORS.planning)
```

Also update the tooltip to show trip type when available:
```tsx
{hovered && startDate && endDate && (
  <div className="absolute bottom-full left-0 mb-1 px-2 py-1.5 bg-cloud-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
    <div className="font-semibold">{destination}</div>
    <div className="opacity-80">{startDate} to {endDate}</div>
    <div className="opacity-60 capitalize">{status}{tripType ? ` · ${tripType.replace('_', ' ')}` : ''}</div>
  </div>
)}
```

**Step 2: Pass colorBy="type" and tripType in YearView**

In `frontend/src/components/planning/YearView.tsx`, update the TripSpan render:

```tsx
<TripSpan
  key={trip.id}
  destination={trip.destination}
  status={trip.status}
  startCol={startCol}
  colSpan={colSpan}
  stackIndex={tripIdx}
  size="small"
  startDate={trip.start_date}
  endDate={trip.end_date}
  colorBy="type"
  tripType={trip.type}
  onClick={() => onTripClick(trip)}
/>
```

**Step 3: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/planning/TripSpan.tsx frontend/src/components/planning/YearView.tsx
git commit -m "feat: add trip type colors in year view"
```

---

### Task 3: Add Holiday Labels to Quarter View DayCell

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`
- Modify: `frontend/src/components/planning/QuarterView.tsx`

**Step 1: Add showLabel prop to DayCell**

In `frontend/src/components/planning/DayCell.tsx`, add to `DayCellProps`:
```typescript
  showLabel?: boolean  // show label text in compact mode (quarter view)
```

Update the compact render to conditionally show the label:

```tsx
if (compact) {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-xs rounded-sm cursor-pointer
        ${showLabel ? 'min-h-[2.5rem]' : 'aspect-square'}
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
      {showLabel && label && (
        <span className={`text-[6px] leading-tight truncate max-w-full ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
          {label}
        </span>
      )}
    </div>
  )
}
```

**Step 2: Pass showLabel in QuarterView**

In `frontend/src/components/planning/QuarterView.tsx`, add `showLabel` to the DayCell render:

```tsx
<DayCell
  key={day.date}
  date={day.date}
  dayNumber={day.dayNumber}
  isToday={day.date === today}
  isCurrentMonth
  isSelected={false}
  holidayLabel={holidayMap.get(day.date)}
  customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
  compact
  showLabel
  onClick={() => onDayClick(day.date)}
/>
```

YearView stays unchanged (no `showLabel` prop, defaults to `false`).

**Step 3: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/planning/DayCell.tsx frontend/src/components/planning/QuarterView.tsx
git commit -m "feat: show holiday labels in quarter view day cells"
```

---

### Task 4: Add Selected Day Visual Indicator

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`
- Modify: `frontend/src/components/planning/QuarterView.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/components/planning/MonthView.tsx`
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`

**Step 1: Add isSelectedForCreate prop to DayCell**

In `frontend/src/components/planning/DayCell.tsx`, add to `DayCellProps`:
```typescript
  isSelectedForCreate?: boolean
```

Add styling in both compact and full modes. In compact:
```tsx
${isSelectedForCreate ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
```

In full mode, add the same class to the outer div:
```tsx
${isSelectedForCreate ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50' : ''}
```

**Step 2: Derive selectedDate in PlanningCenterPage**

In `frontend/src/pages/PlanningCenterPage.tsx`, after `allCustomDays`:

```typescript
const selectedDate = sidebarContent?.type === 'trip-create' ? sidebarContent.startDate : null
```

**Step 3: Pass selectedDate to all views**

Update each view's props and render in PlanningCenterPage:

```tsx
<MonthView ... selectedDate={selectedDate} />
<QuarterView ... selectedDate={selectedDate} />
<YearView ... selectedDate={selectedDate} />
```

**Step 4: Accept and use selectedDate in each view**

In `QuarterView.tsx`, add `selectedDate?: string | null` to `QuarterViewProps`. Pass to DayCell:
```tsx
isSelectedForCreate={day.date === selectedDate}
```

In `YearView.tsx`, same pattern.

In `MonthView.tsx`, add `selectedDate?: string | null` to `MonthViewProps`. Pass to DayCell:
```tsx
isSelectedForCreate={day.date === selectedDate}
```

**Step 5: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 6: Commit**

```bash
git add frontend/src/components/planning/DayCell.tsx frontend/src/components/planning/QuarterView.tsx frontend/src/components/planning/YearView.tsx frontend/src/components/planning/MonthView.tsx frontend/src/pages/PlanningCenterPage.tsx
git commit -m "feat: highlight selected day when creating a trip"
```

---

### Task 5: Period-Filtered TripSummaryBar

**Files:**
- Modify: `frontend/src/components/planning/TripSummaryBar.tsx`
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`
- Modify: `frontend/src/__tests__/TripSummaryBar.test.tsx`

**Step 1: Update TripSummaryBar test**

Add a test for period filtering:

```typescript
it('filters trips to the visible period', () => {
  const trips: TripSummary[] = [
    { ...baseMockTrip, id: '1', destination: 'Paris', start_date: '2026-03-05', end_date: '2026-03-12' },
    { ...baseMockTrip, id: '2', destination: 'Tokyo', start_date: '2026-06-01', end_date: '2026-06-15' },
  ]
  render(
    <TripSummaryBar
      trips={trips}
      onTripClick={vi.fn()}
      zoomLevel="month"
      currentMonth={2}
      currentYear={2026}
      holidays={[]}
      customDays={[]}
    />
  )
  expect(screen.getByText(/Paris/)).toBeInTheDocument()
  expect(screen.queryByText(/Tokyo/)).not.toBeInTheDocument()
})

it('shows stats line with trip, holiday, and event counts', () => {
  const trips: TripSummary[] = [
    { ...baseMockTrip, id: '1', destination: 'Paris', start_date: '2026-03-05', end_date: '2026-03-12' },
  ]
  const holidays: HolidayEntry[] = [
    { date: '2026-03-17', name: "St. Patrick's Day", country_code: 'US' },
  ]
  render(
    <TripSummaryBar
      trips={trips}
      onTripClick={vi.fn()}
      zoomLevel="month"
      currentMonth={2}
      currentYear={2026}
      holidays={holidays}
      customDays={[]}
    />
  )
  expect(screen.getByText(/1 trip/)).toBeInTheDocument()
  expect(screen.getByText(/1 holiday/)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/TripSummaryBar.test.tsx`
Expected: FAIL (new props not accepted yet)

**Step 3: Implement filtered TripSummaryBar**

```typescript
// frontend/src/components/planning/TripSummaryBar.tsx
import { useMemo } from 'react'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

const CHIP_COLORS: Record<string, string> = {
  dreaming: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  planning: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  booked: 'bg-green-100 text-green-700 hover:bg-green-200',
  active: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  completed: 'bg-cloud-100 text-cloud-600 hover:bg-cloud-200',
}

interface TripSummaryBarProps {
  trips: TripSummary[]
  onTripClick: (trip: TripSummary) => void
  zoomLevel: 'month' | 'quarter' | 'year'
  currentMonth: number
  currentYear: number
  holidays: HolidayEntry[]
  customDays: CustomDay[]
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getPeriodRange(zoomLevel: string, month: number, year: number): [string, string] {
  if (zoomLevel === 'month') {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return [start, end]
  }
  if (zoomLevel === 'quarter') {
    const qStart = Math.floor(month / 3) * 3
    const start = `${year}-${String(qStart + 1).padStart(2, '0')}-01`
    const endMonth = qStart + 2
    const lastDay = new Date(year, endMonth + 1, 0).getDate()
    const end = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return [start, end]
  }
  return [`${year}-01-01`, `${year}-12-31`]
}

export function TripSummaryBar({
  trips,
  onTripClick,
  zoomLevel,
  currentMonth,
  currentYear,
  holidays,
  customDays,
}: TripSummaryBarProps) {
  const [periodStart, periodEnd] = useMemo(
    () => getPeriodRange(zoomLevel, currentMonth, currentYear),
    [zoomLevel, currentMonth, currentYear]
  )

  const filteredTrips = useMemo(
    () => trips
      .filter((t) => t.start_date <= periodEnd && t.end_date >= periodStart)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [trips, periodStart, periodEnd]
  )

  const holidayCount = useMemo(
    () => holidays.filter((h) => h.date >= periodStart && h.date <= periodEnd).length,
    [holidays, periodStart, periodEnd]
  )

  const eventCount = useMemo(() => {
    return customDays.filter((cd) => {
      const dateStr = cd.recurring ? `${currentYear}-${cd.date.slice(5)}` : cd.date
      return dateStr >= periodStart && dateStr <= periodEnd
    }).length
  }, [customDays, periodStart, periodEnd, currentYear])

  if (filteredTrips.length === 0 && holidayCount === 0 && eventCount === 0) return null

  const visible = filteredTrips.slice(0, 8)
  const overflow = filteredTrips.length - visible.length

  const statParts: string[] = []
  if (filteredTrips.length > 0) statParts.push(`${filteredTrips.length} trip${filteredTrips.length !== 1 ? 's' : ''}`)
  if (holidayCount > 0) statParts.push(`${holidayCount} holiday${holidayCount !== 1 ? 's' : ''}`)
  if (eventCount > 0) statParts.push(`${eventCount} event${eventCount !== 1 ? 's' : ''}`)

  return (
    <div className="px-4 py-2 bg-cloud-50 rounded-xl border border-cloud-200 space-y-1">
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
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
            <span className="text-xs text-cloud-500">+{overflow} more</span>
          )}
        </div>
      )}
      <p className="text-xs text-cloud-500">{statParts.join(' | ')}</p>
    </div>
  )
}
```

**Step 4: Update PlanningCenterPage to pass new props**

In `frontend/src/pages/PlanningCenterPage.tsx`, update the TripSummaryBar render:

```tsx
<TripSummaryBar
  trips={allTrips}
  onTripClick={handleTripClick}
  zoomLevel={zoomLevel}
  currentMonth={currentMonth}
  currentYear={currentYear}
  holidays={allHolidays}
  customDays={allCustomDays}
/>
```

**Step 5: Update existing TripSummaryBar tests**

Update the existing tests to pass the required new props. Add a `defaultProps` helper:

```typescript
const defaultSummaryProps = {
  zoomLevel: 'year' as const,
  currentMonth: 0,
  currentYear: 2026,
  holidays: [],
  customDays: [],
}
```

Spread into all existing `render(<TripSummaryBar ... />)` calls.

**Step 6: Run tests**

Run: `cd frontend && npx vitest run src/__tests__/TripSummaryBar.test.tsx`
Expected: All pass

**Step 7: Commit**

```bash
git add frontend/src/components/planning/TripSummaryBar.tsx frontend/src/pages/PlanningCenterPage.tsx frontend/src/__tests__/TripSummaryBar.test.tsx
git commit -m "feat: filter summary bar by visible time period with stats"
```

---

### Task 6: Update PlanningCenterPage Tests

**Files:**
- Modify: `frontend/src/__tests__/PlanningCenterPage.test.tsx`

**Step 1: Update trip bar test**

The "shows trip bars in quarter view" test used `getAllByTitle('Paris')` (already fixed to `getAllByText`). Verify it still works with the `size="medium"` bars that now render destination text inside the bar.

**Step 2: Add test for selected day indicator**

```typescript
it('highlights selected day when trip create sidebar is open', async () => {
  renderWithRouter()
  await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Quarter'))

  await waitFor(() => {
    expect(screen.getAllByText('15')[0]).toBeInTheDocument()
  })
  await userEvent.click(screen.getAllByText('15')[0])

  await waitFor(() => {
    expect(screen.getByText('New Trip')).toBeInTheDocument()
  })
  // The clicked day should have the ring indicator class
  const dayCell = screen.getAllByText('15')[0].closest('div')
  expect(dayCell?.className).toContain('ring-indigo-500')
})
```

**Step 3: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/__tests__/PlanningCenterPage.test.tsx
git commit -m "test: add tests for selected day indicator"
```

---

### Task 7: Final Verification

**Step 1: Run full lint/type/test suite**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

**Step 2: Visual verification**

- Open Planning Center in browser at http://localhost:5173/calendar
- Seed data first at `/dev/seed` if needed
- Check **month view**: summary bar shows only that month's trips + stats
- Switch to **quarter view**: taller bars with text inside, holiday labels on days, summary filtered to quarter
- Switch to **year view**: bars colored by type (blue=vacation, teal=remote, amber=sabbatical)
- Click a day in any view: indigo ring appears on that day, sidebar opens
- Close sidebar: ring disappears

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address verification issues"
```
