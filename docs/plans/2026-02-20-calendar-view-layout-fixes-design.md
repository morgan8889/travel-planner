# Calendar View Layout Fixes Design

**Date**: 2026-02-20
**Status**: Approved

## Problem

Three layout bugs found in visual QA of the calendar views:

### 1. Quarter view — 3rd trip bar clips into day grid
`paddingBottom: '36px'` is too small for 3 stacked `h-3` (12px) bars. Bar 2 occupies 30–42px from the bottom of the week container, but the zone is only 36px — the top 6px clips into the day cell grid.

### 2. Year view — incomplete grid borders
Week container uses `gap-px` instead of the collapsed border pattern. Padding cells (`<div className="aspect-square" />`) have no border classes. This leaves gaps where cells don't have right/bottom borders, breaking the grid appearance.

### 3. Year view — trip bars appear "below" the day row
Week container is `<div className="relative pb-2">` with bars at `bottom: 2px` (inside only 8px of padding). The bars visually appear to float in the row below, not associated with their week.

## Fixes

### Fix 1: Quarter view padding increase

**File**: `frontend/src/components/planning/QuarterView.tsx`

Change `paddingBottom: '36px'` → `paddingBottom: '48px'` on the week container.

Math: 3 × 12px bars + 2 × 2px gaps + 2px bottom margin = 42px minimum. 48px gives a comfortable 6px breathing margin.

The existing `+{weekTrips.length - 3}` overflow indicator is already correct — it positions at `bottom: 0` of the container, which works fine with the larger padding.

### Fix 2: Year view border collapse

**File**: `frontend/src/components/planning/YearView.tsx`

Apply the same collapsed border pattern already used in QuarterView:

| Element | Before | After |
|---|---|---|
| Grid div | `grid grid-cols-7 gap-px` | `grid grid-cols-7 border-t border-l border-cloud-100` |
| Padding cell | `<div className="aspect-square" />` | `<div className="aspect-square border-b border-r border-cloud-100" />` |

DayCell compact mode already emits `border-b border-r border-cloud-100` — no change needed there.

### Fix 3: Year view trip bars — dedicated strip

**File**: `frontend/src/components/planning/YearView.tsx` and `frontend/src/components/planning/TripSpan.tsx`

Replace the `relative pb-2` padding approach with a `flex flex-col` layout + dedicated `h-4` (16px) strip below the day grid:

```
┌──┬──┬──┬──┬──┬──┬──┐
│1 │2 │3 │4 │5 │6 │7 │  ← aspect-square day cells (grid with border-t border-l)
├──┴──┴──┴──┴──┴──┴──┤
│████ bar 0 ████     │  ← dedicated h-4 strip (16px)
│████ bar 1 ████     │    up to 2 stacked h-1.5 (6px) bars
└────────────────────┘
```

Week container: `relative pb-2` → `flex flex-col`

After the grid, a new `<div className="relative h-4">` holds the TripSpan elements.

TripSpan offset for `size="small"`: `stackIndex * 4` → `stackIndex * 8`

Math: strip=16px, bar=6px, margin=2px:
- Bar 0: bottom:2px → top:8px, occupies [8, 14] ✅
- Bar 1: bottom:10px → top:0px, occupies [0, 6] ✅
- 2px gap between bars ✅

`size="medium"` (quarter view) offset unchanged: `stackIndex * 14`.

## Non-Goals

- No changes to MonthView, DayCell, or any other component
- No changes to click handlers, trip colors, or today ring styling
- No changes to the "+N more" overflow indicator logic
