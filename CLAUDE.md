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
- `backend/tests/conftest.py` — Test fixtures: RSA key pairs, `auth_headers`, `mock_db_session`

### Frontend
- `frontend/src/router.tsx` — TanStack Router route definitions
- `frontend/src/lib/api.ts` — Axios instance with JWT interceptors
- `frontend/src/lib/types.ts` — Shared TypeScript interfaces
- `frontend/src/contexts/AuthContext.tsx` — Auth state management, session loading gate
- `frontend/src/lib/supabase.ts` — Supabase client initialization
- `frontend/src/hooks/useTrips.ts` — Trip queries + mutations
- `frontend/src/hooks/useMembers.ts` — Member queries + mutations
- `frontend/src/hooks/useItinerary.ts` — Itinerary queries + mutations
- `frontend/src/hooks/useChecklists.ts` — Checklist queries + mutations
- `frontend/src/hooks/useCalendar.ts` — Calendar queries + mutations

## Environment

Required in `backend/.env`:
- `DATABASE_URL` — Postgres connection string (`postgresql+asyncpg://...`)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anon/public key

Required in `frontend/.env.local`:
- `VITE_SUPABASE_URL` — Same Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Same anon key

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

## Key Architecture Notes

### Auth Gate — `frontend/src/contexts/AuthContext.tsx`

`getSession()` is the sole loading gate. `onAuthStateChange` only updates session state after initial load completes. This prevents race conditions and infinite spinners.

### API Interceptors — `frontend/src/lib/api.ts`

Request interceptor attaches the JWT from the current session. Response interceptor has a refresh mutex for 401s — only one refresh attempt at a time, concurrent requests queue behind it.

### Backend Auth — `backend/src/travel_planner/auth.py`

JWKS-based JWT verification. Accepts both RS256 and ES256 algorithms. Anonymous Supabase users have an empty email field.

### Supabase Project Ref

`rinmqfynbjsqitjzxrnt` — localStorage key: `sb-rinmqfynbjsqitjzxrnt-auth-token`
