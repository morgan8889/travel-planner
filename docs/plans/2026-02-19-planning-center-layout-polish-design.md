# Planning Center Layout & Interaction Polish

**Date:** 2026-02-19
**Status:** Approved
**Branch:** feat/planning-center-ux-improvements (continuation)

## Problem

Month view trip bars overflow and overlap when multiple trips exist in a week. Quarter view has the same issue. Clicking a holiday day has no special behavior. Summary bar stats are stacked below chips instead of inline. The "+N more" overflow label is not interactive.

## Design

### 1. Month View — Dynamic Row Height

Current `min-h-[5rem]` is fixed. Trip bars use `top: 2.5 + stackIndex * 1.5rem` and overflow.

- Calculate trip count per week row
- Cap visible bars at 3 per row, show "+N more" indicator for overflow
- Add dynamic padding-bottom to week row: base padding + `(min(tripCount, 3) * 1.5rem)`
- This ensures bars stay within the row container

### 2. Quarter View — Dynamic Row Padding

Current `pb-6` is fixed. With 3 stacked bars at `bottom: 2 + stackIndex * 5px`, they can still overlap day cells.

- Compute dynamic pb based on actual trip count per week (capped at 3)
- When 0 trips: `pb-1`, 1 trip: `pb-4`, 2 trips: `pb-5`, 3 trips: `pb-6`

### 3. Holiday Click Opens Sidebar

Add `onHolidayClick` callback prop to DayCell. When a day with a holiday is clicked:
- If `holidayLabel` exists and `onHolidayClick` is provided, call `onHolidayClick(date)` instead of `onClick(date)`
- PlanningCenterPage adds `handleHolidayClick` that looks up the holiday name and country from `allHolidays` and opens `SidebarHolidayDetail`
- Pass `onHolidayClick` through MonthView, QuarterView, YearView to DayCell

### 4. Summary Bar — Right-Aligned Stats, Clickable Overflow

Change from stacked layout to single flex row with `justify-between`:
- Left: trip chips + clickable "+N more" button
- Right: stats text (`3 trips | 1 holiday | 2 events`) in `text-cloud-500`

"+N more" becomes a toggle button:
- Clicking it expands to show all filtered trips (no slice limit)
- Text changes to "Show less" when expanded
- `useState(false)` for expanded state, reset when period changes

### Components Changed

| Component | Change |
|---|---|
| `MonthView.tsx` | Dynamic row padding, cap 3 bars + overflow, `onHolidayClick` prop |
| `QuarterView.tsx` | Dynamic pb per week, `onHolidayClick` prop |
| `YearView.tsx` | `onHolidayClick` prop passthrough |
| `DayCell.tsx` | `onHolidayClick` prop, route clicks when holiday exists |
| `TripSummaryBar.tsx` | Flex row layout, right-aligned stats, clickable "+N more" |
| `PlanningCenterPage.tsx` | `handleHolidayClick` callback, pass to all views |

### No Backend Changes

All data already exists.
