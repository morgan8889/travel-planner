# Custom Day Dot, Event Label & Year View Layout — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Star icon / amber text with a unified amber dot + hover popover across all calendar views; show the event name (not destination) in event trip bars; fix year view layout so the calendar grid doesn't stretch when the panel expands.

**Architecture:** Three independent changes across five frontend files. No backend changes, no new files.

**Tech Stack:** React (with hooks: `useState`), Tailwind CSS, Vitest + Testing Library.

---

## Task 1: DayCell — rename prop + amber dot + hover popover + caller updates

**Design doc reference:** Change 1 in `docs/plans/2026-02-22-custom-day-dot-event-label-layout.md`

**Files:**
- Test: `frontend/src/__tests__/DayCell.test.tsx`
- Modify: `frontend/src/components/planning/DayCell.tsx`
- Modify: `frontend/src/components/planning/MonthView.tsx`
- Modify: `frontend/src/components/planning/QuarterView.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx` (DayCell caller only — YearView layout is Task 3)

---

### Step 1: Update DayCell tests

Replace the entire `describe('DayCell full mode custom day icon', ...)` block (lines 92–140) with:

```tsx
describe('DayCell full mode custom day dot', () => {
  it('renders amber dot (not SVG) when customDayName is present in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
      />
    )
    // No SVG — no Star icon
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    // Amber dot present
    const dot = container.querySelector('.rounded-full.bg-amber-400')
    expect(dot).toBeInTheDocument()
  })

  it('does NOT render amber dot when holidayLabel takes precedence in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
        customDayName="My Event"
      />
    )
    expect(screen.getByText('Christmas')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(container.querySelector('.rounded-full.bg-amber-400')).not.toBeInTheDocument()
  })

  it('shows hover popover with name and date in full mode', () => {
    render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
      />
    )
    const dot = document.querySelector('.rounded-full.bg-amber-400') as HTMLElement
    fireEvent.mouseEnter(dot)
    expect(screen.getByText('Ironman')).toBeInTheDocument()
    expect(screen.getByText('Jul 14')).toBeInTheDocument()
    fireEvent.mouseLeave(dot)
    expect(screen.queryByText('Ironman')).not.toBeInTheDocument()
  })

  it('renders corner dot in compact mode (not SVG)', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
        compact={true}
      />
    )
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    // Corner dot: bottom-0.5 left-0.5 w-1.5 h-1.5
    const cornerDot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full.bg-amber-400')
    expect(cornerDot).toBeInTheDocument()
  })

  it('shows hover popover from corner dot in compact mode', () => {
    render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
        compact={true}
      />
    )
    const cornerDot = document.querySelector('.w-1\\.5.h-1\\.5.rounded-full.bg-amber-400') as HTMLElement
    fireEvent.mouseEnter(cornerDot)
    expect(screen.getByText('Ironman')).toBeInTheDocument()
    fireEvent.mouseLeave(cornerDot)
    expect(screen.queryByText('Ironman')).not.toBeInTheDocument()
  })
})
```

Also add `fireEvent` to the import at line 1:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

### Step 2: Run tests — verify they fail

```bash
cd frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: The new tests fail (`customDayName` prop doesn't exist yet, no amber dot, no SVG removal).

---

### Step 3: Implement DayCell.tsx

Replace the entire file with the following:

```tsx
import { useState, memo } from 'react'

