# Trips, Calendar & Dashboard UX — Design

**Goal:** Four focused UX improvements: year view as default calendar, event count badges on year view month headings, pre-selected active filters on the trips page, uniform TripCard booking chips, and a dynamic "Needs Attention" dashboard panel.

**Architecture:** All changes are purely frontend. No backend schema changes required. All booking stats (`transport_total/confirmed`, `lodging_total/confirmed`, `activity_total/confirmed`, `days_with_activities`, `itinerary_day_count`) are already returned by `GET /api/trips`.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react

---

## Feature 1 — Calendar default: Year view

**Problem:** The planning center opens in month view. Year view is more useful as the landing experience for spatial planning.

**Solution:** Change `useState<ZoomLevel>('month')` → `useState<ZoomLevel>('year')` in `PlanningCenterPage.tsx`.

**Files:**
- Modify: `frontend/src/pages/PlanningCenterPage.tsx`

**Behaviour:**
- Page loads in year view by default
- User can still switch to month/quarter via the zoom toggle
- No other state changes needed

---

## Feature 2 — Year view: event count badge on month heading

**Problem:** Custom day events (fitness races, milestones) are visible as amber stars in day cells and in the inventory panel, but there's no at-a-glance signal on the month heading itself for months that have events.

**Solution:** Render a small amber pill badge inline after the month name button showing the count of custom days in that month. Only renders when count > 0.

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`

**Behaviour:**
- In the month grid loop, compute `eventCount` = number of `customDaysForYear` entries whose `resolvedDate` falls in that month
- When `eventCount > 0`, render after the month `<button>`:
  ```tsx
  <span className="ml-1 bg-amber-100 text-amber-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
    {eventCount}
  </span>
  ```
- The month heading row becomes a `flex items-center gap-0` wrapper containing the button + optional badge
- Compact mode (compact DayCell): unchanged

---

## Feature 3 — Trips page: pre-select dreaming, planning, booked filters

**Problem:** The trips page defaults to showing all trips including completed ones. Users typically want to see their active pipeline.

**Solution:** Change the initial filter state from `[]` (All) to `['dreaming', 'planning', 'booked']`.

**Files:**
- Modify: `frontend/src/pages/TripsPage.tsx`

**Behaviour:**
- `useState<TripStatus[]>(['dreaming', 'planning', 'booked'])` replaces `useState<TripStatus[]>([])`
- "All" pill click still resets to `[]` (shows everything) — existing logic unchanged
- The three pills render as active/selected on first load
- Tests that assert initial state (empty `activeStatuses`) need updating

---

## Feature 4 — TripCard: always-visible booking indicators

**Problem:** Booking chips only render when `total > 0`, so cards vary in height depending on whether flights/hotels/activities have been logged. This makes the grid visually uneven.

**Solution:** Always render all three chips (flight, hotel, activity). Use distinct visual states for each condition.

**Files:**
- Modify: `frontend/src/components/trips/TripCard.tsx`

**Behaviour:**
- Remove `.filter((c) => c.total > 0)` — always render all 3 chips
- Three visual states:
  - **Empty** (`total === 0`): `bg-cloud-50 text-cloud-300` — icon only, no count text
  - **Partial** (`confirmed < total`): `bg-amber-50 text-amber-700` — icon + `confirmed/total`
  - **Complete** (`confirmed === total && total > 0`): `bg-emerald-50 text-emerald-700` — icon + `confirmed/total`
- The booking chip row is always present (no conditional wrapper), ensuring uniform card height
- Chip row `mb-3` spacing is unconditional

---

## Feature 5 — Dashboard: "Needs Attention" action panel

**Problem:** The dashboard Quick Actions panel shows static links (New Trip, View Calendar). It doesn't surface actionable items from existing trips.

**Solution:** Replace "Quick Actions" with a dynamic "Needs Attention" panel that scans planning/booked/active trips and lists specific action items. Static quick links move to a compact 2-button row below the panel.

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Behaviour:**

*Action item detection* — for each trip with status in `['planning', 'booked', 'active']`:
- **Unconfirmed flights**: `transport_total > 0 && transport_confirmed < transport_total`
  - Label: `"{destination} — {transport_total - transport_confirmed} flight(s) not confirmed"`
  - Icon: `Plane` (lucide-react), amber colour
- **Unconfirmed hotels**: `lodging_total > 0 && lodging_confirmed < lodging_total`
  - Label: `"{destination} — {lodging_total - lodging_confirmed} hotel(s) not confirmed"`
  - Icon: `Hotel` (lucide-react), amber colour
- **Unplanned days**: `itinerary_day_count > 0 && days_with_activities < itinerary_day_count`
  - Label: `"{destination} — {itinerary_day_count - days_with_activities} day(s) not planned"`
  - Icon: `Calendar` (lucide-react), indigo colour

*Rendering:*
- Each action item is a `Link` to `/trips/$tripId` — a row with icon + label + `ArrowRight`
- Items are sorted: active trips first, then booked, then planning
- Maximum 5 items shown (most urgent first by trip start date proximity)
- Empty state: `"All caught up"` with a checkmark icon when no issues found and trips exist
- If no planning/booked/active trips exist: show the existing "No upcoming trips" empty state

*Quick links:*
- "New Trip" and "View Calendar" move below "Needs Attention" as a compact `flex gap-3` row of small secondary buttons

---

## Testing Notes

- Feature 1: `PlanningCenterPage` renders year view on mount
- Feature 2: Month heading renders amber badge when custom days exist for that month; no badge when count is 0
- Feature 3: `TripsPage` initial render shows dreaming/planning/booked pills as active; clicking All resets to all trips
- Feature 4: All 3 booking chips always render; empty state uses `bg-cloud-50 text-cloud-300`; partial uses amber
- Feature 5: Trips with unconfirmed transport/lodging or unplanned days appear as action items; all-confirmed trips do not
