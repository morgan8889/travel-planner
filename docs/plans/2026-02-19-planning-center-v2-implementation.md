# Planning Center V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add trip bars to compact views, fix click behavior, add map to trip detail sidebar, and replace holiday toggles with multi-select dropdown.

**Architecture:** Modify existing QuarterView/YearView to render TripSpan bars over week rows using the same CSS Grid overlay pattern as MonthView. Add a static MapView to SidebarTripDetail. Create a CountrySelect dropdown component to replace inline toggle buttons in PlanningHeader.

**Tech Stack:** React, TypeScript, Tailwind CSS, react-map-gl, Mapbox GL, TanStack Query

---

### Task 1: Add `compact` variant to TripSpan

**Files:**
- Modify: `frontend/src/components/planning/TripSpan.tsx`
- Test: `frontend/src/__tests__/PlanningCenterPage.test.tsx`

**Step 1: Add compact props to TripSpan**

Add `compact?: boolean` and `showLabel?: boolean` props. When `compact` is true, reduce bar height from `h-5` (20px) to `h-1.5` (6px) and adjust stacking offset. When `showLabel` is false, hide the text and only show a tooltip.

```tsx
// TripSpan.tsx — updated interface
interface TripSpanProps {
  destination: string
  status: TripStatus
  startCol: number
  colSpan: number
  stackIndex: number
  onClick: () => void
  compact?: boolean
  showLabel?: boolean
}
```

Implementation for the compact variant:

```tsx
export function TripSpan({
  destination,
  status,
  startCol,
  colSpan,
  stackIndex,
  onClick,
  compact = false,
  showLabel = true,
}: TripSpanProps) {
  const colorClasses = TRIP_COLORS[status] || TRIP_COLORS.planning

  if (compact) {
    return (
      <button
        type="button"
        className={`absolute left-0 h-1.5 rounded-full cursor-pointer transition-colors ${colorClasses}`}
        style={{
          width: `${(colSpan / 7) * 100}%`,
          marginLeft: `${(startCol / 7) * 100}%`,
          bottom: `${2 + stackIndex * 4}px`,
        }}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        title={destination}
      >
        {showLabel && (
          <span className="absolute top-full left-0 text-[8px] leading-none truncate max-w-full pointer-events-none mt-px">
            {destination}
          </span>
        )}
      </button>
    )
  }

  // existing full-size implementation unchanged
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

**Step 2: Verify MonthView still works unchanged**

Run: `cd frontend && npx vitest run`
Expected: All existing tests pass (MonthView doesn't pass `compact` so behavior unchanged)

**Step 3: Commit**

```bash
git add frontend/src/components/planning/TripSpan.tsx
git commit -m "feat: add compact variant to TripSpan for quarter/year views"
```

---

### Task 2: Add trip bars and click handlers to QuarterView

**Files:**
- Modify: `frontend/src/components/planning/QuarterView.tsx`

**Step 1: Update QuarterView props**

Replace `onMonthClick` with three specific callbacks:

```tsx
interface QuarterViewProps {
  year: number
  quarter: number
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  onMonthClick: (month: number) => void      // month header click (drill-down)
  onDayClick: (date: string) => void          // empty day click (quick-add)
  onTripClick: (trip: TripSummary) => void    // trip bar click (detail sidebar)
}
```

**Step 2: Add trip bar rendering logic**

Import `TripSpan` and add the trip filtering + week-row rendering logic from MonthView, adapted for the mini-grid structure. Each mini-month wraps its day grid in a relative container. After the `DayCell` grid, render trip bars using the compact `TripSpan`.

Key changes to the render:
- Replace `<div className="grid grid-cols-7 gap-px">` with a structure that wraps each week row in a `relative` container
- Chunk `days` into week rows (7 days each)
- Filter `trips` to those overlapping each month
- For each week row, render compact `TripSpan` bars (max 2 visible, "+N" overflow)
- `showLabel={true}` for quarter view (cells are big enough for tiny text)
- DayCell `onClick` calls `onDayClick(date)` instead of `onMonthClick(month)`
- Month header button still calls `onMonthClick(month)` for intentional drill-down

**Step 3: Implement the week-chunking and trip bar rendering**

```tsx
// Inside each month's render, replace the flat grid with week rows:
const weeks: typeof days[] = []
for (let i = 0; i < days.length; i += 7) {
  weeks.push(days.slice(i, i + 7))
}

