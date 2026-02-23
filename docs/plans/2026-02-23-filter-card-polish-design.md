# Filter & Card Polish Design

**Goal:** Three focused UI improvements to the My Trips page and Dashboard.

---

## 1. Dashboard — Needs Attention: 3 groups by default

Show first 3 trip groups by default. If more than 3 exist, a "Show more (N more)" button appears below. Clicking expands to show all groups. No collapse — once expanded, stays expanded.

**State:** `const [expanded, setExpanded] = useState(false)`
**Slice:** `groups.slice(0, expanded ? groups.length : 3)`
**Button label:** `Show more (${groups.length - 3} more)`

---

## 2. My Trips — Single filter row with teal type pills

Merge the two filter rows into one, with a thin vertical divider between the status group and type group.

```
[ All ] [ Dreaming ] [ Planning ] [ Booked ] [ Active ] [ Completed ]  |  [ All Types ] [ Vacation ] [ Event ] [ Remote Week ] [ Sabbatical ]
```

**Status pills:** indigo (unchanged)
**Type pills:** teal
- Active: `bg-teal-600 text-white shadow-sm ring-2 ring-teal-600/20 ring-offset-1`
- Inactive: `bg-white text-cloud-600 border border-teal-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/50`

**Divider:** `<div className="w-px h-6 bg-cloud-200 self-center mx-1" />`

**Default type selection:** `['vacation', 'remote_week', 'sabbatical']` (was `[]`)

---

## 3. Trip cards — equal height within grid rows

Add `h-full` to the `<Link>` wrapper and `h-full flex flex-col` to the inner `<div>` in `TripCard`. Add `mt-auto` to the bottom row (status badge + member avatars) so it anchors to the card bottom.

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/pages/DashboardPage.tsx` | Add `expanded` state + slice + Show more button in Needs Attention |
| `frontend/src/pages/TripsPage.tsx` | Merge filter rows, teal type pills, default type selection |
| `frontend/src/components/trips/TripCard.tsx` | `h-full flex flex-col` + `mt-auto` on bottom row |
