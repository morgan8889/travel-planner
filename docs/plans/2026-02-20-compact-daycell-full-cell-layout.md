# Compact DayCell Full-Cell Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the compact DayCell so its border spans the full grid cell rather than appearing as a small box around the date number.

**Architecture:** Single change to `DayCell.tsx` compact mode className: remove `rounded-sm`, switch from `items-center justify-center` to `items-start p-1`, and add `h-full` to the `showLabel` branch so the cell stretches to fill the grid row height. The `aspect-square` branch (year view) is left unchanged.

**Tech Stack:** React, Tailwind CSS, Vitest + Testing Library

---

### Task 1: Fix compact DayCell layout

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx:41`
- Modify: `frontend/src/__tests__/DayCell.test.tsx`

---

**Step 1: Update the existing test to assert the new layout**

The test file at `frontend/src/__tests__/DayCell.test.tsx` has test 1 (`renders border classes for grid lines`) and test 2 (`compact mode renders compact-sized cell, not full-height`).

Update test 1 to also assert the new layout classes and the absence of `rounded-sm`. Replace test 1's body with:

```tsx
it('renders border classes and full-cell layout in compact mode', () => {
  const { container } = render(
    <DayCell
      date="2026-03-15"
      dayNumber={15}
      isToday={false}
      isCurrentMonth={true}
      isSelected={false}
      compact={true}
      showLabel={true}
    />
  )
  const cell = container.firstChild as HTMLElement
  expect(cell.className).toContain('border-b')
  expect(cell.className).toContain('border-r')
  expect(cell.className).toContain('border-cloud-100')
  expect(cell.className).toContain('h-full')
  expect(cell.className).toContain('items-start')
  expect(cell.className).not.toContain('rounded-sm')
  expect(cell.className).not.toContain('items-center')
})
```

Test 2 stays as-is (it already tests `min-h-[2.5rem]` vs `min-h-[5rem]`).

**Step 2: Run test to verify it fails**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: FAIL — `h-full` and `items-start` not present, `rounded-sm` still present

**Step 3: Edit `DayCell.tsx` compact mode className (line 41)**

Current line 41:
```tsx
className={`w-full ${showLabel ? 'min-h-[2.5rem]' : 'aspect-square'} border-b border-r border-cloud-100 flex flex-col items-center justify-center text-xs rounded-sm cursor-pointer
```

Replace with:
```tsx
className={`w-full ${showLabel ? 'h-full min-h-[2.5rem]' : 'aspect-square'} border-b border-r border-cloud-100 flex flex-col items-start p-1 text-xs cursor-pointer
```

Key changes:
- `showLabel ? 'min-h-[2.5rem]'` → `showLabel ? 'h-full min-h-[2.5rem]'` (adds `h-full` to showLabel branch only, leaving `aspect-square` branch untouched for year view)
- `items-center justify-center` → `items-start p-1`
- `rounded-sm` removed entirely

**Step 4: Run DayCell tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: PASS (both tests)

**Step 5: Run full test suite**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: All tests pass

**Step 6: Type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 7: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/DayCell.tsx frontend/src/__tests__/DayCell.test.tsx && git commit -m "fix: compact DayCell borders span full grid cell"
```