// Filter trips for this month
const monthStart = formatDate(year, month, 1)
const monthEnd = formatDate(year, month, new Date(year, month + 1, 0).getDate())
const monthTrips = trips.filter(t => t.start_date <= monthEnd && t.end_date >= monthStart)

// Render weeks with trip bars
{weeks.map((week, weekIdx) => (
  <div key={weekIdx} className="relative">
    <div className="grid grid-cols-7 gap-px">
      {week.map((day, i) => {
        if (!day.isCurrentMonth) return <div key={i} className="aspect-square" />
        return (
          <DayCell
            key={day.date}
            date={day.date}
            dayNumber={day.dayNumber}
            isToday={day.date === today}
            isCurrentMonth
            isSelected={false}
            holidayLabel={holidaySet.has(day.date) ? 'holiday' : undefined}
            customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
            compact
            onClick={() => onDayClick(day.date)}
          />
        )
      })}
    </div>
    {/* Compact trip bars — max 2 visible */}
    {monthTrips.slice(0, 2).map((trip, tripIdx) => {
      const weekStart = week[0].date || formatDate(year, month, 1)
      const weekEnd = week[week.length - 1].date || monthEnd
      if (trip.start_date > weekEnd || trip.end_date < weekStart) return null

      const startCol = Math.max(0, week.findIndex(d => d.isCurrentMonth && d.date >= trip.start_date))
      const endCol = (() => {
        const idx = week.findIndex(d => d.isCurrentMonth && d.date > trip.end_date)
        return idx === -1 ? week.filter(d => d.isCurrentMonth).length : idx
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
          compact
          showLabel
          onClick={() => onTripClick(trip)}
        />
      )
    })}
    {monthTrips.length > 2 && weekIdx === 0 && (
      <span className="absolute right-0 bottom-0 text-[8px] text-cloud-500">
        +{monthTrips.length - 2}
      </span>
    )}
  </div>
))}
```

Remove `isSelected={tripDates.has(day.date)}` — trips are now shown as bars, not background colors. Remove the `tripDates` useMemo entirely.

**Step 4: Verify tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (QuarterView tests may need prop updates)

**Step 5: Commit**

```bash
git add frontend/src/components/planning/QuarterView.tsx
git commit -m "feat: add compact trip bars and click handlers to QuarterView"
```

---

### Task 3: Add trip bars and click handlers to YearView

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`

**Step 1: Apply same pattern as QuarterView**

Update `YearViewProps` to add `onDayClick` and `onTripClick` callbacks (same as QuarterView). Apply the same week-chunking and trip bar rendering pattern. Key differences from QuarterView:

- `showLabel={false}` — year view cells are too small for text labels
- `compact={true}` — same thin bars
- Keep `customDays` prop (currently unused in YearView, but should be passed through)
- Remove `tripDates` useMemo and `isSelected` background coloring

**Step 2: Verify tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/planning/YearView.tsx
git commit -m "feat: add compact trip bars and click handlers to YearView"
```

---

### Task 4: Update PlanningCenterPage click handlers

**Files:**
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`

**Step 1: Add `handleDayClick` callback**

```tsx
const handleDayClick = useCallback((date: string) => {
  setSidebarContent({ type: 'trip-create', startDate: date, endDate: date })
}, [])
```

**Step 2: Update QuarterView and YearView props**

Pass the new callbacks:

```tsx
{zoomLevel === 'quarter' && (
  <QuarterView
    year={currentYear}
    quarter={currentQuarter}
    trips={allTrips}
    holidays={allHolidays}
    customDays={allCustomDays}
    onMonthClick={handleMonthClick}
    onDayClick={handleDayClick}
    onTripClick={handleTripClick}
  />
)}
{zoomLevel === 'year' && (
  <YearView
    year={currentYear}
    trips={allTrips}
    holidays={allHolidays}
    customDays={allCustomDays}
    onMonthClick={handleMonthClick}
    onDayClick={handleDayClick}
    onTripClick={handleTripClick}
  />
)}
```

Note: `handleMonthClick` keeps its existing behavior (zooms to month view). It's only called from month header clicks now, not day clicks.

**Step 3: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/pages/PlanningCenterPage.tsx
git commit -m "feat: wire up day click and trip click handlers for compact views"
```

---

### Task 5: Add mini map to SidebarTripDetail

**Files:**
- Modify: `frontend/src/components/planning/SidebarTripDetail.tsx`

**Step 1: Import MapView and TripMarker**

MapView is lazy-loaded elsewhere but we can import it directly here since it handles its own MAPBOX_TOKEN check gracefully (shows placeholder). TripMarker must be a direct import (not lazy — per CLAUDE.md rules).

```tsx
import { MapView } from '../map/MapView'
import { TripMarker } from '../map/TripMarker'
```

**Step 2: Add map section between status badge and action buttons**

Only render when the trip has coordinates:

```tsx
{trip.destination_latitude != null && trip.destination_longitude != null && (
  <div className="rounded-xl overflow-hidden border border-cloud-200" style={{ height: '200px' }}>
    <MapView
      center={[trip.destination_longitude, trip.destination_latitude]}
      zoom={8}
      interactive={false}
      className="h-full w-full"
    >
      <TripMarker
        tripId={trip.id}
        longitude={trip.destination_longitude}
        latitude={trip.destination_latitude}
        destination={trip.destination}
        status={trip.status}
      />
    </MapView>
  </div>
)}
```

Place this between `<TripStatusBadge>` and the action buttons `<div className="space-y-2 pt-2">`.

**Step 3: Add member count display**

The `TripSummary` type has `member_count`. Add it below the dates:

```tsx
<p className="text-sm text-cloud-500 mt-1">
  {trip.start_date} to {trip.end_date} ({days} days)
</p>
{trip.member_count > 1 && (
  <p className="text-sm text-cloud-500">
    {trip.member_count} members
  </p>
)}
```

**Step 4: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (MapView handles missing token gracefully)

**Step 5: Commit**

```bash
git add frontend/src/components/planning/SidebarTripDetail.tsx
git commit -m "feat: add mini map and member count to trip detail sidebar"
```

---

### Task 6: Create CountrySelect dropdown component

**Files:**
- Create: `frontend/src/components/planning/CountrySelect.tsx`

**Step 1: Write the CountrySelect component**

A custom dropdown with checkboxes. Uses a `useRef` + `useEffect` for click-outside closing and an `onKeyDown` handler for Escape.

```tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SupportedCountry } from '../../lib/types'

