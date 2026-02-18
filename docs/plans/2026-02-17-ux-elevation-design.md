# UX Elevation Design — Cloud + Deep Indigo

## Context

The travel planner app has functional features through Phase 5 (trips, itinerary, checklists, calendar) but the UX feels utilitarian — cold stone/gray palette, flat navigation, no geographic visualization. This design elevates the entire experience with a cohesive visual system, intuitive navigation, and Mapbox-powered maps at two levels (trip overview + daily itinerary).

## Design System: Cloud + Deep Indigo

### Color Palette

**Base — "Cloud"**:

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-cloud-50` | `#F8F9FC` | Page background |
| `--color-cloud-100` | `#F1F3F9` | Card hover, subtle fills |
| `--color-cloud-200` | `#E2E5EE` | Borders |
| `--color-cloud-300` | `#C9CDD9` | Dividers |
| `--color-cloud-400` | `#A0A5B5` | Placeholder text |
| `--color-cloud-500` | `#7A7F91` | Secondary text |
| `--color-cloud-600` | `#5A5F70` | Body text |
| `--color-cloud-700` | `#3D4152` | Headings |
| `--color-cloud-800` | `#252836` | Primary text |
| `--color-cloud-900` | `#1A1C27` | Display text |

**Accent — "Indigo"**:

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-indigo-50` | `#EEF2FF` | Accent backgrounds |
| `--color-indigo-100` | `#E0E7FF` | Hover fills |
| `--color-indigo-500` | `#4338CA` | Primary buttons, links, active states |
| `--color-indigo-600` | `#3730A3` | Button hover |
| `--color-indigo-700` | `#312E81` | Active press |

**Semantic colors** (warmed slightly):
- Success: `#3D8A5E`
- Error: `#C94A4A`
- Warning: `#D4944A`

**Status badge colors** (harmonized with Cloud palette):
- Dreaming: `#F0EDFF` / `#6B5CB5`
- Planning: `#FFF7ED` / `#B8862D`
- Booked: `#EEF2FF` / `#4A6DB5`
- Active: `#F0FDF4` / `#3D8A5E`
- Completed: `#F3F4F6` / `#7A7F91`

### Typography

Sans-serif only (Inter). Hierarchy through size and weight:

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 2.25rem (36px) | 700 | Page hero titles |
| H1 | 1.75rem (28px) | 700 | Trip destination names |
| H2 | 1.25rem (20px) | 600 | Section headers |
| H3 | 1rem (16px) | 600 | Card titles |
| Body | 0.9375rem (15px) | 400 | Primary content |
| Small | 0.8125rem (13px) | 400 | Secondary info, dates |
| Caption | 0.75rem (12px) | 500 | Labels, badges |

### Component Styling

**Primary Button**: `bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl px-5 py-2.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200`

**Secondary Button**: `bg-white border border-cloud-300 text-cloud-700 hover:bg-cloud-50 hover:border-cloud-400 rounded-xl`

**Ghost Button**: `text-indigo-500 hover:bg-indigo-50 rounded-lg px-3 py-1.5`

**Form Inputs**: `border border-cloud-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white placeholder:text-cloud-400`

**Cards**: `bg-white rounded-2xl border border-cloud-200/60 shadow-sm hover:shadow-md hover:shadow-cloud-300/20 transition-all duration-300`

**Focus ring**: `outline: 2px solid var(--color-indigo-500)` (replaces blue-500)

**Modals**: Overlay `bg-cloud-900/40 backdrop-blur-md`, card `rounded-2xl` with cloud border

**Scrollbar**: Thumb `#C9CDD9` (cloud-300), hover `#A0A5B5` (cloud-400)

---

## Navigation & Information Architecture

### Current
- `/` redirects to `/calendar`
- Flat header: [Calendar] [Trips] + Sign Out button

### New
- `/` becomes a **Dashboard** page (no redirect)
- Header: [Dashboard] [Trips] [Calendar] + user avatar dropdown (sign out inside)
- Active nav: underline in indigo

### New Dashboard Page (`/`)

```
+--------------------------------------------------+
| Welcome back, {display_name}                      |
+--------------------------------------------------+
| [World Map - all trip destination pins]            |
|  Pins color-coded by trip status                   |
|  Click pin -> popup with trip name + "View" link   |
+--------------------------------------------------+
| Upcoming Trips (next 3)  |  Quick Actions          |
| [TripCard]               |  [+ New Trip]           |
| [TripCard]               |  [View Calendar]        |
| [TripCard]               |                         |
+--------------------------------------------------+
```

Simple "at a glance" view. Map is the hero element. Empty state shows a world map at low zoom with a prompt to create the first trip.

---

## Map Integration

### Provider & Dependencies

