# Calendar & DnD Improvements — Design

**Goal:** Four focused UX improvements: event icons in the calendar grid, a graceful overflow indicator, year-view inventory highlight-on-grid, and a fluid itinerary drag-and-drop with precise drop zones.

**Architecture:** All changes are purely frontend. No backend schema changes required; `moveActivity` will pass computed `sort_order` (float midpoint) which the existing endpoint already accepts.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react, @dnd-kit/core, @dnd-kit/sortable

---

## Feature 1 — Event icon in day cell

**Problem:** Custom days (fitness events, personal milestones) are only visible as an amber-coloured date number in compact/full mode. There is no distinct visual indicator in the day cell that draws the eye when scanning the month grid.

**Solution:** In `DayCell` full (month) mode, when `customDayLabel` is present, render a small `Star` icon (`w-3 h-3`, `text-amber-500`) in the top-right area of the day cell, alongside the date number in the existing `flex items-start justify-between` row. The icon replaces the current amber label text in full mode (the label still appears in compact mode via the coloured number). Holiday labels remain as red text — unchanged.

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`

**Behaviour:**
- Import `Star` from `lucide-react`
- In the full mode return, when `customDayLabel` is truthy: render `<Star className="w-3 h-3 text-amber-500 shrink-0 mt-1" />` as the right-side element in the flex row (replacing the current amber `<span>` text)
- When both `holidayLabel` and `customDayLabel` exist: holiday label (red text) takes the right slot; the star icon is omitted (holiday takes precedence visually)
- Compact mode: unchanged

---

## Feature 2 — Graceful overflow indicator in MonthView

**Problem:** When more than 3 trips overlap a week row, the current `+N more` indicator is a plain unstyled `text-cloud-500` span — easy to miss.

**Solution:** Replace the plain span with a styled pill: `bg-cloud-100 text-cloud-500 text-[10px] font-medium px-1.5 py-0.5 rounded-full`. Position it bottom-right of the week row. Trip bars remain capped at 3. Custom day icons (Feature 1) are in the day cell and do not count against the 3-bar trip limit.

**Files:**
- Modify: `frontend/src/components/planning/MonthView.tsx`

**Behaviour:**
- Replace `<span className="absolute right-1 text-[10px] text-cloud-500" style={{ bottom: '2px' }}>` with a `<span className="absolute right-1 bottom-0.5 bg-cloud-100 text-cloud-500 text-[10px] font-medium px-1.5 py-0.5 rounded-full">`
- Label stays `+{weekTrips.length - 3} more`

---

## Feature 3 — Year view: inventory click highlights on grid

**Problem:** Clicking a trip or event in the year-view inventory panel opens the `PlanSidebar`, pulling focus away from the grid. The year view is a spatial planning tool — users want to see where on the calendar the trip falls, not read its detail panel.

**Solution:** Inventory panel clicks set a `highlightedTripId` state local to `YearView`. The component scrolls the relevant month heading into view and applies a glow animation to all `TripSpan` bars for that trip. The sidebar is not opened. Grid bar clicks continue to open the sidebar as before.

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/components/planning/TripSpan.tsx`

**Behaviour:**

*`YearView` changes:*
- Add `const [highlightedTripId, setHighlightedTripId] = useState<string | null>(null)`
- Attach a `ref` to each month container div (keyed by month index) for scrolling
- Inventory panel trip button `onClick`: call `setHighlightedTripId(trip.id)`, then `monthRefs.current[monthIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` where `monthIndex` is the 0-indexed month of `trip.start_date`
- Clicking the same trip again clears the highlight (`setHighlightedTripId(null)`)
- Pass `isHighlighted={trip.id === highlightedTripId}` to each `TripSpan`

*`TripSpan` changes:*
- Add optional `isHighlighted?: boolean` prop
- When `isHighlighted` is true: add `ring-2 ring-indigo-500 ring-offset-1 animate-pulse` classes
- Use a one-shot animation: after the component mounts with `isHighlighted=true`, remove `animate-pulse` after 1 second via a `useEffect` + `setTimeout` (the ring stays; only the pulse fades)

*Interaction rules:*
- Clicking a trip bar in the grid itself still calls `onTripClick` → sidebar (unchanged)
- Clicking outside the inventory panel does not clear the highlight (user must click same trip row again)
- Custom day rows in the inventory panel: no highlight behaviour (they have no corresponding bar to highlight); clicking them does nothing new

---

## Feature 4 — Itinerary DnD: precise drop zones + glitch fixes

**Problem:** Three issues with the current drag-and-drop:
1. **Flicker**: the dragged item shows at 50% opacity alongside the `DragOverlay` card
2. **Position jump**: `CSS.Transform.toString` applies scale/skew transforms that cause a snap-back visual on drop
3. **Imprecise drop**: dropping onto a day with activities always appends to the end; there is no before/after indicator

**Solution (Option C — pointer-based insertion tracking):**

### Fix 1 — Opacity + transform

In `ActivityItem.tsx`:
- Change `opacity: isDragging ? 0.5 : 1` → `opacity: isDragging ? 0 : 1`
- Change `CSS.Transform.toString(transform)` → `CSS.Translate.toString(transform)`

### Fix 2 — Between-item drop indicator

Add `insertionPoint: { dayId: string; beforeActivityId: string | null } | null` state to `ItineraryTimeline`.

During `onDragOver`:
- Identify the `over` item: if it's an `ActivityItem`, use pointer Y vs item midpoint to decide `beforeActivityId` (the hovered item) or `null` (append after)
- If `over` is a `DroppableDay` or `EmptyDayDropZone`, set `insertionPoint = { dayId, beforeActivityId: null }`
- Update state each time `onDragOver` fires

In the render, between each pair of `ActivityItem` components, conditionally render a `<div className="h-0.5 bg-indigo-400 rounded mx-1 my-0.5" />` when `insertionPoint?.beforeActivityId` matches the next activity's id. A trailing indicator renders after the last item when `insertionPoint?.beforeActivityId === null` for that day.

Clear `insertionPoint` in `onDragEnd` and `onDragCancel`.

### Fix 3 — Precise cross-day insertion

`handleDragEnd` reads `insertionPoint` to compute `sort_order`:
- Get target day's activities sorted by `sort_order`
- If `beforeActivityId` is null: `sort_order = lastActivity.sort_order + 1`
- If `beforeActivityId` matches activity at index `i`: `sort_order = (activities[i-1]?.sort_order ?? activities[i].sort_order - 1 + activities[i].sort_order) / 2`
- Call `moveActivity.mutate({ activityId, targetDayId, sort_order })` for cross-day
- Call `reorderActivities.mutate` for within-day (existing logic, refined to use insertion point index)

**Backend note:** `moveActivity` PATCH endpoint already accepts `sort_order`. No schema change needed — only the frontend call passes the computed value.

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`
- Modify: `frontend/src/components/itinerary/ActivityItem.tsx`

---

## Testing Notes

- Feature 1: DayCell renders `Star` icon when `customDayLabel` present in full mode; not in compact mode
- Feature 2: `+N more` pill has `rounded-full` and `bg-cloud-100` classes
- Feature 3: clicking inventory trip sets `highlightedTripId`; `TripSpan` receives `isHighlighted=true`; clicking again clears
- Feature 4: dragging item has `opacity: 0`; insertion indicator renders between correct items; `onDragEnd` calls mutation with correct `sort_order`
