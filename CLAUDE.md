# Travel Planner

## Project Structure

Monorepo with two main directories:

- **`frontend/`** — React + Vite + TanStack Router (TypeScript)
- **`backend/`** — FastAPI + SQLAlchemy + asyncpg (Python, managed with uv)

**Infrastructure**: Supabase for auth (magic link + anonymous sign-in) and Postgres database. Backend auth verifies JWTs via JWKS (RS256 + ES256).

## Key Files

### Backend
- `backend/src/travel_planner/main.py` — FastAPI app entry point, router registration
- `backend/src/travel_planner/auth.py` — JWKS JWT verification, `CurrentUserId` dependency
- `backend/src/travel_planner/db.py` — Async SQLAlchemy engine + session factory
- `backend/src/travel_planner/config.py` — Pydantic Settings (env vars)
- `backend/src/travel_planner/deps.py` — Shared dependency helpers (trip authorization)
- `backend/src/travel_planner/routers/trips.py` — Trip CRUD + member management
- `backend/src/travel_planner/routers/itinerary.py` — Itinerary day + activity CRUD
- `backend/src/travel_planner/routers/checklist.py` — Checklist + item CRUD
- `backend/src/travel_planner/routers/calendar.py` — Annual plan + calendar blocks
- `backend/src/travel_planner/routers/geocode.py` — Mapbox geocoding proxy
- `backend/src/travel_planner/schemas/` — Pydantic schemas (one per router)
- `backend/tests/conftest.py` — Test fixtures: RSA key pairs, `auth_headers`, `mock_db_session`

### Frontend
- `frontend/src/router.tsx` — TanStack Router route definitions
- `frontend/src/lib/api.ts` — Axios instance with JWT interceptors + `itineraryApi`, `checklistApi`, `calendarApi`, `geocodeApi` namespaces
- `frontend/src/lib/types.ts` — Shared TypeScript interfaces
- `frontend/src/contexts/AuthContext.tsx` — Auth state management, session loading gate
- `frontend/src/lib/supabase.ts` — Supabase client initialization
- `frontend/src/hooks/useTrips.ts` — Trip queries + mutations
- `frontend/src/hooks/useMembers.ts` — Member queries + mutations
- `frontend/src/hooks/useItinerary.ts` — Itinerary queries + mutations
- `frontend/src/hooks/useChecklists.ts` — Checklist queries + mutations
- `frontend/src/hooks/useCalendar.ts` — Calendar queries + mutations
- `frontend/src/components/map/MapView.tsx` — Mapbox GL map wrapper with error boundary
- `frontend/src/components/map/TripMarker.tsx` — Trip destination pin
- `frontend/src/components/map/ActivityMarker.tsx` — Activity location pin (category-colored)
- `frontend/src/components/map/MarkerPopup.tsx` — Popup for clicked markers
- `frontend/src/pages/DevSeedPage.tsx` — Dev tool: seed comprehensive test data at `/dev/seed`

## Environment

Required in `backend/.env`:
- `DATABASE_URL` — Postgres connection string (`postgresql+asyncpg://...`)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anon/public key

Required in `frontend/.env.local`:
- `VITE_SUPABASE_URL` — Same Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Same anon key
- `VITE_MAPBOX_TOKEN` — Mapbox GL access token (map renders a placeholder if missing)

## Dev Commands

```bash
# Install dependencies
cd backend && uv sync && uv sync --dev
cd frontend && npm install

# Backend server
cd backend && uv run uvicorn travel_planner.main:app --port 8000

# Frontend dev server (Vite, proxies /api → :8000)
cd frontend && npm run dev

# Backend tests
cd backend && uv run pytest

# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend unit tests
cd frontend && npx vitest run

# Backend lint
cd backend && uv run ruff check . && uv run ruff format --check .

# Frontend lint
cd frontend && npm run lint

# Database migrations
cd backend && uv run alembic upgrade head          # apply migrations
cd backend && uv run alembic revision -m "desc"    # create new migration
```

## Testing

See `.claude/rules/testing.md` for detailed patterns, fixtures, and examples.

