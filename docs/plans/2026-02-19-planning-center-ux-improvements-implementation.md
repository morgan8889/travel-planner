# Planning Center UX Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Planning Center usability with trip summary bar, better tooltips, 3-trip overlap support, real holiday labels, default US holidays, and end date picker on trip create.

**Architecture:** All changes are frontend-only. New `TripSummaryBar` component, modifications to existing compact view components and sidebar trip create form. No backend changes.

**Tech Stack:** React, TypeScript, Tailwind CSS, TanStack Query

---

### Task 1: Create TripSummaryBar Component

**Files:**
- Create: `frontend/src/components/planning/TripSummaryBar.tsx`
- Test: `frontend/src/__tests__/TripSummaryBar.test.tsx`

**Step 1: Write the test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TripSummaryBar } from '../components/planning/TripSummaryBar'
import type { TripSummary } from '../lib/types'

const mockTrips: TripSummary[] = [
  {
    id: '1', destination: 'Paris', status: 'planning',
    start_date: '2026-03-05', end_date: '2026-03-12',
    type: 'vacation', member_count: 1,
    destination_latitude: null, destination_longitude: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2', destination: 'Tokyo', status: 'booked',
    start_date: '2026-06-01', end_date: '2026-06-15',
    type: 'vacation', member_count: 2,
    destination_latitude: null, destination_longitude: null,
    created_at: '2026-01-01T00:00:00Z',
  },
]