- **Mapbox GL JS v3** via `react-map-gl` v7
- Map style: `mapbox://styles/mapbox/light-v11`
- Frontend token: `VITE_MAPBOX_TOKEN`
- Backend token: `MAPBOX_ACCESS_TOKEN` (for geocoding proxy)

### Map Placement

| Page | Map | Data | Notes |
|------|-----|------|-------|
| Dashboard `/` | World overview, ~300px | All trips with coordinates | `fitBounds` to show all pins |
| Trip Detail / Overview | Regional, inline | Single trip destination | Zoom ~10 (city scale) |
| Trip Detail / Itinerary | City/local, side panel | Day's activities | Numbered pins matching sort order |
| Trips list | None | - | Card grid is primary UI |
| Calendar | None | - | Too dense for a map |

### Itinerary Tab Layout Change

Desktop: side-by-side (activities 60% | map 40%)
Mobile: stacked (map above, ~200px, then activity list below)

Map shows numbered pins for all activities on visible/expanded days. Pins color-coded by category. Click pin shows popup with activity title + time.

### Component Architecture

```
components/map/
  MapView.tsx           — Reusable <Map> wrapper (center, zoom, markers, fitBounds)
  TripMarker.tsx        — Status-colored pin for trip destinations
  ActivityMarker.tsx    — Numbered circle pin for itinerary activities
  MarkerPopup.tsx       — Styled popup card on marker click
  MapLoadingState.tsx   — Skeleton while map tiles load
```

`MapView` props:
```typescript
interface MapViewProps {
  center?: [number, number]       // [lng, lat]
  zoom?: number
  markers?: MarkerData[]
  className?: string
  interactive?: boolean
  onMarkerClick?: (id: string) => void
  fitBounds?: boolean
}
```

Lazy-loaded with `React.lazy()` + `Suspense` to avoid adding ~220KB to the initial bundle for pages without maps.

### Mobile Map Behavior

`scrollZoom={false}` to prevent scroll hijacking. Two-finger pinch to zoom on touch devices.

---

## Geocoding

### Backend Proxy

New endpoint: `GET /api/geocode/search?q={query}&limit=5`

Proxies to Mapbox Geocoding API v5. Protected by auth (`CurrentUserId`). Returns:

```python
class GeocodeSuggestion(BaseModel):
    place_name: str      # "Paris, France"
    latitude: float
    longitude: float
    place_type: str      # "city", "address", "poi"
    context: str | None  # "Ile-de-France, France"
```

**Why backend proxy**: Protects API key, enables rate limiting, single place to swap providers.

### Frontend: LocationAutocomplete Component

```
components/form/LocationAutocomplete.tsx
```

- Controlled text input with 300ms debounce
- Calls `/api/geocode/search` on typing (min 2 chars)
- Dropdown with suggestions styled to match design system
- On selection: fills text, calls `onSelect({ placeName, latitude, longitude })`
- Graceful fallback: freeform text without selection keeps coordinates null

**Used in**:
- `TripForm.tsx` — destination field (replaces plain `<input>`)
- `AddActivityModal.tsx` — location field (replaces plain `<input>`)

---

## Backend Changes

### New Database Fields

**Trip model** (`models/trip.py`):
```python
destination_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
destination_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
```

**Activity model** (`models/itinerary.py`):
```python
latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
```

### Alembic Migration

Single migration adding 4 nullable Float columns. Purely additive — no data transformation. Latest head: `a20688c1a979`.

### Schema Changes

All Trip and Activity Create/Update/Response schemas get coordinate fields as optional/nullable. No breaking changes — old clients continue working.

### New Files

- `routers/geocode.py` — geocoding proxy endpoint
- `schemas/geocode.py` — GeocodeSuggestion model
- Register geocode router in `main.py`

### Config

Add to `config.py`:
```python
mapbox_access_token: str = ""
```

---

## Frontend Type Changes

`lib/types.ts` additions:
```typescript
// On Trip/TripSummary
destination_latitude: number | null
destination_longitude: number | null

// On Activity
latitude: number | null
longitude: number | null

// New
interface GeocodeSuggestion {
  place_name: string
  latitude: number
  longitude: number
  place_type: string
  context: string | null
}
```

---

## Bug Fix: Emoji Violation

`ActivityItem.tsx` (line 12-17) uses emoji characters for category icons, violating the "no emoji in code" rule. Replace with lucide-react icons:

```typescript
// Before (violates CLAUDE.md)
const CATEGORY_ICONS = { transport: '✈️', food: '🍽️', activity: '🎯', lodging: '🏨' }

// After
import { Plane, Utensils, MapPin, Hotel } from 'lucide-react'
const CATEGORY_ICONS = { transport: Plane, food: Utensils, activity: MapPin, lodging: Hotel }
```

Same fix needed in `AddActivityModal.tsx` if it uses emoji for categories.

---

## Page-by-Page Changes

