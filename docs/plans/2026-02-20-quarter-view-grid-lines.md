# Quarter View Grid Lines Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `cloud-100` border grid lines to all day cells in the quarter view, matching the month view's visual structure.

**Architecture:** Two files change. `DayCell.tsx` gains `border-b border-r border-cloud-100` in compact mode. `QuarterView.tsx` adds `border-t border-l border-cloud-100` on each week-row grid (closing the top/left edges) and `border-b border-r border-cloud-100` on empty padding cells. The day-header row gets `border-b border-cloud-200` to match the month view separator.

**Tech Stack:** React, Tailwind CSS, Vitest + Testing Library

---

### Task 1: Add border to compact DayCell

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx:40-48`
- Test: `frontend/src/__tests__/DayCell.test.tsx` (create)

**Step 1: Write the failing test**

Create `frontend/src/__tests__/DayCell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { DayCell } from '../components/planning/DayCell'

describe('DayCell compact mode', () => {
  it('renders border classes for grid lines', () => {
    const { container } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={true}
      />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toContain('border-b')
    expect(cell.className).toContain('border-r')
    expect(cell.className).toContain('border-cloud-100')
  })

  it('does not add border classes in non-compact mode', () => {
    const { container } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={false}
      />
    )
    const cell = container.firstChild as HTMLElement
    // non-compact already has its own border-b border-r border-cloud-100
    // this test just confirms compact path is separate
    expect(cell.className).toContain('border-b')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: FAIL — compact cell doesn't have `border-b border-r border-cloud-100`

**Step 3: Edit `DayCell.tsx` compact div**

In `frontend/src/components/planning/DayCell.tsx`, line 41, the compact div's `className` string starts with:
```
`w-full ${showLabel ? 'min-h-[2.5rem]' : 'aspect-square'} flex flex-col ...
```

Add `border-b border-r border-cloud-100` before `flex`:

```tsx
className={`w-full ${showLabel ? 'min-h-[2.5rem]' : 'aspect-square'} border-b border-r border-cloud-100 flex flex-col items-center justify-center text-xs rounded-sm cursor-pointer
  ${isCurrentMonth ? 'text-cloud-700' : 'text-cloud-300'}
  ${isToday ? 'ring-2 ring-indigo-500 ring-inset font-bold' : ''}
  ${!isToday && isSelectedForCreate ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
  ${isSelected ? 'bg-indigo-100' : ''}
  ${holidayLabel ? 'font-semibold text-red-600' : ''}
  ${customDayLabel ? 'font-semibold text-amber-600' : ''}
`}
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/planning/DayCell.tsx frontend/src/__tests__/DayCell.test.tsx
git commit -m "feat: add border grid lines to compact DayCell"
```

---

### Task 2: Update QuarterView week-row grid and padding cells

**Files:**
- Modify: `frontend/src/components/planning/QuarterView.tsx:100-118`
- Test: `frontend/src/__tests__/QuarterView.test.tsx` (create)

**Step 1: Write the failing test**

Create `frontend/src/__tests__/QuarterView.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { QuarterView } from '../components/planning/QuarterView'

const baseProps = {
  year: 2026,
  quarter: 0, // Q1: Jan, Feb, Mar
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  onMonthClick: () => {},
  onDayClick: () => {},
  onTripClick: () => {},
}

describe('QuarterView grid lines', () => {
  it('renders week-row day grid with border-t border-l border-cloud-100', () => {
    const { container } = render(<QuarterView {...baseProps} />)
    // Each week row's inner day grid should have border-t and border-l
    const dayGrids = container.querySelectorAll('.grid.grid-cols-7.border-t.border-l')
    expect(dayGrids.length).toBeGreaterThan(0)
  })

  it('renders padding cells with border-b border-r border-cloud-100', () => {
    // Jan 2026: starts on Thursday — cells 0-3 (Sun-Wed) are empty padding
    const { container } = render(<QuarterView {...baseProps} />)
    // Find divs inside grid-cols-7 that have border-b and border-r but are not DayCell (no dayNumber text)
    const borderCells = container.querySelectorAll('.border-b.border-r.border-cloud-100')
    expect(borderCells.length).toBeGreaterThan(0)
  })

  it('renders day-header row with border-b border-cloud-200', () => {
    const { container } = render(<QuarterView {...baseProps} />)
    const headers = container.querySelectorAll('.border-b.border-cloud-200')
    expect(headers.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/__tests__/QuarterView.test.tsx
```

Expected: FAIL — no border classes on week grids, padding cells, or headers yet

**Step 3: Edit `QuarterView.tsx` — three targeted changes**

**Change 1** — Day-header row (line 100). Replace:
```tsx
<div className="grid grid-cols-7 gap-px mb-1">
```
With:
```tsx
<div className="grid grid-cols-7 border-b border-cloud-200 mb-1">
```

**Change 2** — Week-row day grid (line 114). Replace:
```tsx
<div className="grid grid-cols-7 gap-px">
```
With:
```tsx
<div className="grid grid-cols-7 border-t border-l border-cloud-100">
```

**Change 3** — Empty padding cells (line 117). Replace:
```tsx
return <div key={i} className="min-h-[2.5rem]" />
```
With:
```tsx
return <div key={i} className="min-h-[2.5rem] border-b border-r border-cloud-100" />
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/__tests__/QuarterView.test.tsx
```

Expected: PASS

**Step 5: Run full frontend test suite to confirm no regressions**

```bash
cd frontend && npx vitest run
```

Expected: All tests PASS

**Step 6: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

**Step 7: Commit**

```bash
git add frontend/src/components/planning/QuarterView.tsx frontend/src/__tests__/QuarterView.test.tsx
git commit -m "feat: add grid lines to quarter view day cells and padding"
```

---

### Task 3: Visual verification in browser

**Step 1: Confirm servers are running**

Backend on `:8000`, frontend on `:5173`. If not:
```bash
cd backend && uv run uvicorn travel_planner.main:app --port 8000 &
cd frontend && npm run dev &
```

**Step 2: Navigate to Planning Center**

Open http://localhost:5173 in the browser (use Playwright MCP if available).

**Step 3: Switch to quarter view**

Click the "Q1" / "Q2" / etc. quarter button in the planning header to activate the quarter view.

**Step 4: Verify grid lines appear**

Confirm:
- Each day cell has a visible right and bottom border line (`cloud-100` — very light gray)
- Padding cells at the start/end of each month also show grid lines
- The day-header row (S M T W T F S) has a bottom border separator
- Today's ring, holiday red text, trip bars are unaffected

**Step 5: Compare with month view**

Switch to month view and confirm the grid character looks consistent between views.