describe('TripSummaryBar', () => {
  it('renders trip chips with destination and dates', () => {
    render(<TripSummaryBar trips={mockTrips} onTripClick={vi.fn()} />)
    expect(screen.getByText(/Paris/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument()
  })

  it('calls onTripClick when a chip is clicked', () => {
    const onClick = vi.fn()
    render(<TripSummaryBar trips={mockTrips} onTripClick={onClick} />)
    fireEvent.click(screen.getByText(/Paris/))
    expect(onClick).toHaveBeenCalledWith(mockTrips[0])
  })

  it('renders nothing when no trips', () => {
    const { container } = render(<TripSummaryBar trips={[]} onTripClick={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/TripSummaryBar.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement TripSummaryBar**

```typescript
// frontend/src/components/planning/TripSummaryBar.tsx
import type { TripSummary, TripStatus } from '../../lib/types'

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
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TripSummaryBar({ trips, onTripClick }: TripSummaryBarProps) {
  if (trips.length === 0) return null

  const sorted = [...trips].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const visible = sorted.slice(0, 8)
  const overflow = sorted.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-cloud-50 rounded-xl border border-cloud-200">
      {visible.map((trip) => (
        <button
          key={trip.id}
          type="button"
          onClick={() => onTripClick(trip)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${CHIP_COLORS[trip.status] || CHIP_COLORS.planning}`}
        >
          {trip.destination}
          <span className="opacity-70">
            ({formatShortDate(trip.start_date)}&ndash;{formatShortDate(trip.end_date)})
          </span>
        </button>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-cloud-500">+{overflow} more</span>
      )}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/TripSummaryBar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/planning/TripSummaryBar.tsx frontend/src/__tests__/TripSummaryBar.test.tsx
git commit -m "feat: add TripSummaryBar component with status-colored trip chips"
```

---

### Task 2: Integrate TripSummaryBar into PlanningCenterPage

**Files:**
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`

**Step 1: Add import and render TripSummaryBar**

Add import:
```typescript
import { TripSummaryBar } from '../components/planning/TripSummaryBar'
```

Render between the `PlanningHeader` and the empty-trips hint (before the calendar grid):
```tsx
<TripSummaryBar trips={allTrips} onTripClick={handleTripClick} />
```

**Step 2: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/pages/PlanningCenterPage.tsx
git commit -m "feat: render TripSummaryBar in PlanningCenterPage"
```

---

### Task 3: Add Custom Hover Tooltip to TripSpan

**Files:**
- Modify: `frontend/src/components/planning/TripSpan.tsx`

**Step 1: Add tooltip props and hover state**

Add to `TripSpanProps`:
```typescript
/** Full date range for tooltip display */
startDate?: string
endDate?: string
```

Add hover state inside the component:
```typescript
const [hovered, setHovered] = useState(false)
```

**Step 2: Render custom tooltip in compact mode**

Replace `title={destination}` with `onMouseEnter`/`onMouseLeave` handlers and a tooltip div:

```tsx
<button
  type="button"
  className={`absolute left-0 h-1.5 rounded-full cursor-pointer transition-colors ${colorClasses}`}
  style={{
    width: `${(colSpan / 7) * 100}%`,
    marginLeft: `${(startCol / 7) * 100}%`,
    bottom: `${2 + stackIndex * 4}px`,
  }}
  onClick={(e) => { e.stopPropagation(); onClick() }}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
>
  {showLabel && (
    <span className="absolute top-full left-0 text-[8px] leading-none truncate max-w-full pointer-events-none mt-px">
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
```

**Step 3: Pass startDate/endDate from QuarterView and YearView**

In both `QuarterView.tsx` and `YearView.tsx`, add props to the `TripSpan` render:
```tsx
<TripSpan
  ...existing props...
  startDate={trip.start_date}
  endDate={trip.end_date}
/>
```

**Step 4: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add frontend/src/components/planning/TripSpan.tsx frontend/src/components/planning/QuarterView.tsx frontend/src/components/planning/YearView.tsx
git commit -m "feat: add custom hover tooltip to TripSpan compact bars"
```

---

### Task 4: Increase Quarter View to 3 Overlapping Trips

**Files:**
- Modify: `frontend/src/components/planning/QuarterView.tsx`

**Step 1: Change trip limit and padding**

Change `weekTrips.slice(0, 2)` to `weekTrips.slice(0, 3)`.

Change `pb-3` on the week row container to `pb-5`.

Change the overflow indicator threshold from `weekTrips.length > 2` to `weekTrips.length > 3`, and `weekTrips.length - 2` to `weekTrips.length - 3`.

**Step 2: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/components/planning/QuarterView.tsx
git commit -m "feat: support 3 overlapping trip bars in quarter view"
```

---

### Task 5: Holiday Labels in Compact Views

**Files:**
- Modify: `frontend/src/components/planning/QuarterView.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx`

**Step 1: Change holidaySet from Set to Map in QuarterView**

Replace:
```typescript
const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])
```

With:
```typescript
const holidayMap = useMemo(() => {
  const map = new Map<string, string>()
  for (const h of holidays) {
    map.set(h.date, h.name)
  }
  return map
}, [holidays])
```

Update the DayCell prop:
```tsx
holidayLabel={holidayMap.get(day.date)}
```

**Step 2: Same change in YearView**

Same replacement of `holidaySet` with `holidayMap` and update DayCell prop.

**Step 3: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/planning/QuarterView.tsx frontend/src/components/planning/YearView.tsx
git commit -m "feat: show real holiday names in compact view tooltips"
```

---

### Task 6: Default US Holidays

**Files:**
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`

**Step 1: Add auto-enable effect**

Add a `useRef` to track if auto-enable has been attempted, and a `useEffect`:

```typescript
const autoEnabledRef = useRef(false)
const enableCountry = useEnableCountry(currentYear)

useEffect(() => {
  if (
    !autoEnabledRef.current &&
    !holidaysLoading &&
    holidayData &&
    holidayData.enabled_countries.length === 0
  ) {
    autoEnabledRef.current = true
    enableCountry.mutate('US')
  }
}, [holidaysLoading, holidayData, enableCountry])
```

Import `useRef` and `useEnableCountry`:
```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import { useEnableCountry } from '../hooks/useHolidays'
```

**Step 2: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/pages/PlanningCenterPage.tsx
git commit -m "feat: auto-enable US holidays on first Planning Center load"
```

---

### Task 7: Trip Create End Date Picker

**Files:**
- Modify: `frontend/src/components/planning/SidebarTripCreate.tsx`
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`

**Step 1: Update SidebarTripCreate to accept initial dates and allow editing**

Replace fixed `startDate`/`endDate` props with editable state:

```typescript
interface SidebarTripCreateProps {
  initialStartDate: string
  initialEndDate: string
  onCreated: () => void
}

export function SidebarTripCreate({ initialStartDate, initialEndDate, onCreated }: SidebarTripCreateProps) {
  const [destination, setDestination] = useState('')
  const [tripType, setTripType] = useState<TripType>('vacation')
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const createTrip = useCreateTrip()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return

    await createTrip.mutateAsync({
      destination: destination.trim(),
      type: tripType,
      start_date: startDate,
      end_date: endDate,
      status: 'planning',
      destination_latitude: null,
      destination_longitude: null,
    })
    onCreated()
  }
```

Add date inputs to the form between the destination and trip type fields:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label htmlFor="start-date" className="block text-sm font-medium text-cloud-700 mb-1">
      Start
    </label>
    <input
      id="start-date"
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      required
      className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
    />
  </div>
  <div>
    <label htmlFor="end-date" className="block text-sm font-medium text-cloud-700 mb-1">
      End
    </label>
    <input
      id="end-date"
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      min={startDate}
      required
      className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
    />
  </div>
</div>
```

Remove the static date display paragraph.

**Step 2: Update PlanningCenterPage to compute +7 day default**

In `handleDayClick`, compute end date as start + 7 days:

```typescript
const handleDayClick = useCallback((date: string) => {
  const start = new Date(date + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const endStr = end.toISOString().split('T')[0]
  setSidebarContent({ type: 'trip-create', startDate: date, endDate: endStr })
}, [])
```

Update `SidebarTripCreate` render to use new prop names:
```tsx
<SidebarTripCreate
  initialStartDate={sidebarContent.startDate}
  initialEndDate={sidebarContent.endDate}
  onCreated={closeSidebar}
/>
```

**Step 3: Run type check and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/planning/SidebarTripCreate.tsx frontend/src/pages/PlanningCenterPage.tsx
git commit -m "feat: add editable end date to trip create with 1-week default"
```

---

### Task 8: Update Tests

**Files:**
- Modify: `frontend/src/__tests__/PlanningCenterPage.test.tsx`

**Step 1: Add test for TripSummaryBar rendering**

Add a test that verifies trip chips appear when trips exist.

**Step 2: Add test for holiday label rendering**

Verify holiday names appear as tooltips in compact views.

**Step 3: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/__tests__/PlanningCenterPage.test.tsx
git commit -m "test: add tests for trip summary bar and holiday labels"
```

---

### Task 9: Final Verification

**Step 1: Run full lint/type/test suite**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

**Step 2: Visual verification**

- Open Planning Center in browser
- Check year view: trip chips at top, hover tooltip on bars
- Check quarter view: 3 overlapping trips visible, holiday names
- Click empty day: verify end date defaults to +7 days, editable
- Verify US holidays auto-enabled on fresh load

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address verification issues"
```
