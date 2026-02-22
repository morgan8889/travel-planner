# Calendar Event Enhancements Design

**Date:** 2026-02-22

## Goal

Improve the visual treatment and interactivity of event-type trips across all calendar views (month, quarter, year), and enhance the year view's right-hand summary panel with clickable items, holidays, and graceful overflow.

---

## Problems Being Solved

1. **Event badges have no distinct color** — `event` type trips fall back to planning-status blue in `TripSpan` because `TYPE_COLORS` has no `event` entry
2. **Badge hover is a basic tooltip** — month view uses a native `title=` attribute; quarter/year views show a plain dark tooltip div. Neither is rich enough or works on click
3. **Year view right panel: trips don't open sidebar** — clicking a trip only highlights/scrolls the calendar; it does not open `SidebarTripDetail`
4. **Year view right panel: events are not clickable** — custom day / event items are `<div>` with no handler
5. **Year view right panel: no holidays** — the holidays section is absent entirely
6. **Year view right panel: overflow is uncontrolled** — when trips + events + holidays fill more than the screen, the panel overflows without constraint

---

## Scope (Option A — Targeted Enrichment)

### 1. TripSpan — event color

Add `event` to `TYPE_COLORS` in `TripSpan.tsx`:

```typescript
event: 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300',
```

### 2. TripSpan — rich popover card (all sizes)

Replace the existing tooltip mechanisms with a single rich popover card:

- **Trigger:** `onMouseEnter` / `onMouseLeave` (hover). The card also persists while the button has focus (keyboard accessible)
- **Dismissal:** `onMouseLeave` hides it
- **Click:** unchanged — still calls `onClick` → opens sidebar

**Popover card content:**

| Field | Event trips (`type === 'event'`) | Other trips |
|-------|----------------------------------|-------------|
| Primary label | `notes` (first ~60 chars, stripped of " — ..." suffix) | `destination` |
| Sub-label | Single formatted date (e.g. "Jan 18") if same-day; date range if multi-day | Date range |
| Badge | "Event" pill (emerald) | Type pill (existing color) |

**Positioning:** `bottom-full` + `left-0`, capped with `max-w-[200px]`, `z-50`. For badges near the top of the grid (small `stackIndex`), the card appears below instead (flip logic).

**Size-specific notes:**

- `size='small'` (year view — `h-1.5` bars): popover only (no inline text possible at 6px)
- `size='medium'` (quarter + year week strips — `h-3` bars): popover replaces tooltip; destination/event name still truncated inline as now
- `size='full'` (month view — `h-5` bars): popover replaces `title=` attribute; destination name still inline

**New props added to `TripSpan`:**

```typescript
notes?: string | null        // for event name extraction
tripType?: TripType          // already exists, used in popover badge
```

Month view currently does not pass `colorBy`, `tripType`, `startDate`, `endDate`, or `notes` — all will be added to `MonthView`'s `TripSpan` calls. Quarter view already passes `startDate`/`endDate` but not `tripType`/`colorBy`/`notes` — those will be added.

### 3. Year view right-hand panel — trips open sidebar

`YearView` currently exposes `onTripClick` but the inventory panel uses `handleInventoryTripClick` which only highlights + scrolls. Change: call **both** — highlight/scroll AND `onTripClick(trip)` — so the sidebar opens as well.

### 4. Year view right-hand panel — events are clickable

The custom days / events section renders `<div>` items with no handler. Since events in this context are trips with `type === 'event'`, look up the matching `TripSummary` from `trips` prop and call `onTripClick(trip)` on click. If no matching trip is found (pure custom day, not a trip), clicking is a no-op (div stays non-interactive).

**Note:** "Events" in the right panel currently means `customDays` (user-defined calendar markers). Trip-type events (races etc.) appear in the "Trips" section above. The existing events section stays as-is for custom days; the trips section already includes event-type trips via `buildInventory`. So the main change is: trip-type events in the trips list get the sidebar link (covered by change #3 above). Custom days remain non-linkable (they have no trip detail page).

### 5. Year view right-hand panel — Holidays section

Add a "Holidays" section below "Events", showing all holidays for the year from the `holidays` prop. `YearView` already receives `holidays: HolidayEntry[]`.

Each item:
- Red dot indicator
- Holiday name
- Formatted date
- Clickable → calls `onHolidayClick(holiday.date)` → opens existing `SidebarHolidayDetail`

`YearView` already has `onHolidayClick` prop. ✓

### 6. Year view right-hand panel — constrained height + graceful overflow

The right panel `div` gets:

```
style={{ maxHeight: calendarGridHeight }}
```

where `calendarGridHeight` is measured via a `ref` on the calendar grid's container div, kept in sync with a `ResizeObserver`. The panel uses `overflow-y-auto` (already set). This ensures the panel never extends beyond the grid regardless of how many trips/events/holidays are listed.

As a simpler fallback (no ResizeObserver complexity): set `max-h-[calc(100vh-12rem)]` — sufficient for most cases since the year grid fills most of the viewport height.

**Decision:** Use the CSS fallback (`max-h`) to avoid ResizeObserver complexity. If the panel needs pixel-perfect alignment in future, the ResizeObserver approach can be added then.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/planning/TripSpan.tsx` | Add `event` color; replace tooltip with popover card; add `notes` prop |
| `frontend/src/components/planning/MonthView.tsx` | Pass `colorBy`, `tripType`, `startDate`, `endDate`, `notes` to `TripSpan` |
| `frontend/src/components/planning/QuarterView.tsx` | Pass `colorBy`, `tripType`, `notes` to `TripSpan` |
| `frontend/src/components/planning/YearView.tsx` | Wire inventory trips to open sidebar; add Holidays section; constrain panel height |

No new components. No backend changes.

---

## Non-Goals

- `TripSummaryBar` (horizontal bar above calendar) — already has expand/collapse; no change
- Custom days (non-trip events) clicking to a detail page — they have no trip detail
- Month/quarter view right-hand panel — only year view has one

---

## Testing

- `frontend/src/__tests__/TripSpan.test.tsx` — add tests for event color and popover card content
- `frontend/src/__tests__/YearView.test.tsx` — add test that inventory trip click calls `onTripClick`
- Manual: seed data → verify emerald event bars in all 3 views, popover shows event name, right panel has clickable trips + holidays
