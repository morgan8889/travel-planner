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
- 🔲 End-to-end integration tests + Docker + deployment config

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linters
4. Create a pull request

## License

[License details here]
