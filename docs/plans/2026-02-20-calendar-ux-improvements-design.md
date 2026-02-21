# Calendar & Itinerary UX Improvements — Design

**Goal:** Five focused UX improvements across the itinerary timeline, trips list, and planning calendar.

**Architecture:** All changes are purely frontend. No backend schema or API changes required except the multi-filter trips query (handled client-side).

**Tech Stack:** React, @dnd-kit/core, TanStack Query, Tailwind CSS, lucide-react

---

## Feature 1 — DnD drop indicator for days with activities

**Problem:** When dragging an activity over a day that already has activities, the only visual feedback is a faint `bg-indigo-50/50` tint on `DroppableDay`. Empty days have a clearly visible dashed drop zone (`EmptyDayDropZone`). The inconsistency makes cross-day drag-and-drop feel uncertain.

**Solution:** When `isOver` is true on a `DroppableDay` that already contains activities, render a dashed drop zone strip **below the last activity** — identical in style to `EmptyDayDropZone` (`border-2 border-dashed border-indigo-400 bg-indigo-50 h-10 rounded`). It only appears during an active drag-over; otherwise the day looks normal.

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`

**Behaviour:**
- `DroppableDay` receives `isOver` from `useDroppable` (already available)
- Pass `isOver` as a prop (or expose it inline) to conditionally render a `<div>` at the bottom of the activity list matching `EmptyDayDropZone` styling
- Empty days: unchanged — `EmptyDayDropZone` already handles this case

---

## Feature 2 — "+ Add activity" toggles to "Cancel"

**Problem:** When the add-activity form is open and empty, the `+ Add activity` button still shows. There is no obvious way to dismiss the form from the day header.

**Solution:** When `isAdding === true` for a day, replace `<Plus> Add activity` with `<X> Cancel` in the day header button. Clicking it calls `setExpandedDayId(null)` as before. The form's own inline Cancel button remains.

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`

**Behaviour:**
- Import `X` from `lucide-react` (alongside existing `Plus`)
- Conditionally render icon and label based on `isAdding`
- No state change — `setExpandedDayId(isAdding ? null : day.id)` already handles the toggle

---

## Feature 3 — Multi-select status filters on My Trips

**Problem:** Status filter is single-select. Users want to view e.g. "Planning + Booked" trips together.

**Solution:** Change filter state from `TripStatus | undefined` to `TripStatus[]`. Filter trips client-side. Always call `useTrips()` without a status param (fetch all). The "All" pill clears the active set.

**Files:**
- Modify: `frontend/src/pages/TripsPage.tsx`
- Modify: `frontend/src/hooks/useTrips.ts` — `useTrips()` always called without status param (already supports this)

**Behaviour:**
- `statusFilters` array unchanged (same labels/values)
- State: `const [activeStatuses, setActiveStatuses] = useState<TripStatus[]>([])`
- "All" selected when `activeStatuses.length === 0`
- Clicking "All" → clears array
- Clicking a status pill → toggles it in/out of the array
- Active pill style (indigo filled) applies to all pills in the active set
- Filtering: `trips.filter(t => activeStatuses.length === 0 || activeStatuses.includes(t.status))`

---

## Feature 4 — Month view: holiday label stays visible above trip bars

**Problem:** In `MonthView`, the holiday/custom-day label renders below the date number inside `DayCell`. Trip bars are absolutely positioned starting at `top: 2.5rem`, which overlaps the label area.

**Solution:** In `DayCell` (full/month mode), move the holiday/custom-day label to render **on the same line as the date number**, right-aligned. The date circle floats left; the holiday label floats right at the same ~1.75rem height. This keeps labels above the `2.5rem` trip bar baseline.

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`

**Behaviour:**
- Full (non-compact) mode only — compact mode (year/quarter) unchanged
- Replace the current vertical stack (`date circle` then `label below`) with a horizontal row: `date circle` left + `label` right, both in the top area of the cell
- Label: `text-[10px] truncate` right-aligned, red for holidays, amber for custom days
- `min-h` of the cell remains `5rem` — trip bars still stack from `2.5rem`

---

## Feature 5 — Year view: 3-column grid + trip inventory panel

**Problem:** Year view is too dense (4 columns, invisible `h-1.5` bars, no trip identity). As a planning tool, users need to see which trips are which, identify free stretches, and cross-reference against custom days (fitness events).

**Solution:** Split the year view into a **3-column mini-calendar grid** (left ~65%) and a **trip inventory panel** (right, fixed `w-64`).

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/components/planning/TripSpan.tsx` — no change needed (already supports `size="medium"`)

### Mini-calendar grid
- Layout: `grid-cols-3` (was `md:grid-cols-3 lg:grid-cols-4`)
- Trip bars: `size="medium"` (was `size="small"`) — `h-3` with inline destination label
- Holiday / custom day cells: unchanged (compact mode, red/amber number colouring)

### Trip inventory panel (`w-64`, scrollable)
Chronological list of trips whose `start_date` or `end_date` falls within the viewed year.

Each trip row:
```
● [color swatch]  Paris, France
                  Jun 15 – Jun 22 · Planning
```

Gap rows between trips (when gap ≥ 14 days):
```
─── 8 weeks free ───
```
Rendered as muted `text-cloud-400` text between trip rows.

**Custom days section** below trips:
```
Fitness & Events
▸ Ironman Zurich    Jul 14
▸ CrossFit Open     Mar 3
```

**Interaction:**
- Clicking a trip row calls `onTripClick` (same as clicking a bar in the calendar) — opens existing sidebar
- No new state required

### Gap calculation
Sort trips by `start_date`. For each consecutive pair, compute gap in days. If ≥ 14 days, insert a gap row with weeks rounded down.

---

## Testing Notes

- Feature 1: test that `DroppableDay` renders drop hint when `isOver=true` and `dayActs.length > 0`
- Feature 2: test that button label is "Cancel" when form is open, "+ Add activity" when closed
- Feature 3: test multi-select toggle logic; test "All" clears selection; test filtered output
- Feature 4: test that holiday label renders alongside date number (not below)
- Feature 5: test gap calculation; test trip inventory renders correct rows; test empty-year state