## E2E Validation

See `.claude/rules/e2e-validation.md` for the full browser verification protocol.

## Code Style

### Backend
- Pydantic v2: use `model_config = {"from_attributes": True}`, not `class Config`
- Use `@model_validator(mode="after")` for cross-field validation
- Router auth: use `CurrentUserId` dependency from `auth.py`
- Schema pattern: `XxxCreate`, `XxxUpdate`, `XxxResponse` naming
- Helper pattern: `get_trip_with_membership()` for trip authorization checks

### Frontend
- Query key factory pattern: `tripKeys.all`, `tripKeys.detail(id)` (see `hooks/useTrips.ts`)
- Mutations invalidate query keys on success
- Page structure: loading skeleton → error state → empty state → content (see `TripsPage.tsx`)
- Components live in `components/<feature>/` directories
- Tests in `__tests__/` directory, named `<feature>.test.tsx`
- **Icons**: Use `lucide-react` only. Do not use Heroicons or any other icon library.
- **No emoji in code**: Do not add emoji characters in UI components, labels, or source code.
- **Lazy loading**: Only use `React.lazy()` for heavy leaf components (e.g. `MapView` which pulls in `mapbox-gl`). Never lazy-load children that render inside a lazy parent's Suspense boundary — the suspend will unmount the parent, causing state loss and race conditions. Marker components must be direct imports.
- **API namespaces**: Use the typed API helpers (`itineraryApi`, `checklistApi`, `calendarApi`, `geocodeApi`) from `lib/api.ts` rather than raw `api.get/post` calls.

### Backend Validation Gotchas
- **Activity times**: `end_time` must be strictly after `start_time` (no overnight spans like `22:00-02:00`). For overnight activities, omit `end_time`.
- **Calendar plans**: One plan per user per year. Creating a duplicate returns 409. Handle by fetching the existing plan and reusing its ID.
- **Cascade deletes**: Deleting a trip cascades to its itinerary days, activities, and checklists. Delete child trips before parent trips.

## Pre-Commit Checklist

Before committing or creating a PR, **always** run lint, format, type checks, and tests for any code you changed:

```bash
# Backend — run all four
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest

# Frontend — run all three
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Fix any failures before committing. Do not skip or disable checks.

## Key Architecture Notes

### Auth Gate — `frontend/src/contexts/AuthContext.tsx`

`getSession()` is the sole loading gate. `onAuthStateChange` only updates session state after initial load completes. This prevents race conditions and infinite spinners.

### API Interceptors — `frontend/src/lib/api.ts`

Request interceptor attaches the JWT from the current session. Response interceptor has a refresh mutex for 401s — only one refresh attempt at a time, concurrent requests queue behind it.

### Backend Auth — `backend/src/travel_planner/auth.py`

JWKS-based JWT verification. Accepts both RS256 and ES256 algorithms. Anonymous Supabase users have an empty email field.

### Mapbox Maps — `frontend/src/components/map/MapView.tsx`

`MapView` is lazy-loaded (it imports the heavy `mapbox-gl` bundle). It wraps a `react-map-gl` `Map` with an error boundary and a `mapReady` gate — children only render after the map's `onLoad` fires. Marker components (`TripMarker`, `ActivityMarker`, `MarkerPopup`) must be direct imports, not lazy — lazy-loading them inside MapView's Suspense boundary unmounts the map on suspend, causing crashes.

Dashboard shows all trips with coordinates on a world map. Trip detail shows the destination pin plus activity location pins with category-colored icons.

### Dev Seed Page — `frontend/src/pages/DevSeedPage.tsx`

Available at `/dev/seed`. Seeds comprehensive test data (8 trips, 17 activities, 6 checklists, 22 calendar blocks) using the current user's session. "Seed Everything" runs in sequence (trips first, then dependent data). "Clear All Data" deletes all trips (cascades to itineraries/checklists) and calendar blocks.

### Supabase Project Ref

`rinmqfynbjsqitjzxrnt` — localStorage key: `sb-rinmqfynbjsqitjzxrnt-auth-token`
