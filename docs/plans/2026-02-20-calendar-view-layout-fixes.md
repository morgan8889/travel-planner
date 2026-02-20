# Calendar View Layout Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three layout bugs in the calendar views — quarter view trip bar overflow, year view missing grid borders, and year view trip bars appearing below the wrong row.

**Architecture:** Three independent edits across QuarterView.tsx, YearView.tsx, and TripSpan.tsx, each backed by a failing test first. QuarterView gets a taller paddingBottom (36→48px). YearView gets the collapsed border pattern (border-t border-l on grid + border-b border-r on padding cells) and a flex-col layout with a dedicated h-4 trip bar strip. TripSpan gets a corrected small-size bottom offset (stackIndex×4 → stackIndex×8) to fit within the new 16px strip.

**Tech Stack:** React, Tailwind CSS, Vitest + Testing Library

---

### Task 1: Quarter view — increase trip bar padding to fit 3 bars

**Files:**
- Modify: `frontend/src/__tests__/QuarterView.test.tsx`
- Modify: `frontend/src/components/planning/QuarterView.tsx:113`

---

**Step 1: Add failing test for paddingBottom: '48px'**

Open `frontend/src/__tests__/QuarterView.test.tsx` and add this test inside the existing `describe('QuarterView grid lines', ...)` block:

```tsx
it('week container has paddingBottom 48px to fit 3 trip bars', () => {
  const { container } = render(<QuarterView {...baseProps} />)
  // Week containers are the divs with inline paddingBottom style
  const weekContainer = container.querySelector('[style]') as HTMLElement
  expect(weekContainer.style.paddingBottom).toBe('48px')
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/QuarterView.test.tsx
```

Expected: FAIL — `paddingBottom` is `'36px'`, not `'48px'`

**Step 3: Fix QuarterView.tsx line 113**

Current line 113:
```tsx
<div key={_weekIdx} className="relative" style={{ paddingBottom: '36px' }}>
```

