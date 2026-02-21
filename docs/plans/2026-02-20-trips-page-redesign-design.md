# Trips Page Redesign Design

**Date**: 2026-02-20
**Status**: Approved

## Problem

Five UX gaps in the trips page and trip detail page:

1. **TripCard member avatars** show "M1/M2/M3" placeholders — `TripSummary` only returns `member_count`, not member names.
2. **No itinerary status** on the card — can't tell at a glance how planned a trip is.
3. **Trip detail itinerary** renders as isolated cards, not a continuous timeline.
4. **Inline quick-add** exists but is buried inside `ItineraryDayCard` — should be visible in the new layout.
5. **Drag-and-drop** is per-day only — activities can't move between days.

## Fixes

### Fix 1: Real member initials on TripCard

**Backend** — `schemas/trips.py` + `routers/trips.py`:

Add `MemberPreview` schema:
```python
class MemberPreview(BaseModel):
    initials: str   # computed from display_name or email
    color: str      # deterministic hex, hashed from user_id
```

Add to `TripSummary`:
```python
member_previews: list[MemberPreview]   # up to 3
```

The trips list query already joins members. Extend with a subquery that fetches the top 3 members, computes initials (first letter of each word in `display_name`, falling back to first two chars of email local part), and a deterministic color (hash of `user_id` mod palette of 8 colors).

**Frontend** — `TripCard.tsx`:

Replace `getInitials('Member ${i+1}')` loop with `trip.member_previews.map(m => ...)`. Each avatar: colored circle (`style={{ backgroundColor: m.color }}`) with white initials text.

Overflow: show 3 avatars max + grey `+{member_count - 3}` chip when `member_count > 3`. Solo trip (`member_count === 0`): single neutral avatar showing "—".

### Fix 2: Itinerary progress bar on TripCard

**Backend** — add to `TripSummary`:
```python
itinerary_day_count: int        # total days
days_with_activities: int       # days with ≥1 activity
```

Computed via subqueries in the trips list endpoint.

**Frontend** — `TripCard.tsx`:

New slim row below trip name, above footer:
- Label: `{days_with_activities} / {itinerary_day_count} days planned`
- Bar: `w-full h-1 bg-cloud-100 rounded-full` with `bg-indigo-400` fill at `(days_with_activities / itinerary_day_count * 100)%`
- Hidden when `itinerary_day_count === 0`
- "All days planned" label when full

### Fix 3: Timeline itinerary layout

**Frontend** — `TripDetailPage.tsx`:

Replace `<div className="space-y-4">` + `ItineraryDayCard` with a single timeline container:

```
│  ← border-l-2 border-cloud-200 spine
●  Mon Jan 5 · Day 1    [+ Add activity]
│  ActivityItem
│  ActivityItem
│
●  Tue Jan 6 · Day 2    [+ Add activity]
│  (empty drop zone)
```

Structure:
```tsx
<div className="relative ml-4">
  <div className="absolute left-0 top-0 bottom-0 border-l-2 border-cloud-200" />
  {days.map(day => (
    <div key={day.id} className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-cloud-200 border-2 border-white" />
        <span className="ml-6 text-sm font-semibold text-cloud-700">{formatted date}</span>
        <button>+ Add activity</button>
      </div>
      <div className="ml-6">
        {/* SortableContext + activities + empty zone */}
      </div>
    </div>
  ))}
</div>
```

`ItineraryDayCard` is retired. Its inline `ActivityForm` logic moves directly into this section.

### Fix 4: Inline quick-add (preserved in new layout)

Each day header has a `+ Add activity` text button (right-aligned). Clicking it expands an inline `ActivityForm` below that day's activities — same compact form that existed in `ItineraryDayCard`, now inline in the timeline. No modal.

### Fix 5: Cross-day drag-and-drop

**Backend** — `schemas/itinerary.py` + `routers/itinerary.py`:

Add to `UpdateActivity`:
```python
itinerary_day_id: UUID | None = None
```

Handler verifies target day belongs to the same trip (auth check), then updates `activity.itinerary_day_id`.

**Frontend** — `TripDetailPage.tsx` + `useItinerary.ts`:

Single `DndContext` wrapping the entire itinerary section. Per-day `SortableContext` with `items = activity IDs`. `ActivityItem` keeps `useSortable`.

`onDragEnd`:
1. Same container → reorder within day (existing behavior)
2. Different container → `moveActivity(activityId, targetDayId)` mutation:
   - Optimistic update via `onMutate`
   - PATCH `/api/itinerary/activities/{id}` with `{ itinerary_day_id: targetDayId }`
   - `onError` → revert + toast

`DragOverlay`: floating clone of `ActivityItem` during drag (required for cross-container).

`EmptyDayDropZone`: `useDroppable` target in days with no activities — dashed border, highlights on `isOver`.

## Non-Goals

- No changes to MonthView, QuarterView, YearView, or any calendar component
- No changes to checklist, map, or member management
- No drag-to-reorder days (only activities)
- No bulk move / multi-select
- No mobile-specific drag handling (touch events out of scope)
