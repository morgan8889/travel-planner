# Planning Center Tweaks

**Date:** 2026-02-19
**Status:** Approved
**Branch:** feat/planning-center-ux-improvements (continuation)

## Problem

The TripSummaryBar shows all trips regardless of which time period is selected. Quarter view trip bars are too thin to read without hovering. Holiday labels aren't visible in quarter view. Clicking a day to create a trip gives no visual feedback on which day was selected. Year view bars show status colors but not trip type.

## Design

### 1. Period-Filtered Summary Bar

Filter `TripSummaryBar` chips to trips overlapping the current visible period:
- **Month view**: trips overlapping that month
- **Quarter view**: trips overlapping that quarter
- **Year view**: all trips for the year

Add a compact stats line below the chips: `"3 trips | 2 holidays | 1 event"` in `text-cloud-500 text-xs`.

New props on `TripSummaryBar`: `zoomLevel`, `currentMonth`, `currentYear`, `holidays`, `customDays`.

### 2. Taller Quarter View Bars with Inline Text

Replace the current thin `h-1.5` bars in quarter view with `h-3` bars that have destination text rendered inside (truncated). Remove the separate label span below the bar.

New `size` prop on `TripSpan`: `"small"` (h-1.5, year view), `"medium"` (h-3, quarter view), `"full"` (h-5, month view). Replaces the boolean `compact` + `showLabel` combo.

Increase week row padding from `pb-5` to `pb-6` to accommodate taller stacked bars.

### 3. Holiday Labels in Quarter View

Quarter view DayCell already receives real holiday names via `holidayMap`. Currently compact mode only shows colored day numbers with title tooltips. Change compact DayCell to also render a truncated label below the number when in quarter view (not year view).

New `showLabel` prop on DayCell compact mode: `true` for quarter view, `false` (default) for year view.

### 4. Selected Day Visual Indicator

When a day is clicked to add a trip, highlight that day cell with an indigo ring.

- `PlanningCenterPage` derives `selectedDate` from `sidebarContent` when type is `trip-create`
- Pass `selectedDate` to QuarterView, YearView, MonthView
- DayCell receives `isSelectedForCreate` boolean — renders `ring-2 ring-indigo-500 bg-indigo-50` styling

### 5. Year View Trip Type Colors

Replace status-based coloring with type-based coloring on year view trip bars only:
- `vacation`: blue (`bg-blue-200 text-blue-800`)
- `remote_week`: teal (`bg-teal-200 text-teal-800`)
- `sabbatical`: amber (`bg-amber-200 text-amber-800`)

Quarter and month views keep status-based coloring.

New `colorBy` prop on TripSpan: `"status"` (default) or `"type"`. When `"type"`, requires a `tripType` prop.

Hover tooltip shows both status and type regardless of `colorBy`.

### Components Changed

| Component | Change |
|---|---|
| `TripSummaryBar.tsx` | Period filter props, stats line |
| `TripSpan.tsx` | `size` prop (small/medium/full), `colorBy` prop, `tripType` prop |
| `DayCell.tsx` | `isSelectedForCreate` styling, `showLabel` for compact mode |
| `QuarterView.tsx` | Pass `size="medium"`, `showLabel` on DayCell, `selectedDate` |
| `YearView.tsx` | Pass `colorBy="type"`, `selectedDate` |
| `MonthView.tsx` | Pass `selectedDate` (for highlight on selected day) |
| `PlanningCenterPage.tsx` | Derive selectedDate, pass filter props to summary bar |

### No Backend Changes

All data already exists.