interface DayCellProps {
  date: string  // YYYY-MM-DD
  dayNumber: number
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  isSelectedForCreate?: boolean
  holidayLabel?: string
  customDayName?: string
  compact?: boolean  // true for quarter/year views
  showLabel?: boolean  // show label text in compact mode (quarter view)
  onMouseDown?: (date: string) => void
  onMouseEnter?: (date: string) => void
  onClick?: (date: string) => void
  onHolidayClick?: (date: string) => void
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export const DayCell = memo(function DayCell({
  date,
  dayNumber,
  isToday,
  isCurrentMonth,
  isSelected,
  isSelectedForCreate = false,
  holidayLabel,
  customDayName,
  compact = false,
  showLabel = false,
  onMouseDown,
  onMouseEnter,
  onClick,
  onHolidayClick,
}: DayCellProps) {
  const [showCustomPopover, setShowCustomPopover] = useState(false)
  const label = holidayLabel || customDayName

  if (compact) {
    return (
      <div
        className={`relative w-full ${showLabel ? 'h-full min-h-[2.5rem]' : 'aspect-square'} border-b border-r border-cloud-100 flex flex-col items-start p-1 text-xs cursor-pointer
          ${isCurrentMonth ? 'text-cloud-700' : 'text-cloud-300'}
          ${isToday ? 'ring-2 ring-indigo-500 ring-inset font-bold' : ''}
          ${!isToday && isSelectedForCreate ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
          ${isSelected ? 'bg-indigo-100' : ''}
          ${holidayLabel ? 'font-semibold text-red-600' : ''}
        `}
        onClick={() => {
          if (holidayLabel && onHolidayClick) {
            onHolidayClick(date)
          } else {
            onClick?.(date)
          }
        }}
        title={holidayLabel}
      >
        {dayNumber}
        {showLabel && label && (
          <span className={`text-[10px] leading-tight truncate max-w-full ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
            {label}
          </span>
        )}
        {customDayName && (
          <>
            <div
              className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-400"
              onMouseEnter={() => setShowCustomPopover(true)}
              onMouseLeave={() => setShowCustomPopover(false)}
            />
            {showCustomPopover && (
              <div className="absolute bottom-full left-0 mb-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[100px]">
                <div className="font-semibold leading-tight">{customDayName}</div>
                <div className="opacity-70 mt-0.5">{formatShortDate(date)}</div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

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
        {holidayLabel && (
          <span className="text-[10px] leading-tight mt-1 truncate max-w-[calc(100%-2rem)] text-right text-red-500">
            {holidayLabel}
          </span>
        )}
        {customDayName && !holidayLabel && (
          <div className="relative">
            <div
              className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1 cursor-default"
              onMouseEnter={() => setShowCustomPopover(true)}
              onMouseLeave={() => setShowCustomPopover(false)}
            />
            {showCustomPopover && (
              <div className="absolute bottom-full right-0 mb-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[100px]">
                <div className="font-semibold leading-tight">{customDayName}</div>
                <div className="opacity-70 mt-0.5">{formatShortDate(date)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
```

### Step 4: Update callers

**MonthView.tsx** — line 150:
```tsx
// Before:
customDayLabel={customDayMap.get(day.date)}
// After:
customDayName={customDayMap.get(day.date)}
```

**QuarterView.tsx** — lines 70–74 (change Set → Map):
```tsx
// Before:
const customDaySet = useMemo(() => {
  return new Set(customDays.map((cd) =>
    cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
  ))
}, [customDays, year])
// After:
const customDayMap = useMemo(() => {
  const map = new Map<string, string>()
  for (const cd of customDays) {
    const dateStr = cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
    map.set(dateStr, cd.name)
  }
  return map
}, [customDays, year])
```

**QuarterView.tsx** — line 129:
```tsx
// Before:
customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
// After:
customDayName={customDayMap.get(day.date)}
```

**YearView.tsx** — lines 120–122 (change Set → Map for DayCell):
```tsx
// Before:
const customDaySet = useMemo(() => {
  return new Set(customDays.map((cd) => (cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date)))
}, [customDays, year])
// After:
const customDayMap = useMemo(() => {
  const map = new Map<string, string>()
  for (const cd of customDays) {
    const dateStr = cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
    map.set(dateStr, cd.name)
  }
  return map
}, [customDays, year])
```

**YearView.tsx** — line 257:
```tsx
// Before:
customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
// After:
customDayName={customDayMap.get(day.date)}
```

### Step 5: Run tests — verify they pass

```bash
cd frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: all tests pass.

Then run the full suite and check for TypeScript errors:

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected: no TypeScript errors, all tests pass.

### Step 6: Commit

```bash
cd frontend && git add src/components/planning/DayCell.tsx src/components/planning/MonthView.tsx src/components/planning/QuarterView.tsx src/components/planning/YearView.tsx src/__tests__/DayCell.test.tsx
git commit -m "feat: replace Star icon with unified amber dot + hover popover in DayCell"
```

---

## Task 2: TripSpan — show event name in bar text

**Design doc reference:** Change 2 in `docs/plans/2026-02-22-custom-day-dot-event-label-layout.md`

**Files:**
- Test: `frontend/src/__tests__/TripSpan.test.tsx`
- Modify: `frontend/src/components/planning/TripSpan.tsx`

---

### Step 1: Add test to TripSpan.test.tsx

Add a new `describe` block after the existing ones:

```tsx
describe('TripSpan event bar inline label', () => {
  it('shows event name as inline bar text for event trip (size=medium)', () => {
    const { container } = render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        notes="3M Half Marathon — local Austin race"
      />,
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('3M Half Marathon')
  })

  it('shows destination as inline bar text for non-event trip (size=medium)', () => {
    const { container } = render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="vacation"
      />,
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('Austin, TX')
  })

  it('shows event name as bar text for event trip (size=full)', () => {
    render(
      <TripSpan
        {...base}
        size="full"
        colorBy="type"
        tripType="event"
        notes="Unbound 200 — gravel race"
      />,
    )
    // Button's first text node is the displayLabel (before popover renders on hover)
    const button = screen.getByRole('button')
    // The bar text is a direct text node in the button — check textContent without the popover
    expect(button.textContent).toContain('Unbound 200')
  })
})
```

### Step 2: Run test — verify it fails

```bash
cd frontend && npx vitest run src/__tests__/TripSpan.test.tsx
```

Expected: the three new tests fail (bar text still shows `destination`).

---

### Step 3: Update TripSpan.tsx

Add `displayLabel` computation after `highlightClasses` (after line 123):

```tsx
const displayLabel =
  tripType === 'event' ? (getEventName(notes) ?? destination) : destination
```

Replace the inline label in the `size === 'medium'` branch (line 148–150):
```tsx
// Before:
<span className="absolute inset-0 flex items-center px-1 text-[9px] leading-none truncate pointer-events-none">
  {destination}
</span>
// After:
<span className="absolute inset-0 flex items-center px-1 text-[9px] leading-none truncate pointer-events-none">
  {displayLabel}
</span>
```

Replace the bar text in the `size === 'full'` branch (line 181):
```tsx
// Before:
      {destination}
// After:
      {displayLabel}
```

### Step 4: Run tests — verify they pass

```bash
cd frontend && npx vitest run src/__tests__/TripSpan.test.tsx
```

Expected: all tests pass.

### Step 5: Commit

```bash
cd frontend && git add src/components/planning/TripSpan.tsx src/__tests__/TripSpan.test.tsx
git commit -m "feat: show event name (not destination) as inline label on event-type trip bars"
```

---

## Task 3: YearView — items-start layout + month header hover popover

**Design doc reference:** Changes 3 in `docs/plans/2026-02-22-custom-day-dot-event-label-layout.md`

**Files:**
- Test: `frontend/src/__tests__/YearView.test.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx`

---

### Step 1: Update YearView tests

**Fix the existing "renders an amber dot" test** (lines 247–262) — remove the `title` attribute checks:

```tsx
it('renders an amber dot on the month heading when custom days exist in that month', () => {
  const customDays: CustomDay[] = [
    { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    { id: 'cd-2', user_id: 'u-1', name: 'Fun Run', date: '2026-07-20', recurring: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  const { container } = render(<YearView {...baseProps} customDays={customDays} />)
  const dots = container.querySelectorAll('span.bg-amber-400.w-2.h-2.rounded-full')
  expect(dots.length).toBeGreaterThan(0)
})
```

**Add a new test** for hover popover — append to `describe('YearView event badges', ...)`:

```tsx
it('shows hover popover with custom day names when month dot is hovered', () => {
  const customDays: CustomDay[] = [
    { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    { id: 'cd-2', user_id: 'u-1', name: 'Fun Run', date: '2026-07-20', recurring: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  const { container } = render(<YearView {...baseProps} customDays={customDays} />)
  const dots = container.querySelectorAll('span.bg-amber-400.w-2.h-2.rounded-full')
  // Before hover: 'Race Day' visible once in Events panel
  expect(screen.getAllByText('Race Day').length).toBe(1)
  fireEvent.mouseEnter(dots[0])
  // After hover: 'Race Day' appears again in popover (twice total)
  expect(screen.getAllByText('Race Day').length).toBe(2)
  expect(screen.getAllByText('Fun Run').length).toBe(2)
  fireEvent.mouseLeave(dots[0])
  // After leave: back to once
  expect(screen.getAllByText('Race Day').length).toBe(1)
})
```

**Also add items-start layout test** in `describe('YearView layout', ...)`:

```tsx
it('outer flex container uses items-start', () => {
  const { container } = render(<YearView {...baseProps} />)
  const outerFlex = container.querySelector('.flex.items-start')
  expect(outerFlex).toBeInTheDocument()
})
```

### Step 2: Run tests — verify they fail

```bash
cd frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: the new hover test fails (`title` attr test is now fixed). The `items-start` test also fails.

---

### Step 3: Update YearView.tsx

**Change 1 — outer flex (line 193):**
```tsx
// Before:
<div className="flex">
// After:
<div className="flex items-start">
```

**Change 2 — add `hoveredMonthDot` state** (after the `hoveredCustomId` state at line 163):
```tsx
const [hoveredMonthDot, setHoveredMonthDot] = useState<number | null>(null)
```

**Change 3 — replace month header dot** (lines 221–232 — the `{eventCount > 0 && (...)}` block):

```tsx
// Before:
{eventCount > 0 && (
  <span
    className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
    title={customDaysForYear
      .filter(
        (cd) =>
          new Date(cd.resolvedDate + 'T00:00:00').getMonth() === month,
      )
      .map((cd) => cd.name)
      .join(', ')}
  />
)}

// After:
{eventCount > 0 && (
  <div className="relative">
    <span
      className="w-2 h-2 rounded-full bg-amber-400 shrink-0 block cursor-default"
      onMouseEnter={() => setHoveredMonthDot(month)}
      onMouseLeave={() => setHoveredMonthDot(null)}
    />
    {hoveredMonthDot === month && (
      <div className="absolute top-full left-0 mt-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg z-50 pointer-events-none min-w-[120px]">
        {customDaysForYear
          .filter((cd) => new Date(cd.resolvedDate + 'T00:00:00').getMonth() === month)
          .map((cd) => (
            <div key={cd.id} className="leading-snug">
              <span className="font-semibold">{cd.name}</span>
              <span className="opacity-70 ml-1">{formatShortDate(cd.resolvedDate)}</span>
            </div>
          ))}
      </div>
    )}
  </div>
)}
```

### Step 4: Run tests — verify they pass

```bash
cd frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: all tests pass.

Then run the full suite:

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: no errors.

### Step 5: Commit

```bash
cd frontend && git add src/components/planning/YearView.tsx src/__tests__/YearView.test.tsx
git commit -m "feat: year view items-start layout + month header dot hover popover"
```

---

## Final Verification

```bash
# Full frontend suite
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass. Then manual browser verification:
- Month view: custom day cell shows amber dot (not star), hover shows name + date
- Quarter view: custom day cell shows corner dot, hover shows name + date
- Year view: custom day cell shows corner dot; month header dot hover lists all custom days for that month
- Year view: event trip bars show event name, not destination
- Year view: calendar grid doesn't stretch when right panel sections are expanded
