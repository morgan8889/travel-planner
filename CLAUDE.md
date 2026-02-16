# Travel Planner

## Project Structure

Monorepo with two main directories:

- **`frontend/`** — React + Vite + TanStack Router (TypeScript)
- **`backend/`** — FastAPI + SQLAlchemy + asyncpg (Python, managed with uv)

**Infrastructure**: Supabase for auth (magic link + anonymous sign-in) and Postgres database. Backend auth verifies JWTs via JWKS (RS256 + ES256).

## Dev Commands

```bash
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
```

## TDD Approach

Write tests before implementation. Follow the red-green-refactor cycle:

1. **Red**: Write a failing test that defines the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

### Backend (pytest)

```bash
# Run a specific test file
cd backend && uv run pytest tests/test_trips.py -v

# Run a specific test
cd backend && uv run pytest tests/test_trips.py::test_create_trip -v

# Run with coverage
cd backend && uv run pytest --cov=travel_planner
```

- Use `pytest.mark.asyncio` for async endpoint tests
- Use the `client` fixture from `conftest.py` for API tests
- Mock Supabase auth with dependency overrides on `get_current_user`

### Frontend (vitest)

```bash
# Run a specific test file
cd frontend && npx vitest run src/__tests__/trips.test.tsx

# Run in watch mode during TDD
cd frontend && npx vitest src/__tests__/trips.test.tsx
```

- Use `@testing-library/react` for component tests
- Mock API calls with `vi.mock` on `../lib/api`
- Mock auth context when components require a session

### Workflow

1. Write the test first — commit it (test should fail or be the only change)
2. Implement the feature — commit when tests pass
3. Refactor if needed — commit with tests still passing

This keeps commits small, reviewable, and bisectable.

## E2E Validation Protocol

After any frontend or backend change, verification must go beyond unit tests. Follow this protocol:

### 1. Static Checks

Run `tsc --noEmit` and `vitest run` to confirm type safety and unit tests pass.

### 2. Start Both Servers

- Backend on `:8000`
- Frontend on Vite dev port (typically `:5173`)

### 3. Browser Verification with Playwright MCP

- Navigate to the app in a real browser
- **Auth-related changes**: use Supabase anonymous sign-in (`POST /auth/v1/signup` with empty body + `apikey` header) to get a real session, inject into localStorage, reload
- **Stale session testing**: inject a fake expired JWT into localStorage key `sb-rinmqfynbjsqitjzxrnt-auth-token`, reload, and verify the app recovers gracefully (no infinite spinners, no 401 storms)

### 4. Monitor Backend Logs

Check uvicorn output for unexpected 401s, 500s, or request storms. A healthy app should show clean request logs with no repeated failed auth attempts.

### 5. Check Browser State

Use `browser_network_requests` and `browser_console_messages` to look for errors, failed requests, or unexpected behavior.

### 6. Test CRUD

Don't just load the page — create, read, update, and delete real data to verify the full flow works.

### 7. Clean Up

Stop servers, close the browser, and kill any lingering processes on ports 8000/5173.

## Key Architecture Notes

### Auth Gate — `frontend/src/contexts/AuthContext.tsx`

`getSession()` is the sole loading gate. `onAuthStateChange` only updates session state after initial load completes. This prevents race conditions and infinite spinners.

### API Interceptors — `frontend/src/lib/api.ts`

Request interceptor attaches the JWT from the current session. Response interceptor has a refresh mutex for 401s — only one refresh attempt at a time, concurrent requests queue behind it.

### Backend Auth — `backend/src/travel_planner/auth.py`

JWKS-based JWT verification. Accepts both RS256 and ES256 algorithms. Anonymous Supabase users have an empty email field.

### Supabase Project Ref

`rinmqfynbjsqitjzxrnt` — localStorage key: `sb-rinmqfynbjsqitjzxrnt-auth-token`
