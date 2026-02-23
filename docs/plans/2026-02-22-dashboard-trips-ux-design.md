# Dashboard & Trips Page UX Redesign

**Goal:** Improve the dashboard to focus on what's coming up soon, structure Needs Attention by trip, add restaurant reminders, and add a type filter to the My Trips page.

**Scope:** Frontend-only changes except for one backend addition (restaurant counts in `TripSummary`).

---

## 1. My Trips Page — Type Filter

A second row of type filter pills appears below the existing status filter row.

**Pills:** All Types | Vacation | Event | Remote Week | Sabbatical

**Behaviour:**
- Multi-select toggle, identical to status pills
- Default: All Types selected (no type restriction)
- AND logic: status filter AND type filter both apply simultaneously
- "All Types" clears the type selection (show all types)
- The type row is always visible regardless of what trip types exist

**Layout:**
```
[ All ] [ Dreaming ] [ Planning ] [ Booked ] [ Active ] [ Completed ]
[ All Types ] [ Vacation ] [ Event ] [ Remote Week ] [ Sabbatical ]
```

---

## 2. Dashboard — Map as Hero

### Map Focus
- Map shows **only trips in the next 90 days** with status `planning`, `booked`, or `active`
- Bounds/zoom computed from those trips only
- Fallback: if no trips in that window, show all non-completed trips
- Map height: `h-80` on mobile, `h-[440px]` on desktop (taller than current)

### "Next Up" Overlay Card
A floating card in the bottom-left corner of the map shows the soonest upcoming trip:

```
┌─────────────────────────┐
│  ✈ Japan · Tokyo        │
│  Mar 15 – Mar 28        │
│  in 47 days  [Booked]   │
└─────────────────────────┘
```

- Clicking the card navigates to that trip's detail page
- Hidden if there are no upcoming trips at all
- Uses `absolute bottom-4 left-4` positioning inside the map container

---

## 3. Dashboard — Upcoming Trips Panel

**Shows:** Next 5 non-completed trips sorted by start date (soonest first)

**"View all →"** link in the panel header navigates to `/trips`

**Layout:** Compact list rows (not the full TripCard grid), each row shows:
- Trip name (or event name for event-type trips)
- Start date + countdown ("in 47 days", "tomorrow", "today")
- Status badge

---

## 4. Dashboard — Needs Attention Panel

### Structure: Grouped by Trip

Each upcoming trip with action items gets its own section. Trips are sorted soonest-first. **No item cap** — show everything. If a trip has nothing to action, it does not appear.

```
┌─ Japan · Mar 15  (in 47 days)   View trip → ──────────┐
│  ✈  2 flights not confirmed                    →       │
│  🍽  3 restaurant bookings to confirm          →       │
│  📅  4 days not planned                        →       │
└────────────────────────────────────────────────────────┘

┌─ BWR San Diego · Apr 6  (in 69 days)  View trip → ────┐
│  🏨  1 hotel not confirmed                     →       │
└────────────────────────────────────────────────────────┘

✅  All caught up  (shown when no trips have action items)
```

**Trip section header:** trip name + date + countdown + "View trip →" link to `/trips/$tripId`

**Each action row** links to `/trips/$tripId` (the trip's detail page)

### Action Item Types
| Icon | Condition | Label |
|------|-----------|-------|
| Plane | `transport_total - transport_confirmed > 0` | `N flight(s) not confirmed` |
| Hotel | `lodging_total - lodging_confirmed > 0` | `N hotel(s) not confirmed` |
| UtensilsCrossed | `restaurant_total - restaurant_confirmed > 0` | `N restaurant booking(s) to confirm` |
| Calendar | `itinerary_day_count - days_with_activities > 0` | `N day(s) not planned` |

### Restaurant Logic
- A `food` category activity **without** a `confirmation_number` counts as unconfirmed
- Requires adding `restaurant_total` and `restaurant_confirmed` to `TripSummary` (backend)
- Same count query pattern as transport/lodging

---

## 5. Dashboard — Quick Links Removed

The "New Trip" and "View Calendar" quick link buttons at the bottom of the dashboard are removed. Navigation is sufficiently covered by the top nav and existing page links.

---

## Backend Change Required

**`TripSummary` schema** (both Python model + Pydantic schema + frontend type):

Add two new optional integer fields:
```python
restaurant_total: int | None = None
restaurant_confirmed: int | None = None
```

**Backend query** in `list_trips` (and `get_trip`): add a subquery counting `food` category activities, split by whether `confirmation_number` is non-null, same pattern as `transport_total`/`transport_confirmed`.

**Frontend `TripSummary` interface** in `lib/types.ts`:
```typescript
restaurant_total?: number
restaurant_confirmed?: number
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/travel_planner/routers/trips.py` | Add `restaurant_total`/`restaurant_confirmed` subqueries |
| `backend/src/travel_planner/schemas/trip.py` | Add fields to `TripSummaryResponse` |
| `frontend/src/lib/types.ts` | Add fields to `TripSummary` |
| `frontend/src/pages/TripsPage.tsx` | Add type filter pill row |
| `frontend/src/pages/DashboardPage.tsx` | Map focus, Next Up overlay, grouped Needs Attention, remove quick links |
