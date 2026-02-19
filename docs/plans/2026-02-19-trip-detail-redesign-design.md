# Trip Detail Page Redesign — Consolidated Inline Editing

**Date:** 2026-02-19
**Status:** Approved
**Branch:** TBD (new feature branch)

## Problem

The current trip detail page uses tabs (Overview, Itinerary, Checklists) requiring multiple clicks to navigate. Itinerary days must be manually created. Activity editing opens modals. Location autocomplete only works on create, not edit (clearing coordinates on any edit). The UX has too many steps for common actions.

## Design

### 1. Two-Panel Layout (Wanderlog-style, mirrored)

Replace the 3-tab layout with a two-panel design:

- **Left (~60%):** Scrollable content column — trip header, day timeline, checklists, danger zone
- **Right (~40%):** Sticky map sidebar with Mapbox GL map (destination + activity markers), members panel, notes panel

**Mobile:** Map collapses to a ~200px banner at top. Content scrolls below.

**Desktop (lg+):** Side-by-side. Map sidebar is `position: sticky` so it stays visible while scrolling the day timeline.

**Trip header:** Destination title, status badge, type badge, date range, member count, edit button. Sits above both panels.

### 2. Auto-Generated + Auto-Synced Itinerary Days

- **First visit:** If trip has dates but zero itinerary days, auto-generate days via `useGenerateDays` mutation in a `useEffect`.
- **Date changes:** When trip dates are edited, compare existing days with new range. Create missing days automatically. For days that fall outside the new range and have activities, show a confirmation before removing. Empty orphaned days are removed silently.
- **No manual "Add Day" button** — days are derived from trip dates.

### 3. Inline Expandable Activity Editing

Replace activity modals with inline expandable cards:

- **Compact row (default):** Drag handle, category icon, title, time range, location. Click anywhere to expand.
- **Expanded form (on click):** All fields editable inline — title, category selector, start/end time, location (with autocomplete), notes, confirmation number. Save/Cancel buttons.
- **Add Activity:** "+" button at the bottom of each day. Click expands an empty inline form (same layout).
- **Delete:** Trash icon visible in both compact and expanded states.
- **Drag-and-drop:** Remains on compact rows via existing `@dnd-kit` integration.
- No modals. `AddActivityModal.tsx` and `EditActivityModal.tsx` are removed.

### 4. Location Autocomplete on All Location Fields

- Reuse existing `LocationAutocomplete` component in the inline activity form for both create and edit
- Editing: pre-populated with current location text. Typing triggers geocode autocomplete (300ms debounce)
- Selecting a suggestion updates location, latitude, longitude
- If user types but doesn't select a suggestion, coordinates are cleared
- If user doesn't touch the location field, existing coordinates are preserved
- Map sidebar updates markers when activities are saved with new coordinates

### 5. Checklists Below Day Timeline

Checklists render in the same scrollable column, below all itinerary days:

- Collapsible checklist cards with progress bar (e.g., "4/7")
- Delete checklist button (with confirmation)
- Delete item button per item
- Add item inline form (existing behavior)
- Toggle checkboxes (existing behavior)
- "New Checklist" button at the bottom

### 6. Backend Additions

Two new endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/trips/{trip_id}/checklists/{checklist_id}` | DELETE | Delete checklist + cascade items |
| `/api/checklists/items/{item_id}` | DELETE | Delete single checklist item |

### 7. Components Changed

| Component | Change |
|---|---|
| `TripDetailPage.tsx` | Remove tabs. Two-panel layout. Auto-generate/sync days. |
| `ItineraryDayCard.tsx` | Inline activity form instead of modal trigger. |
| `ActivityItem.tsx` | Expandable: compact row / inline edit form with LocationAutocomplete. |
| `ChecklistCard.tsx` | Add delete checklist, delete item, progress bar. |
| **Remove:** `AddActivityModal.tsx` | Replaced by inline form |
| **Remove:** `EditActivityModal.tsx` | Replaced by inline form |

### 8. New Frontend Hooks

| Hook | Purpose |
|---|---|
| `useDeleteChecklist(tripId)` | Mutation for deleting a checklist |
| `useDeleteChecklistItem(tripId)` | Mutation for deleting a checklist item |

### 9. Deferred (YAGNI)

- Checklist rename
- Checklist item reordering
- Bidirectional activity-marker linking (click activity highlights marker)