interface CountrySelectProps {
  supportedCountries: SupportedCountry[]
  enabledCodes: string[]
  onToggle: (code: string) => void
}

// Fixed order: US first, UK second, then alphabetical by name
function sortCountries(countries: SupportedCountry[]): SupportedCountry[] {
  return [...countries].sort((a, b) => {
    if (a.code === 'US') return -1
    if (b.code === 'US') return 1
    if (a.code === 'UK') return -1
    if (b.code === 'UK') return 1
    return a.name.localeCompare(b.name)
  })
}

export function CountrySelect({ supportedCountries, enabledCodes, onToggle }: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const sorted = sortCountries(supportedCountries)
  const label = enabledCodes.length > 0 ? enabledCodes.join(', ') : 'None'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-cloud-700 bg-white border border-cloud-200 rounded-lg hover:bg-cloud-50 transition-colors"
      >
        <span className="text-cloud-500 mr-0.5">Holidays:</span>
        <span className="max-w-[8rem] truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-cloud-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-cloud-200 rounded-xl shadow-lg z-50 py-1">
          {sorted.map((c) => (
            <label
              key={c.code}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-cloud-50 cursor-pointer text-sm text-cloud-700"
            >
              <input
                type="checkbox"
                checked={enabledCodes.includes(c.code)}
                onChange={() => onToggle(c.code)}
                className="rounded border-cloud-300 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span className="font-medium">{c.code}</span>
              <span className="text-cloud-500">{c.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify types pass**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/planning/CountrySelect.tsx
git commit -m "feat: create CountrySelect multi-select dropdown component"
```

---

### Task 7: Replace inline holiday buttons in PlanningHeader

**Files:**
- Modify: `frontend/src/components/planning/PlanningHeader.tsx`

**Step 1: Replace inline buttons with CountrySelect**

Import `CountrySelect` and replace the inline country toggle buttons section:

```tsx
import { CountrySelect } from './CountrySelect'
```

Remove the inline `handleCountryToggle` function. Move the toggle logic into a callback that gets passed down. Replace the `<div className="flex items-center gap-1">` block (lines 94-110) with:

```tsx
{supportedCountries && (
  <CountrySelect
    supportedCountries={supportedCountries}
    enabledCodes={enabledCodes}
    onToggle={handleCountryToggle}
  />
)}
```

Keep `handleCountryToggle` as-is — it already implements the enable/disable toggle logic.

Remove the `useSupportedCountries` import and hook call from PlanningHeader — move it up. Actually, `useSupportedCountries` is already called in PlanningHeader and the data is passed to CountrySelect. That's fine, keep it as-is.

**Step 2: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/planning/PlanningHeader.tsx
git commit -m "feat: replace inline holiday buttons with CountrySelect dropdown"
```

---

### Task 8: Update tests for new behavior

**Files:**
- Modify: `frontend/src/__tests__/PlanningCenterPage.test.tsx`

**Step 1: Add test for trip bars in quarter view**

```tsx
it('shows trip bars in quarter view', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('holidays')) {
      return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: [] } })
    }
    if (url.includes('supported-countries')) {
      return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
    }
    return Promise.resolve({
      data: [{
        id: 'trip-1',
        destination: 'Paris',
        start_date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-10`,
        end_date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15`,
        status: 'planning',
        type: 'vacation',
        member_count: 2,
        destination_latitude: 48.8566,
        destination_longitude: 2.3522,
        notes: null,
        parent_trip_id: null,
        created_at: '2026-01-01',
      }],
    })
  })

  renderWithRouter()
  await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Quarter'))

  await waitFor(() => {
    expect(screen.getByTitle('Paris')).toBeInTheDocument()
  })
})
```

**Step 2: Add test for day click opens sidebar (not zoom)**

```tsx
it('clicking a day in quarter view opens trip create sidebar', async () => {
  renderWithRouter()
  await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Quarter'))

  // Click a day number in the quarter view
  await waitFor(() => {
    const dayCell = screen.getAllByText('15')[0]
    expect(dayCell).toBeInTheDocument()
  })
  await userEvent.click(screen.getAllByText('15')[0])

  // Should open sidebar with trip create form, NOT zoom to month
  await waitFor(() => {
    expect(screen.getByText('New Trip')).toBeInTheDocument()
  })
  // Quarter view should still be visible
  expect(screen.queryByText('Sun')).not.toBeInTheDocument()
})
```

**Step 3: Add test for country dropdown**

```tsx
it('shows holiday country dropdown', async () => {
  renderWithRouter()
  await waitFor(() => {
    expect(screen.getByText('Holidays:')).toBeInTheDocument()
  })

  // Click to open dropdown
  await userEvent.click(screen.getByText('Holidays:').closest('button')!)

  await waitFor(() => {
    expect(screen.getByText('United States')).toBeInTheDocument()
  })
})
```

**Step 4: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add frontend/src/__tests__/PlanningCenterPage.test.tsx
git commit -m "test: add tests for compact trip bars, day click, and country dropdown"
```

---

### Task 9: Final verification

**Step 1: Run full frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: All pass

**Step 2: Run full backend checks**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest
```

Expected: All pass (no backend changes, but verify nothing broke)

**Step 3: Manual browser test**

Start servers and test in browser:
1. Navigate to `/calendar` — verify month view unchanged
2. Click Quarter — verify trip bars visible as thin colored bars with destination labels
3. Click a trip bar in quarter view — verify sidebar opens with trip detail + map
4. Click an empty day in quarter view — verify sidebar opens with trip create, date pre-filled
5. Click month header in quarter view — verify it zooms to that month
6. Click Year — verify trip bars visible (no text, tooltip on hover)
7. Click Holidays dropdown — verify all 10 countries listed, US first, UK second
8. Toggle a country — verify holidays appear/disappear on calendar

**Step 4: Commit any final fixes and push**

```bash
git push origin feat/planning-center
```
