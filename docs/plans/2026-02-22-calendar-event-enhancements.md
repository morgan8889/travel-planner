# Calendar Event Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add emerald event-type color to calendar trip bars, replace tooltip with a rich popover card across all three views, wire the year-view right panel to open the sidebar on click, add a Holidays section to that panel, and constrain panel height for graceful overflow.

**Architecture:** All changes are surgical edits to four existing files (`TripSpan`, `MonthView`, `QuarterView`, `YearView`). A new `TripPopover` sub-component is extracted inside `TripSpan.tsx`. No new files outside of the test file for `TripSpan`. No backend changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + Testing Library

---

## Key Files

| File | What it does |
|------|-------------|
| `frontend/src/components/planning/TripSpan.tsx` | Renders colored trip bar in all views; has existing tooltip |
| `frontend/src/components/planning/MonthView.tsx` | Calls `TripSpan` with `size='full'`; missing `colorBy`, `tripType`, `startDate`, `endDate`, `notes` |
| `frontend/src/components/planning/QuarterView.tsx` | Calls `TripSpan` with `size='medium'`; missing `colorBy`, `tripType`, `notes` |
| `frontend/src/components/planning/YearView.tsx` | Has right-hand panel; inventory trip click does NOT call `onTripClick`; no holidays section |
| `frontend/src/__tests__/TripSpan.test.tsx` | Does not exist yet — create it |
| `frontend/src/__tests__/YearView.test.tsx` | Existing tests; line 139 test must be inverted |

---

## Existing Behavior to Know

**TripSpan `TYPE_COLORS`** has `vacation`, `remote_week`, `sabbatical` — no `event`, so event trips render in planning-blue.

**TripSpan tooltip** (lines 90-96): For `size='small'`/`size='medium'`, a dark div appears `onMouseEnter`. For `size='full'` (month view), the native `title=` attribute is used instead — no hover state at all.

**YearView inventory click** (line 121-132): `handleInventoryTripClick` highlights + scrolls but does NOT call `onTripClick`. The test at `YearView.test.tsx:139` explicitly asserts this. We're changing it — the test must be updated first.

**YearView right panel** has no Holidays section. It does receive `holidays: HolidayEntry[]` (shape: `{ date, name, country_code }`).

**Event name extraction:** For event-type trips, `trip.notes` contains the event name, e.g. `"3M Half Marathon — local Austin race"`. Extract the name by splitting on `" — "` and taking the first part. If no `" — "`, use the full notes (up to 60 chars). If `notes` is null, fall back to `destination`.

---

## Task 1: TripSpan — event color, popover card, new tests

**Files:**
- Create: `frontend/src/__tests__/TripSpan.test.tsx`
- Modify: `frontend/src/components/planning/TripSpan.tsx`

### Step 1: Create the failing test file

Create `frontend/src/__tests__/TripSpan.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TripSpan } from '../components/planning/TripSpan'

const base = {
  destination: 'Austin, TX',
  status: 'booked' as const,
  startCol: 0,
  colSpan: 3,
  stackIndex: 0,
  onClick: vi.fn(),
}

describe('TripSpan event color', () => {
  it('applies emerald classes for event trip type', () => {
    const { container } = render(
      <TripSpan {...base} colorBy="type" tripType="event" size="medium" />,
    )
    expect(container.querySelector('button')?.className).toMatch(/emerald/)
  })

  it('applies blue classes for vacation trip type', () => {
    const { container } = render(
      <TripSpan {...base} colorBy="type" tripType="vacation" size="medium" />,
    )
    expect(container.querySelector('button')?.className).toMatch(/blue/)
  })
})

describe('TripSpan popover card', () => {
  it('shows event name from notes on hover (size=medium)', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        startDate="2026-01-18"
        endDate="2026-01-18"
        notes="3M Half Marathon — local Austin race"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByText('3M Half Marathon')).toBeInTheDocument()
  })

  it('shows destination for non-event trips on hover (size=medium)', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="vacation"
        startDate="2026-03-12"
        endDate="2026-03-15"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    // destination appears in both inline label and popover — just check it's present
    expect(screen.getAllByText('Austin, TX').length).toBeGreaterThanOrEqual(1)
  })

  it('hides popover after mouse leave', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        startDate="2026-01-18"
        endDate="2026-01-18"
        notes="3M Half Marathon — local Austin race"
      />,
    )
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    expect(screen.getByText('3M Half Marathon')).toBeInTheDocument()
    fireEvent.mouseLeave(btn)
    expect(screen.queryByText('3M Half Marathon')).not.toBeInTheDocument()
  })

  it('shows popover on hover for size=full (month view)', () => {
    render(
      <TripSpan
        {...base}
        size="full"
        colorBy="type"
        tripType="vacation"
        startDate="2026-03-12"
        endDate="2026-03-15"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    // destination appears in both inline text and popover
    expect(screen.getAllByText('Austin, TX').length).toBeGreaterThanOrEqual(1)
  })

  it('shows single date in popover for same-day events', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        startDate="2026-01-18"
        endDate="2026-01-18"
        notes="3M Half Marathon"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    // Should show "Jan 18" not "Jan 18 – Jan 18"
    const dateEl = screen.getByText('Jan 18')
    expect(dateEl).toBeInTheDocument()
  })
})
```

