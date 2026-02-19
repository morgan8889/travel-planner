# Planning Center V2 — Compact Trip Visibility & Interaction Improvements

**Date:** 2026-02-19
**Status:** Approved
**Branch:** feat/planning-center

## Problem

The current Planning Center quarter and year views only highlight days with a flat `bg-indigo-100` background. Users cannot see which trips exist, their names, or their status without drilling down to month view. Clicking any day forces a zoom to month view. There is no map integration in the sidebar.

## Design

### 1. Compact Trip Bars in Quarter/Year Views

Render thin colored bars spanning across day cells in mini-month grids, using CSS Grid positioning (same pattern as MonthView's `TripSpan`).

- **Quarter view:** ~6px tall bars with truncated destination text label
- **Year view:** ~4px tall bars, no text (tooltip on hover only)
- Status-colored using existing `TRIP_COLORS` palette (purple=dreaming, blue=planning, green=booked, orange=active, gray=completed)
- Max 2 visible bars per week row; overflow shows "+N" indicator
- Bars are clickable (opens trip detail in sidebar)

Implementation: Modify `QuarterView.tsx` and `YearView.tsx` to wrap week rows in relative containers and render `TripSpan` with a new `compact` variant prop.

### 2. Click Behavior Changes

Remove auto-zoom-to-month on day click. New behavior:

| Click target | Action | Zoom changes? |
|---|---|---|
| Empty day cell | Open sidebar with trip-create form, start date pre-filled | No |
| Trip bar | Open sidebar with trip detail + map | No |
| Month header text | Navigate to that month in month view | Yes (intentional) |
| Holiday/custom day | Open sidebar with detail | No |

Drag-select remains month-view only (cells too small in compact views).

### 3. Trip Detail Sidebar with Map

Enhance `SidebarTripDetail.tsx` to include a mini Mapbox map:

- ~200px tall static map centered on trip coordinates
- Destination pin using existing `TripMarker` component
- Non-interactive (scrollZoom/dragPan disabled) to prevent accidental interaction
- Hidden when trip has no coordinates
- Layout: trip info (name, status, dates, members) above map, action buttons below

### 4. Multi-Select Holiday Country Dropdown

Replace inline country toggle buttons with a dropdown:

- Trigger button shows selected countries as comma-separated codes with chevron-down
- Popover with checkboxes for all 10 supported countries
- Country order: US first, UK second, then alphabetical by full name
- Clicking checkbox immediately calls enable/disable mutation
- Closes on click-outside or Escape
- New component: `CountrySelect.tsx` in `components/planning/`

### 5. Components Changed

| Component | Change |
|---|---|
| `QuarterView.tsx` | Add trip bar rendering, day click = quick-add, trip click = detail sidebar |
| `YearView.tsx` | Same as QuarterView, smaller bars, tooltip-only labels |
| `DayCell.tsx` | Accept `onDayClick` in compact mode |
| `TripSpan.tsx` | Add `compact` variant prop (4-6px height, optional text) |
| `SidebarTripDetail.tsx` | Add mini Mapbox map section |
| `PlanningCenterPage.tsx` | Update click handlers, remove auto-zoom from day clicks |
| `PlanningHeader.tsx` | Replace inline country buttons with `CountrySelect` |
| **New:** `CountrySelect.tsx` | Multi-select holiday country dropdown |

### 6. No Backend Changes

All data (trips with coordinates, supported countries, enable/disable endpoints) already exists.
