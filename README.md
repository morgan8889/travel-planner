# Travel Planner

A full-stack travel planning application with AI-powered trip recommendations.

## Project Structure

```
travel-planner/
├── backend/            # FastAPI backend with Python
├── frontend/           # React + TypeScript frontend
├── docs/plans/         # Design docs and implementation plans
└── .claude/rules/      # Claude Code rules (testing, e2e validation)
```

## Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL with async support (asyncpg)
- **ORM**: SQLAlchemy (async)
- **Authentication**: Supabase Auth with RS256 JWT
- **Migrations**: Alembic

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: TanStack Router
- **State**: TanStack Query
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL via react-map-gl
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- PostgreSQL (or use Supabase)
- A Supabase account (for authentication)

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd travel-planner
   ```

2. **Set up environment variables**

   Backend:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your credentials
   ```

   Frontend:
   ```bash
   cp frontend/.env.example frontend/.env.local
   # Edit frontend/.env.local with your credentials
   ```

3. **Start the backend**
   ```bash
   cd backend
   uv sync && uv sync --dev
   uv run alembic upgrade head
   uv run uvicorn travel_planner.main:app --port 8000
   ```

4. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Authentication

This project uses **Supabase Auth with RS256 JWT tokens**. The implementation:

- Uses RS256 (asymmetric) instead of HS256 (symmetric)
- Fetches public keys from JWKS endpoint automatically
- Caches JWKS keys for 1 hour
- No JWT secret needed in environment variables
- Automatic key rotation support

### Required Credentials

You need:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key
- `VITE_MAPBOX_TOKEN` - Mapbox GL access token (frontend only; map shows a placeholder if missing)

## Development

### Running Tests

Backend:
```bash
cd backend
uv run pytest
```

Frontend:
```bash
cd frontend
npx vitest run
```

### Code Quality

Backend:
```bash
cd backend
uv run ruff check .
uv run ruff format --check .
```

Frontend:
```bash
cd frontend
npm run lint
```

### Database Migrations

```bash
cd backend

# Apply migrations
uv run alembic upgrade head

# Create a new migration
uv run alembic revision --autogenerate -m "description"

# Rollback
uv run alembic downgrade -1
```

## API Documentation

The backend automatically generates interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Roadmap

### Phase 1: Project Scaffolding & Database
- ✅ FastAPI backend with SQLAlchemy + asyncpg
- ✅ React + Vite + TanStack Router/Query frontend
- ✅ Database models and Alembic migrations
- ✅ Tailwind CSS styling

### Phase 2: Auth & User Profiles
- ✅ RS256 JWT authentication via Supabase JWKS
- ✅ User profile management (create/update)
- ✅ Protected API endpoints
- ✅ Magic link + anonymous sign-in frontend flow

### Phase 3: Trip CRUD, Itinerary & Checklists
- ✅ Trip CRUD API endpoints with member management
- ✅ Trip list page with status filter pills
- ✅ Trip detail page with edit, status transitions, members sidebar
- ✅ Day-by-day itinerary builder with activity CRUD
- ✅ Checklists with per-user check state and templates

### Phase 4: Annual Calendar
- ✅ Annual plan & calendar block API
- ✅ 12-month year grid calendar view
- ✅ PTO/holiday/trip block management
- ✅ Create blocks from calendar UI

### Phase 4.5: Maps & Geocoding
- ✅ Mapbox GL world map on dashboard with trip pins
- ✅ Trip detail map with destination + activity markers
- ✅ Geocoding autocomplete for trip destinations
- ✅ Activity locations with category-colored markers
- ✅ Dev seed page for generating comprehensive test data

### Phase 5: AI Features
- 🔲 AI itinerary generation + chat assistant + checklist generation

### Phase 6: Gmail Import
- 🔲 Gmail OAuth + AI-powered booking parsing + import review UI

### Phase 7: Integration & Deployment
- ✅ Docker images + GitHub Actions build/push pipeline
- 🔲 End-to-end integration tests + deployment config

## Docker Deployment

Docker images are built and pushed to GitHub Container Registry automatically on every merge to `main`, after CI passes.

### Images

| Image | Registry path |
|---|---|
| Backend (FastAPI/uvicorn) | `ghcr.io/morgan8889/travel-planner-backend` |
| Frontend (nginx, static) | `ghcr.io/morgan8889/travel-planner-frontend` |

Each image is tagged with:
- `latest` — most recent build from `main`
- `sha-<7-char>` — pinned to a specific commit (e.g. `sha-2ba6830`)

### Required GitHub secrets

Set these as repository secrets before the workflow will produce a working frontend image:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_MAPBOX_TOKEN` | Mapbox GL access token |

> These are baked into the frontend image at build time (Vite replaces them at compile). The backend reads its config from runtime environment variables — no build-time secrets needed.

### Pull an image

```bash
# Authenticate with GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-github-username> --password-stdin

docker pull ghcr.io/morgan8889/travel-planner-backend:latest
docker pull ghcr.io/morgan8889/travel-planner-frontend:latest

# Or pin to a specific commit
docker pull ghcr.io/morgan8889/travel-planner-backend:sha-2ba6830
```

### Run with Docker Compose

```yaml
services:
  backend:
    image: ghcr.io/morgan8889/travel-planner-backend:latest
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://user:password@db:5432/travel_planner
      SUPABASE_URL: https://your-project.supabase.co
      SUPABASE_KEY: your-anon-key

  frontend:
    image: ghcr.io/morgan8889/travel-planner-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
```

```bash
docker compose up
```

> The frontend proxies `/api` requests to the backend. In production you'll need a reverse proxy (nginx, Caddy, etc.) routing `/api` to the backend container on port `8000`.

### Database migrations

Migrations are not run automatically on container start. Run them before deploying a new backend version:

```bash
docker run --rm \
  -e DATABASE_URL=postgresql+asyncpg://user:password@host:5432/travel_planner \
  ghcr.io/morgan8889/travel-planner-backend:latest \
  uv run alembic upgrade head
```

### Working with running containers

**View logs**
```bash
docker compose logs -f backend    # stream backend logs
docker compose logs -f frontend   # stream nginx access logs
docker compose logs --tail 50     # last 50 lines from all services
```

**Open a shell inside a container**
```bash
docker compose exec backend sh    # backend (Python/uv environment)
docker compose exec frontend sh   # frontend (nginx:alpine)
```

**Run a one-off command without starting a persistent container**
```bash
# Check the installed package versions
docker run --rm ghcr.io/morgan8889/travel-planner-backend:latest uv pip list

# Inspect the built frontend files
docker run --rm ghcr.io/morgan8889/travel-planner-frontend:latest ls /usr/share/nginx/html
```

**Restart a single service**
```bash
docker compose restart backend
```

**Stop everything and remove containers**
```bash
docker compose down           # stop and remove containers
docker compose down -v        # also remove named volumes (wipes DB data)
```

**Check container health**
```bash
docker compose ps             # shows status of each service
docker inspect <container-id> --format '{{.State.Health}}'
```

### CI/CD pipeline

Defined in `.github/workflows/docker.yml`. Triggers via `workflow_run` after the **CI** workflow completes successfully on `main`. Backend and frontend images build in parallel. `GITHUB_TOKEN` is used automatically — no extra registry credentials needed.

---

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linters
4. Create a pull request

## License

[License details here]