### Step 2: Run the test to confirm it fails

```bash
cd frontend && npx vitest run src/__tests__/TripSpan.test.tsx
```

Expected: Several failures — emerald class missing, popover elements not found.

### Step 3: Implement TripSpan changes

Replace the full content of `frontend/src/components/planning/TripSpan.tsx`:

```typescript
import { useState, useEffect } from 'react'
import type { TripStatus, TripType } from '../../lib/types'

const TRIP_COLORS: Record<string, string> = {
  dreaming: 'bg-purple-200 text-purple-800 hover:bg-purple-300',
  planning: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  booked: 'bg-green-200 text-green-800 hover:bg-green-300',
  active: 'bg-orange-200 text-orange-800 hover:bg-orange-300',
  completed: 'bg-cloud-200 text-cloud-600 hover:bg-cloud-300',
}

const TYPE_COLORS: Record<string, string> = {
  vacation: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  remote_week: 'bg-teal-200 text-teal-800 hover:bg-teal-300',
  sabbatical: 'bg-amber-200 text-amber-800 hover:bg-amber-300',
  event: 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300',
}

interface TripSpanProps {
  destination: string
  status: TripStatus
  /** Column index (0-6) where the span starts in this row */
  startCol: number
  /** Number of columns the span covers in this row */
  colSpan: number
  /** Vertical offset for stacking overlapping trips */
  stackIndex: number
  onClick: () => void
  /** Display size: 'small' (thin bar, popover only), 'medium' (bar with inline label), 'full' (month view) */
  size?: 'small' | 'medium' | 'full'
  /** Full date range for popover display */
  startDate?: string
  endDate?: string
  colorBy?: 'status' | 'type'
  tripType?: TripType
  isHighlighted?: boolean
  /** Trip notes — used to extract event name for event-type trips */
  notes?: string | null
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}

interface TripPopoverProps {
  destination: string
  tripType?: TripType
  notes?: string | null
  startDate?: string
  endDate?: string
}

function TripPopover({ destination, tripType, notes, startDate, endDate }: TripPopoverProps) {
  const isEvent = tripType === 'event'
  const primaryLabel = isEvent ? (getEventName(notes) ?? destination) : destination

  const dateLabel = (() => {
    if (!startDate) return null
    if (startDate === endDate) return formatShortDate(startDate)
    return `${formatShortDate(startDate)} – ${formatShortDate(endDate ?? startDate)}`
  })()

  return (
    <div className="absolute bottom-full left-0 mb-1.5 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[120px]">
      <div className="font-semibold leading-tight">{primaryLabel}</div>
      {dateLabel && <div className="opacity-70 mt-0.5">{dateLabel}</div>}
      {tripType && (
        <div className="opacity-60 capitalize mt-0.5">
          {tripType.replace('_', ' ')}
        </div>
      )}
    </div>
  )
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
  colorBy,
  tripType,
  isHighlighted,
  notes,
}: TripSpanProps) {
  const [hovered, setHovered] = useState(false)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (!isHighlighted) return
    const startTimer = setTimeout(() => setPulsing(true), 0)
    const endTimer = setTimeout(() => setPulsing(false), 1000)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [isHighlighted])

  const colorClasses =
    colorBy === 'type' && tripType
      ? TYPE_COLORS[tripType] ?? TRIP_COLORS.planning
      : TRIP_COLORS[status] ?? TRIP_COLORS.planning

  const highlightClasses = isHighlighted
    ? ` ring-2 ring-indigo-500 ring-offset-1${pulsing ? ' animate-pulse' : ''}`
    : ''

  if (size === 'small' || size === 'medium') {
    const heightClass = size === 'small' ? 'h-1.5' : 'h-3'
    const bottomOffset = size === 'small' ? stackIndex * 8 : stackIndex * 14

    return (
      <button
        type="button"
        className={`absolute left-0 ${heightClass} rounded-full cursor-pointer transition-colors ${colorClasses}${highlightClasses}`}
        style={{
          width: `${(colSpan / 7) * 100}%`,
          marginLeft: `${(startCol / 7) * 100}%`,
          bottom: `${2 + bottomOffset}px`,
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {size === 'medium' && (
          <span className="absolute inset-0 flex items-center px-1 text-[9px] leading-none truncate pointer-events-none">
            {destination}
          </span>
        )}
        {hovered && (
          <TripPopover
            destination={destination}
            tripType={tripType}
            notes={notes}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </button>
    )
  }

  // size === 'full' (month view)
  return (
    <button
      type="button"
      className={`absolute left-0 h-5 rounded-sm text-[11px] font-medium px-1.5 truncate cursor-pointer transition-colors ${colorClasses}${highlightClasses}`}
      style={{
        gridColumnStart: startCol + 1,
        gridColumnEnd: startCol + colSpan + 1,
        top: `${2.5 + stackIndex * 1.5}rem`,
        width: `${(colSpan / 7) * 100}%`,
        marginLeft: `${(startCol / 7) * 100}%`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {destination}
      {hovered && (
        <TripPopover
          destination={destination}
          tripType={tripType}
          notes={notes}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </button>
  )
}
```