### Trips List (`/trips`)
- Page title larger/bolder
- "New Trip" button: indigo primary
- Status filter pills: selected `bg-indigo-500 text-white`, unselected `bg-white border-cloud-200 text-cloud-600`
- TripCard: `rounded-2xl`, 3px top border in type color, warmer hover shadow
- EmptyTripsState: indigo accent

### Trip Detail (`/trips/$tripId`)
- Destination as large bold heading
- Warmed badges
- **Overview tab**: Map section between header and notes (single destination pin)
- **Itinerary tab**: Side-by-side layout with activity map panel
- **Checklists tab**: Warm card styling, indigo checkbox accent
- Tab underline: `border-indigo-500 text-indigo-600`

### Calendar (`/calendar`)
- Year title larger/bolder
- "Add Block" button: indigo primary
- Today indicator: `ring-indigo-300 text-indigo-600`
- Month/day text: cloud palette

### New Trip Form (`/trips/new`)
- Page title: "Plan a New Trip"
- `LocationAutocomplete` replaces destination input
- Small inline map preview below destination on selection (~150px)
- All inputs: cloud borders, indigo focus ring
- Submit: indigo primary

### Activity Form (AddActivityModal)
- `LocationAutocomplete` replaces location input
- Lucide icons replace emoji in category selector
- Modal: warm overlay, cloud card styling

---

## New Dependencies

### Frontend (npm)
- `mapbox-gl` ^3.9
- `react-map-gl` ^7.1
- `@types/mapbox-gl` ^3.4 (dev)

### Backend (Python)
None — uses existing `httpx` for geocoding proxy.

### Environment Variables
- `MAPBOX_ACCESS_TOKEN` in `backend/.env`
- `VITE_MAPBOX_TOKEN` in `frontend/.env.local`

---

## Implementation Phases

### Phase A: Design System Foundation
1. Update `index.css` `@theme` with Cloud + Indigo color tokens
2. Update `RootLayout.tsx` header — warm styling + Dashboard nav link + avatar dropdown
3. Update `Modal.tsx`, `ConfirmDialog.tsx`, `LoadingSpinner.tsx` with new palette
4. Update badge components with harmonized colors
5. Update focus ring color globally
6. Fix emoji → lucide icons in `ActivityItem.tsx` and `AddActivityModal.tsx`

### Phase B: Backend Coordinates + Geocoding
1. Alembic migration: add lat/lng to trips and activities
2. Update Trip and Activity models with coordinate fields
3. Update all schemas (Create/Update/Response)
4. Update routers for new fields
5. Add `MAPBOX_ACCESS_TOKEN` to config
6. Create geocode router + schema
7. Register geocode router in main.py
8. Backend tests for new fields + geocoding

### Phase C: Map Components + LocationAutocomplete
1. Install mapbox-gl, react-map-gl
2. Add `VITE_MAPBOX_TOKEN` to frontend env
3. Import Mapbox CSS in main.tsx
4. Build MapView, TripMarker, ActivityMarker, MarkerPopup, MapLoadingState
5. Build LocationAutocomplete
6. Add geocodeApi to lib/api.ts
7. Add geocode types to lib/types.ts

### Phase D: Page Redesigns
1. Restyle TripsPage, TripCard, EmptyTripsState
2. Restyle TripDetailPage — warm styling + map in overview tab
3. Integrate LocationAutocomplete into TripForm
4. Integrate LocationAutocomplete into AddActivityModal
5. Add map panel to itinerary tab (side-by-side layout)
6. Restyle CalendarPage + calendar components
7. Build DashboardPage with world map
8. Add dashboard route, update router.tsx
9. Update/write frontend tests

---

## Verification

### Static Checks
```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

### Manual Verification
1. Start both servers
2. Navigate to Dashboard — verify world map renders with trip pins
3. Create a new trip using LocationAutocomplete — verify coordinates saved
4. Add activities with locations — verify pins on itinerary map
5. Check all pages for consistent Cloud + Indigo styling
6. Test on mobile viewport — verify stacked map layout
7. Verify existing trips without coordinates gracefully hide map sections

### Key Files to Modify
- `frontend/src/index.css` — design tokens
- `frontend/src/router.tsx` — dashboard route
- `frontend/src/components/layout/RootLayout.tsx` — nav updates
- `frontend/src/components/itinerary/ActivityItem.tsx` — emoji fix
- `frontend/src/components/trips/TripForm.tsx` — LocationAutocomplete
- `frontend/src/components/itinerary/AddActivityModal.tsx` — LocationAutocomplete + emoji fix
- `backend/src/travel_planner/models/trip.py` — coordinate fields
- `backend/src/travel_planner/models/itinerary.py` — coordinate fields
- `backend/src/travel_planner/config.py` — Mapbox token
- `backend/src/travel_planner/main.py` — geocode router registration
