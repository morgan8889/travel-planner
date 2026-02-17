# Travel Planner

## Project Structure

Monorepo with two main directories:

- **`frontend/`** — React + Vite + TanStack Router (TypeScript)
- **`backend/`** — FastAPI + SQLAlchemy + asyncpg (Python, managed with uv)

**Infrastructure**: Supabase for auth (magic link + anonymous sign-in) and Postgres database. Backend auth verifies JWTs via JWKS (RS256 + ES256).

## Key Files

- `backend/src/travel_planner/main.py` — FastAPI app entry point, router registration
- `backend/src/travel_planner/auth.py` — JWKS JWT verification, `CurrentUserId` dependency
- `backend/src/travel_planner/db.py` — Async SQLAlchemy engine + session factory
- `backend/src/travel_planner/config.py` — Pydantic Settings (env vars)
- `backend/tests/conftest.py` — Test fixtures: RSA key pairs, `auth_headers`, `mock_db_session`
- `frontend/src/router.tsx` — TanStack Router route definitions
- `frontend/src/lib/api.ts` — Axios instance with JWT interceptors
- `frontend/src/contexts/AuthContext.tsx` — Auth state management, session loading gate
- `frontend/src/lib/supabase.ts` — Supabase client initialization

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

### Backend (pytest)

- `cd backend && uv run pytest tests/test_trips.py -v` — run specific file
- `cd backend && uv run pytest tests/test_trips.py::test_create_trip -v` — run specific test
- Use `client` fixture from `conftest.py` for API tests
- Mock auth with dependency overrides on `get_current_user` (see `conftest.py`)
- Test helpers: `_make_trip()`, `_make_member()` in each test file

### Frontend (vitest)

- `cd frontend && npx vitest run src/__tests__/trips.test.tsx` — run specific file
- `cd frontend && npx vitest src/__tests__/trips.test.tsx` — watch mode
- Mock API calls with `vi.mock` on `../lib/api`
- Mock auth context when components require a session

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

## E2E Validation

After significant changes, verify beyond unit tests:

1. Run `tsc --noEmit` and `vitest run`
2. Start both servers (backend `:8000`, frontend `:5173`)
3. **Auth testing**: Use Supabase anonymous sign-in (`POST /auth/v1/signup` with empty body + `apikey` header) to get a session, inject into localStorage, reload
4. **Stale session**: Inject expired JWT into `sb-rinmqfynbjsqitjzxrnt-auth-token` localStorage key, verify graceful recovery (no spinners, no 401 storms)
5. Monitor uvicorn logs for unexpected 401s, 500s, or request storms
6. Use `browser_network_requests` and `browser_console_messages` for errors
7. Test full CRUD — don't just load pages
8. Clean up: stop servers, close browser, kill processes on ports 8000/5173

## Key Architecture Notes

### Auth Gate — `frontend/src/contexts/AuthContext.tsx`

`getSession()` is the sole loading gate. `onAuthStateChange` only updates session state after initial load completes. This prevents race conditions and infinite spinners.

### API Interceptors — `frontend/src/lib/api.ts`

Request interceptor attaches the JWT from the current session. Response interceptor has a refresh mutex for 401s — only one refresh attempt at a time, concurrent requests queue behind it.

### Backend Auth — `backend/src/travel_planner/auth.py`

JWKS-based JWT verification. Accepts both RS256 and ES256 algorithms. Anonymous Supabase users have an empty email field.

### Supabase Project Ref

`rinmqfynbjsqitjzxrnt` — localStorage key: `sb-rinmqfynbjsqitjzxrnt-auth-token`
