# Auto-Complete Past Trips & Event Title Display — Design

**Date:** 2026-02-22

## Goals

1. **Auto-complete past trips** — any trip whose `end_date` is in the past should have its status automatically updated to `completed` in the database.
2. **Event title display** — for `type='event'` trips, show the event name (parsed from `notes`) as the primary title everywhere, with `destination` shown as a secondary location line.

---

## Feature 1: Auto-complete past trips

### Approach

Backend self-healing update on list and detail endpoints.

When `GET /trips` or `GET /trips/{id}` is called, the endpoint checks for trips where `end_date < date.today()` and `status != 'completed'`. Any such trips are bulk-updated to `'completed'` and committed before the response is returned.

**Scope**: all statuses (dreaming, planning, booked, active). Past = done.

**Why this approach**: Persists correctly on first page load — no extra frontend round-trips, no flash of stale status, no new endpoints. Self-healing pattern: if a user goes offline, the next load corrects status automatically.

### Files changed

| File | Change |
|------|--------|
| `backend/src/travel_planner/routers/trips.py` | Auto-update past trips in `list_trips` and `get_trip` endpoints |
| `backend/tests/test_trips.py` | Add test: past trip auto-completes on GET /trips |

### Implementation detail

In `list_trips`:
```python
from datetime import date
from sqlalchemy import update

# After fetching trips:
today = date.today()
past_ids = [t.id for t in trips if t.end_date < today and t.status != TripStatus.completed]
if past_ids:
    await db.execute(
        update(Trip)
        .where(Trip.id.in_(past_ids))
        .values(status=TripStatus.completed)
    )
    await db.commit()
    for t in trips:
        if t.id in set(past_ids):
            t.status = TripStatus.completed
```

Same pattern in `get_trip` (single-trip endpoint).

---

## Feature 2: Event name as title

### Data model

No schema changes. The convention already in use:
- `destination` — location (e.g. `"Austin, TX"`)
- `notes` — starts with event name: `"3M Half Marathon — local Austin race"` (split on ` — `)

`getEventName(notes)` already exists in `TripSpan.tsx`. It will be extracted to a shared utility.

### Shared utility

New file: `frontend/src/lib/tripUtils.ts`

```typescript
export function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}
```

`TripSpan.tsx` imports from `tripUtils` instead of defining locally.

### TripCard changes

For `type === 'event'`:
- `<h3>` title: `getEventName(trip.notes) ?? trip.destination`
- Add a location line (with MapPin icon) showing `trip.destination`, between the title and date row

For non-event trips: no change.

### TripDetailPage changes

For `type === 'event'`:
- `<h1>`: event name (`getEventName(trip.notes) ?? trip.destination`)
- Below h1: `destination` with a MapPin icon (small, muted)
- Breadcrumb (`My Trips > ...`): event name
- Delete confirmation message: event name

For non-event trips: no change.

### Files changed

| File | Change |
|------|--------|
| `frontend/src/lib/tripUtils.ts` | New: `getEventName` shared utility |
| `frontend/src/components/planning/TripSpan.tsx` | Import `getEventName` from `tripUtils` |
| `frontend/src/components/trips/TripCard.tsx` | Event title + location secondary line |
| `frontend/src/pages/TripDetailPage.tsx` | Event h1, destination sub-line, breadcrumb, delete dialog |
| `frontend/src/__tests__/TripCard.test.tsx` | Add: event trip shows event name as title + destination as secondary |

---

## Non-Goals

- No backend change for event name — `destination` and `notes` are the source of truth as-is
- No UI for manually triggering auto-complete (it's fully automatic)
- No change to the TripForm — users still set destination and notes normally