Replace with:
```tsx
<div key={_weekIdx} className="relative" style={{ paddingBottom: '48px' }}>
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/QuarterView.test.tsx
```

Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/QuarterView.tsx frontend/src/__tests__/QuarterView.test.tsx && git commit -m "fix: increase quarter view trip bar padding to 48px for 3 bars"
```

---

### Task 2: Year view — collapsed border pattern

**Files:**
- Create: `frontend/src/__tests__/YearView.test.tsx`
- Modify: `frontend/src/components/planning/YearView.tsx:101,104`

---

**Step 1: Create failing tests for year view borders**

Create `frontend/src/__tests__/YearView.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { YearView } from '../components/planning/YearView'

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
    // Jan 2026 starts on Thursday — first week has 4 padding cells
    const { container } = render(<YearView {...baseProps} />)
    const paddingCells = container.querySelectorAll('.aspect-square.border-b.border-r.border-cloud-100')
    expect(paddingCells.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: FAIL — `border-t border-l` not present, `gap-px` is present, padding cells have no borders

**Step 3: Fix YearView.tsx grid div (line 101)**

Current line 101:
```tsx
<div className="grid grid-cols-7 gap-px">
```

Replace with:
```tsx
<div className="grid grid-cols-7 border-t border-l border-cloud-100">
```

**Step 4: Fix YearView.tsx padding cell (line 104)**

Current line 104:
```tsx
return <div key={i} className="aspect-square" />
```

Replace with:
```tsx
return <div key={i} className="aspect-square border-b border-r border-cloud-100" />
```

**Step 5: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: PASS (all 3 tests)

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/YearView.tsx frontend/src/__tests__/YearView.test.tsx && git commit -m "fix: year view grid borders use collapsed border pattern"
```

---

### Task 3: Year view — dedicated trip bar strip + TripSpan offset

**Files:**
- Modify: `frontend/src/__tests__/YearView.test.tsx`
- Modify: `frontend/src/__tests__/TripSpan.test.tsx:43-47`
- Modify: `frontend/src/components/planning/YearView.tsx:100,123-152`
- Modify: `frontend/src/components/planning/TripSpan.tsx:57`

---

**Step 1: Add failing tests**

**In `frontend/src/__tests__/YearView.test.tsx`**, add a new describe block after the existing one:

```tsx
describe('YearView week container layout', () => {
  it('week container uses flex flex-col', () => {
    const { container } = render(<YearView {...baseProps} />)
    const flexContainers = container.querySelectorAll('.flex.flex-col')
    expect(flexContainers.length).toBeGreaterThan(0)
  })

  it('renders a relative h-4 trip bar strip below the day grid', () => {
    const { container } = render(<YearView {...baseProps} />)
    const strips = container.querySelectorAll('.relative.h-4')
    expect(strips.length).toBeGreaterThan(0)
  })
})
```

**In `frontend/src/__tests__/TripSpan.test.tsx`**, update the existing size="small" bottom offset test (lines 43–47). Find this block:

```tsx
it('uses stackIndex * 4 for bottom offset', () => {
  render(<TripSpan {...baseProps} size="small" stackIndex={2} />)
  const btn = screen.getByRole('button')
  expect(btn.style.bottom).toBe(`${2 + 2 * 4}px`)
})
```

Replace with:

```tsx
it('uses stackIndex * 8 for bottom offset', () => {
  render(<TripSpan {...baseProps} size="small" stackIndex={2} />)
  const btn = screen.getByRole('button')
  expect(btn.style.bottom).toBe(`${2 + 2 * 8}px`)
})
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx src/__tests__/TripSpan.test.tsx
```

Expected: FAIL — no `.flex.flex-col`, no `.relative.h-4`, bottom offset still `'10px'` not `'18px'`

**Step 3: Rewrite YearView.tsx week container section (lines 99–153)**

Replace this block (from the opening `<div key={_weekIdx}` to its closing `</div>`):

Current:
```tsx
return (
  <div key={_weekIdx} className="relative pb-2">
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
    {/* Compact trip bars — no labels in year view, tooltip only */}
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
          size="small"
          startDate={trip.start_date}
          endDate={trip.end_date}
          onClick={() => onTripClick(trip)}
        />
      )
    })}
  </div>
)
```

Replace with:
```tsx
return (
  <div key={_weekIdx} className="flex flex-col">
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
    {/* Dedicated trip bar strip below the day grid — always rendered for consistent row height */}
    <div className="relative h-4">
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
            size="small"
            startDate={trip.start_date}
            endDate={trip.end_date}
            onClick={() => onTripClick(trip)}
          />
        )
      })}
    </div>
  </div>
)
```

**Step 4: Fix TripSpan.tsx size="small" bottom offset (line 57)**

Current line 57:
```tsx
const bottomOffset = size === 'small' ? stackIndex * 4 : stackIndex * 14
```

Replace with:
```tsx
const bottomOffset = size === 'small' ? stackIndex * 8 : stackIndex * 14
```

Math: strip height = 16px (h-4), bar height = 6px (h-1.5), margin = 2px.
- Bar 0: bottom 2px → occupies [8, 14]px from top ✓
- Bar 1: bottom 10px → occupies [0, 6]px from top ✓
- 2px gap between bars ✓

`size="medium"` offset (`stackIndex * 14`) is unchanged — quarter view is unaffected.

**Step 5: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx src/__tests__/TripSpan.test.tsx
```

Expected: PASS (all tests in both files)

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/YearView.tsx frontend/src/components/planning/TripSpan.tsx frontend/src/__tests__/YearView.test.tsx frontend/src/__tests__/TripSpan.test.tsx && git commit -m "fix: year view trip bars in dedicated h-4 strip below day grid"
```

---

### Task 4: Full validation

**Step 1: Run full test suite**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: All tests pass (no regressions)

**Step 2: Type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
```

Expected: No errors
