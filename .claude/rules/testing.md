# Testing Patterns

## Backend (pytest)

### Running Tests
```bash
cd backend && uv run pytest tests/test_trips.py -v          # specific file
cd backend && uv run pytest tests/test_trips.py::test_create_trip -v  # specific test
cd backend && uv run pytest --cov=travel_planner             # with coverage
```

### Fixtures (see `backend/tests/conftest.py`)
- `client` — async `httpx.AsyncClient` wired to the FastAPI app
- `auth_headers` — valid JWT bearer token headers (RSA key pair generated per session)
- `mock_db_session` — patched async SQLAlchemy session
- `override_get_current_user` — dependency override returning a fixed user ID

### Patterns
- Use `pytest.mark.asyncio` for async endpoint tests
- Mock auth with dependency overrides on `get_current_user`
- Test helpers: `_make_trip()`, `_make_member()` in each test file for creating test data
- Schema pattern: `XxxCreate`, `XxxUpdate`, `XxxResponse` for Pydantic models
- Assert HTTP status codes and response JSON structure

### Example Test Structure
```python
@pytest.mark.asyncio
async def test_create_trip(client, auth_headers):
    response = await client.post("/api/trips", json={...}, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Trip"
```

## Frontend (vitest + Testing Library)

### Running Tests
```bash
cd frontend && npx vitest run src/__tests__/trips.test.tsx   # specific file
cd frontend && npx vitest src/__tests__/trips.test.tsx       # watch mode
cd frontend && npx vitest run                                 # all tests
```

### Patterns
- Use `@testing-library/react` for component tests
- Mock API calls with `vi.mock` on `../lib/api`
- Mock auth context when components require a session
- Tests in `__tests__/` directory, named `<feature>.test.tsx`
- Query key factory pattern: `tripKeys.all`, `tripKeys.detail(id)`

### Mocking API Example
```typescript
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
```

## TDD Workflow
1. Write the test first — commit it
2. Implement the feature — commit when tests pass
3. Refactor if needed — commit with tests still passing
