# Year View Right Panel Redesign

**Date:** 2026-02-22

## Goal

Redesign the year view right-hand summary panel to: eliminate scrollbars via per-section show-more/less collapse, merge event-type trips into the Events section alongside custom days, add hover popovers to custom day items, and change the event bar color from emerald to rose for instant at-a-glance recognition.

---

## Problems Being Solved

1. **Panel has a scrollbar** — `overflow-y-auto max-h-[calc(100vh_-_12rem)]` produces a scrollbar widget. Users want no scrollbar; the panel should grow with content when expanded, not scroll internally.
2. **Event-type trips appear under Trips** — trips with `type === 'event'` are listed alongside vacation/remote_week/sabbatical trips, making it hard to see all events at a glance.
3. **Custom days have no hover interaction** — the amber dot and name in the right panel are a plain `<div>` with no tooltip or popover.
4. **Event bars are emerald** — similar lightness to other types; not immediately distinguishable at a glance across the full year grid.
5. **Right panel has no collapse** — when there are many trips, events, or holidays, the panel grows unbounded.

---

## Design

### 1. Remove overflow constraints from right panel

Remove `overflow-y-auto` and `max-h-[calc(100vh_-_12rem)]` from the right panel `div`. The panel becomes a plain div with no overflow properties. Collapsed state fits within typical calendar height. Expanding a section lets the panel (and the page) grow naturally — no scrollbar on the panel itself.

### 2. Per-section show more / show less

Each section tracks its own `expanded` boolean in local `useState`. Default counts:

| Section | Default visible | Collapsed label |
|---------|----------------|-----------------|
| Trips | 5 | "+ N more" |
| Events | 5 | "+ N more" |
| Holidays | 0 | "Show N holidays" |

When `expanded`, all items in that section are shown. A "Show less" link collapses back to the default. If a section has ≤ default items, no show-more button appears.

Show-more button style: `text-[10px] text-indigo-500 hover:text-indigo-700 py-1 text-left`.

### 3. Events section — merged date-sorted list

**Trips section** shows only trips with `type !== 'event'` (vacation, remote_week, sabbatical). The existing gap indicator logic stays, applied only to this filtered list.

**Events section** shows a merged, date-sorted list of:
- Event-type trips (`type === 'event'`): rose dot (`bg-rose-400`), click opens sidebar via existing `handleInventoryTripClick`
- Custom days: amber dot (`bg-amber-400`), hover popover (name + date), no click

Merged list is sorted by date (trips by `start_date`, custom days by `resolvedDate`).

```typescript
type EventItem =
  | { kind: 'trip'; trip: TripSummary; date: string }
  | { kind: 'custom'; cd: CustomDay & { resolvedDate: string }; date: string }
```

The Events section heading "Events" stays. The section renders when either event trips or custom days exist for the year.

### 4. Custom day hover popover

Custom day items in the Events section get `position: relative` wrapper with `onMouseEnter`/`onMouseLeave` on the outer row element. When `hovered`, a small dark popover card appears (`absolute bottom-full left-0`) showing:
- Event name (bold, 11px)
- Formatted date (e.g. "Mar 15"), 10px, opacity-70

Same visual style as `TripPopover` in `TripSpan.tsx`:
```
bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none
```

Each custom day item manages its own `hoveredId` via a single `useState<string | null>` in the component (keyed by `cd.id`).

### 5. Event bar color — emerald → rose

In `frontend/src/components/planning/TripSpan.tsx`, change `TYPE_COLORS.event`:

```typescript
// Before
event: 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300',

// After
event: 'bg-rose-300 text-rose-900 hover:bg-rose-400',
```

The rose dot in the Events panel section also uses `bg-rose-400` to match.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/planning/YearView.tsx` | Remove overflow; add per-section show-more; split Trips/Events; merge event trips + custom days; custom day hover popover; rose dot for event trips |
| `frontend/src/components/planning/TripSpan.tsx` | Change `event` color from emerald to rose |

No new files. No backend changes.

---

## Non-Goals

- Custom day click-to-detail (custom days have no trip detail page)
- Changing the amber dot on month headers in the mini grid
- Changing the holiday dot color

---

## Testing

- `frontend/src/__tests__/YearView.test.tsx` — update tests for: event trips appearing in Events section (not Trips), show-more behavior, custom day hover popover
- `frontend/src/__tests__/TripSpan.test.tsx` — update color assertion from emerald to rose
- Manual: seed data → verify rose event bars, Events section has races + custom days merged, Trips section has only vacation/remote/sabbatical, holidays collapsed, hover on custom day shows popover