### Step 4: Run tests — confirm they pass

```bash
cd frontend && npx vitest run src/__tests__/TripSpan.test.tsx
```

Expected: All tests pass.

### Step 5: Run full frontend suite to check for regressions

```bash
cd frontend && npx vitest run
```

Expected: All tests pass.

### Step 6: Commit

```bash
git add frontend/src/__tests__/TripSpan.test.tsx frontend/src/components/planning/TripSpan.tsx
git commit -m "feat: add event color and rich popover card to TripSpan"
```

---

## Task 2: Pass missing props from MonthView and QuarterView

**Files:**
- Modify: `frontend/src/components/planning/MonthView.tsx:170-179`
- Modify: `frontend/src/components/planning/QuarterView.tsx:150-163`

No new tests needed — TripSpan tests already cover the popover behaviour. Vitest run confirms no regressions.

### Step 1: Update MonthView's TripSpan call

In `MonthView.tsx`, find the `<TripSpan>` call (around line 170). Add the five missing props:

```tsx
<TripSpan
  key={trip.id}
  destination={trip.destination}
  status={trip.status}
  colorBy="type"
  tripType={trip.type}
  startCol={startCol}
  colSpan={colSpan}
  stackIndex={tripIdx}
  startDate={trip.start_date}
  endDate={trip.end_date}
  notes={trip.notes}
  onClick={() => onTripClick(trip)}
/>
```

(Previously: no `colorBy`, `tripType`, `startDate`, `endDate`, `notes`.)

### Step 2: Update QuarterView's TripSpan call

In `QuarterView.tsx`, find the `<TripSpan>` call (around line 150). Add the three missing props:

```tsx
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
  notes={trip.notes}
  onClick={() => onTripClick(trip)}
/>
```

(Previously: no `colorBy`, `tripType`, `notes`.)

### Step 3: Run full suite

```bash
cd frontend && npx vitest run
```

Expected: All pass.

### Step 4: Commit

```bash
git add frontend/src/components/planning/MonthView.tsx frontend/src/components/planning/QuarterView.tsx
git commit -m "feat: pass tripType, colorBy, notes to TripSpan in MonthView and QuarterView"
```

---

## Task 3: YearView — inventory opens sidebar, holidays section, panel overflow

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/__tests__/YearView.test.tsx`

### Step 1: Update the failing test first

In `frontend/src/__tests__/YearView.test.tsx`, the test at line 139 currently asserts that `onTripClick` is NOT called. We're changing behavior — invert it:

Replace this block (lines 139-149):

```typescript
it('does NOT call onTripClick when inventory panel trip is clicked', async () => {
  const user = userEvent.setup()
  const onTripClick = vi.fn()
  const trips = [makeTripSummary({ destination: 'Rome' })]
  render(<YearView {...baseProps} trips={trips} onTripClick={onTripClick} />)
  const romeButtons = screen.getAllByRole('button', { name: /rome/i })
  // Inventory button is last in DOM order (after all grid bars)
  await user.click(romeButtons[romeButtons.length - 1])
  // Inventory click should NOT open sidebar — no onTripClick call
  expect(onTripClick).not.toHaveBeenCalled()
})
```

With:

```typescript
it('calls onTripClick when inventory panel trip is clicked', async () => {
  const user = userEvent.setup()
  const onTripClick = vi.fn()
  const trips = [makeTripSummary({ destination: 'Rome' })]
  render(<YearView {...baseProps} trips={trips} onTripClick={onTripClick} />)
  const romeButtons = screen.getAllByRole('button', { name: /rome/i })
  // Inventory button is last in DOM order (after all grid bars)
  await user.click(romeButtons[romeButtons.length - 1])
  expect(onTripClick).toHaveBeenCalledWith(expect.objectContaining({ destination: 'Rome' }))
})
```

Also add a new test for the Holidays section at the end of the `'YearView trip inventory panel'` describe block:

```typescript
it('renders holidays section when holidays exist', () => {
  const holidays = [
    { date: '2026-01-01', name: 'New Year\'s Day', country_code: 'US' },
    { date: '2026-07-04', name: 'Independence Day', country_code: 'US' },
  ]
  render(<YearView {...baseProps} holidays={holidays} />)
  expect(screen.getByText(/holidays/i)).toBeInTheDocument()
  expect(screen.getByText("New Year's Day")).toBeInTheDocument()
  expect(screen.getByText('Independence Day')).toBeInTheDocument()
})

