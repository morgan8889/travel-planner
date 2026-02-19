# Planning Center UX Improvements

**Date:** 2026-02-19
**Status:** Approved
**Branch:** TBD

## Problem

The Planning Center year view shows trip bars but no trip names (only native browser tooltip). Quarter view only displays 2 overlapping trips. Holiday labels in compact views show "holiday" instead of actual names. No countries are enabled by default. The trip quick-add form doesn't let you pick an end date.

## Design

### 1. Trip Summary Bar

A horizontal bar rendered between the header and the calendar grid, visible at all zoom levels.

- Status-colored trip chips as clickable pills (e.g. "Paris (Mar 5-12)")
- Uses existing `TRIP_COLORS` palette (purple=dreaming, blue=planning, green=booked, orange=active, gray=completed)
- Clicking a chip opens the trip detail sidebar
- Wraps on multiple lines; shows "+N more" if >8 trips
- New component: `TripSummaryBar.tsx` in `components/planning/`

### 2. Year View: Custom Hover Tooltip

Replace native `title` attribute on trip bars with a custom CSS tooltip:

- Shows destination, date range, duration (e.g. "8 days"), and status
- Absolute-positioned div rendered on hover via React state
- No external tooltip library — CSS + React only

Implementation: Add hover state and tooltip rendering to `TripSpan` compact mode.

### 3. Quarter View: 3 Overlapping Trips

- Increase visible trip limit from 2 to 3 per week row
- Increase week row bottom padding from `pb-3` to `pb-5`
- Overflow "+N" indicator triggers at >3 instead of >2

### 4. Holiday Labels in Compact Views

- Change `holidaySet` from `Set<string>` to `Map<string, string>` (date -> holiday name)
- Pass actual holiday name to `DayCell` instead of literal string "holiday"
- Tooltip shows real name (e.g. "Presidents' Day")
- Quarter view shows truncated label text below day number (more space available)

### 5. Default US Holidays

- Auto-enable US holidays on first load when no countries are enabled
- `useEffect` in `PlanningCenterPage` calls `enableCountry('US')` when `enabledCountries` is empty
- One-time operation — backend persists the selection

### 6. Trip Create: End Date Picker

- Add editable start and end date inputs to `SidebarTripCreate`
- Single day click: start = clicked date, end = start + 7 days
- Drag select: keeps the dragged range
- User can adjust both dates before submitting

### Components Changed

| Component | Change |
|---|---|
| **New:** `TripSummaryBar.tsx` | Status-colored trip chips, clickable |
| `TripSpan.tsx` | Custom hover tooltip with trip details |
| `QuarterView.tsx` | 3-trip limit, holiday name map |
| `YearView.tsx` | Holiday name map |
| `DayCell.tsx` | Real holiday name in tooltip |
| `SidebarTripCreate.tsx` | Editable date inputs, +7 day default |
| `PlanningCenterPage.tsx` | Render TripSummaryBar, auto-enable US |

### No Backend Changes

All data already exists.

### Deferred (YAGNI)

- Trip filtering by status on the calendar
- Trip bar click-to-highlight linking
- Custom day labels in year view
