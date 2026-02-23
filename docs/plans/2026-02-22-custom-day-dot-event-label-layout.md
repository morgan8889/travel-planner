# Custom Day Dot, Event Label & Year View Layout Design

**Date:** 2026-02-22

## Goal

Three focused improvements:
1. Replace the Star icon (month view) and amber-text number (compact views) with a unified amber dot indicator for custom days across all calendar views — with a hover popover showing the event name(s).
2. Show the event name (from notes) instead of destination on event-type trip bars in all views.
3. Fix the year view layout so expanding the right panel doesn't stretch the calendar grid — use whitespace below instead.

---

## Change 1: Unified Amber Dot + Hover Popover

### DayCell prop rename

`customDayLabel: string | undefined` → `customDayName: string | undefined`

Callers previously passed `'custom'` (a meaningless placeholder). They now pass the actual custom day name so the popover can display it.

Callers to update:
- `MonthView.tsx` — already has `customDayMap` (date → name); pass `customDayMap.get(day.date)`
- `QuarterView.tsx` — currently uses a `Set`; change to a `Map<string, string>` (date → name); pass `customDayMap.get(day.date)`
- `YearView.tsx` — currently passes `customDaySet.has(day.date) ? 'custom' : undefined`; change `customDaySet` to `customDayMap` and pass the name

### DayCell full mode (month view)

Replace `<Star className="w-3 h-3 text-amber-500 shrink-0 mt-1" />` with:

```tsx
<div className="relative">
  <div
    className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1 cursor-default"
    onMouseEnter={() => setShowCustomPopover(true)}
    onMouseLeave={() => setShowCustomPopover(false)}
  />
  {showCustomPopover && (
    <div className="absolute bottom-full right-0 mb-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[100px]">
      <div className="font-semibold leading-tight">{customDayName}</div>
      <div className="opacity-70 mt-0.5">{formatShortDate(date)}</div>
    </div>
  )}
</div>
```

`showCustomPopover` is a `useState<boolean>(false)` inside DayCell. `formatShortDate` is a local helper (same pattern as TripSpan).

Remove the `customDayLabel` amber-text treatment (`font-semibold text-amber-600`) from compact mode number styling — the dot replaces this.

### DayCell compact mode (year/quarter cells)

Instead of coloring the number amber, overlay a small amber dot in the bottom-left corner:

```tsx
<div className="relative w-full aspect-square ...">
  {dayNumber}
  {customDayName && (
    <>
      <div
        className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-400"
        onMouseEnter={() => setShowCustomPopover(true)}
        onMouseLeave={() => setShowCustomPopover(false)}
      />
      {showCustomPopover && (
        <div className="absolute bottom-full left-0 mb-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[100px]">
          <div className="font-semibold leading-tight">{customDayName}</div>
          <div className="opacity-70 mt-0.5">{formatShortDate(date)}</div>
        </div>
      )}
    </>
  )}
</div>
```

### Year view month header dot

The existing amber dot next to the month name already has `title={...}` (native browser tooltip). Replace with a proper hover popover:

```tsx
{eventCount > 0 && (
  <div className="relative">
    <span
      className="w-2 h-2 rounded-full bg-amber-400 shrink-0 block cursor-default"
      onMouseEnter={() => setHoveredMonthDot(month)}
      onMouseLeave={() => setHoveredMonthDot(null)}
    />
    {hoveredMonthDot === month && (
      <div className="absolute top-full left-0 mt-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg z-50 pointer-events-none min-w-[120px]">
        {customDaysForYear
          .filter(cd => new Date(cd.resolvedDate + 'T00:00:00').getMonth() === month)
          .map(cd => (
            <div key={cd.id} className="leading-snug">
              <span className="font-semibold">{cd.name}</span>
              <span className="opacity-70 ml-1">{formatShortDate(cd.resolvedDate)}</span>
            </div>
          ))}
      </div>
    )}
  </div>
)}
```

`hoveredMonthDot: number | null` is a `useState` in `YearView`.

---

## Change 2: Event Bar Label — Event Name Instead of Destination

In `TripSpan.tsx`, add a computed display label used for the inline bar text:

```typescript
const displayLabel =
  tripType === 'event' ? (getEventName(notes) ?? destination) : destination
```

Replace `{destination}` with `{displayLabel}` in both render paths:
- `size="medium"` inline label (year view bars)
- `size="full"` bar text (month view bars)

The popover already uses `getEventName` correctly — no popover changes needed.

---

## Change 3: Year View Layout Fix

In `YearView.tsx`, change the outer wrapper from:

```tsx
<div className="flex">
```

to:

```tsx
<div className="flex items-start">
```

`items-start` prevents the calendar grid from stretching vertically to match the panel height. When the panel expands, whitespace appears naturally below the calendar. No gaps between month rows.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/planning/DayCell.tsx` | Rename prop to `customDayName`; replace Star with amber dot; add hover popover state; compact mode corner dot |
| `frontend/src/components/planning/MonthView.tsx` | Pass `customDayMap.get(day.date)` instead of `'custom'` |
| `frontend/src/components/planning/QuarterView.tsx` | Change `customDaySet` (Set) to `customDayMap` (Map); pass name |
| `frontend/src/components/planning/YearView.tsx` | Change `customDaySet` to `customDayMap`; pass name to DayCell; month header dot → hover popover; add `items-start` to outer flex; add `hoveredMonthDot` state |
| `frontend/src/components/planning/TripSpan.tsx` | `displayLabel` for inline bar text on event trips |

No backend changes. No new files.

---

## Non-Goals

- No change to the right panel Events section (custom day hover already implemented)
- No change to holiday indicators
- No click action on custom day dots (view-only)

---

## Testing

- `frontend/src/__tests__/DayCell.test.tsx` — update `customDayLabel` → `customDayName` in all test calls; add test for amber dot in full mode, compact mode corner dot; add hover popover show/hide tests
- `frontend/src/__tests__/TripSpan.test.tsx` — add test: event trip with notes shows event name as bar label, not destination
- `frontend/src/__tests__/YearView.test.tsx` — update prop name; add test for month header dot hover popover
- Manual: verify no gaps in year view when all sections expanded; verify event bars in year/month show race names; verify amber dot hover in all three contexts