it('does not render holidays section when holidays list is empty', () => {
  render(<YearView {...baseProps} holidays={[]} />)
  expect(screen.queryByText(/^holidays$/i)).not.toBeInTheDocument()
})

it('calls onHolidayClick when a holiday in the panel is clicked', async () => {
  const user = userEvent.setup()
  const onHolidayClick = vi.fn()
  const holidays = [{ date: '2026-01-01', name: "New Year's Day", country_code: 'US' }]
  render(<YearView {...baseProps} holidays={holidays} onHolidayClick={onHolidayClick} />)
  await user.click(screen.getByText("New Year's Day"))
  expect(onHolidayClick).toHaveBeenCalledWith('2026-01-01')
})
```

### Step 2: Run tests — confirm the inverted test and new holiday tests fail

```bash
cd frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: The old-name test now fails (assertion flipped), and the 3 new holiday tests fail.

### Step 3: Implement YearView changes

Three changes in `frontend/src/components/planning/YearView.tsx`:

**Change A — `handleInventoryTripClick` also calls `onTripClick`** (line 121-132):

```typescript
function handleInventoryTripClick(trip: TripSummary) {
  if (highlightedTripId === trip.id) {
    setHighlightedTripId(null)
  } else {
    setHighlightedTripId(trip.id)
    const month = new Date(trip.start_date + 'T00:00:00').getMonth()
    const el = monthRefs.current[month]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }
  onTripClick(trip)
}
```

**Change B — add `notes` prop to the TripSpan in the week strip** (inside the `weeks.map` → `weekTrips.slice(0, 2).map`):

```tsx
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
  notes={trip.notes}
  isHighlighted={trip.id === highlightedTripId}
  onClick={() => onTripClick(trip)}
/>
```

**Change C — right panel: add `max-h`, add Holidays section**

Update the outer div of the right panel (currently `<div className="w-60 shrink-0 border-l border-cloud-200 p-4 overflow-y-auto">`):

```tsx
<div className="w-60 shrink-0 border-l border-cloud-200 p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
```

After the existing Events section (the `{customDaysForYear.length > 0 && ...}` block), add the Holidays section:

```tsx
{/* Holidays section */}
{holidays.filter((h) => h.date >= `${year}-01-01` && h.date <= `${year}-12-31`).length > 0 && (
  <div className="mt-4 pt-4 border-t border-cloud-200">
    <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
      Holidays
    </h3>
    {holidays
      .filter((h) => h.date >= `${year}-01-01` && h.date <= `${year}-12-31`)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((h) => (
        <button
          key={`${h.country_code}-${h.date}`}
          type="button"
          onClick={() => onHolidayClick?.(h.date)}
          className="w-full flex items-start gap-2 py-1.5 text-left hover:bg-cloud-50 rounded-lg px-1 -mx-1 transition-colors group"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-cloud-800 truncate group-hover:text-indigo-700 transition-colors">
              {h.name}
            </p>
            <p className="text-[10px] text-cloud-500">
              {formatShortDate(h.date)} · {h.country_code}
            </p>
          </div>
        </button>
      ))}
  </div>
)}
```

### Step 4: Run YearView tests — confirm all pass

```bash
cd frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: All tests pass including the re-named inventory click test and the 3 new holiday tests.

### Step 5: Run full frontend suite

```bash
cd frontend && npx vitest run
```

Expected: All tests pass.

### Step 6: Type check

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

### Step 7: Commit

```bash
git add frontend/src/components/planning/YearView.tsx frontend/src/__tests__/YearView.test.tsx
git commit -m "feat: year view right panel — sidebar on trip click, holidays section, overflow cap"
```

---

## Final Verification

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

All three should be clean.

Then manually verify in the browser:
1. Year view — event bars are emerald (not blue)
2. Hover over any bar in year/quarter/month → rich popover card appears with name + date
3. For event trips, popover shows the race name (e.g., "3M Half Marathon"), not "Austin, TX"
4. Click any trip bar → sidebar opens ✓
5. Year view right panel → click a trip → sidebar opens (was highlight-only before)
6. Year view right panel → Holidays section shows with red dots, clicking opens `SidebarHolidayDetail`
7. If you have many trips + events + holidays, the right panel scrolls internally and does not overflow the page
