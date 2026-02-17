# Travel Planner

A full-stack travel planning application with AI-powered trip recommendations.

## Project Structure

```
travel-planner/
├── backend/          # FastAPI backend with Python
├── frontend/         # React + TypeScript frontend
└── MANUAL_TESTING.md # Manual testing setup guide
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
- **Authentication**: Supabase Auth

## Getting Started

### 🚀 New to this project?

**Choose your path:**
- **Quick Start**: Follow the [QUICKSTART.md](./QUICKSTART.md) checklist (15-20 min)
- **Detailed Setup**: See [MANUAL_TESTING.md](./MANUAL_TESTING.md) for comprehensive instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
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

- ✅ Uses RS256 (asymmetric) instead of HS256 (symmetric)
- ✅ Fetches public keys from JWKS endpoint automatically
- ✅ Caches JWKS keys for 1 hour
- ✅ No JWT secret needed in environment variables
- ✅ Automatic key rotation support

### Required Credentials

You only need:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key

See [MANUAL_TESTING.md](./MANUAL_TESTING.md) for detailed setup instructions.

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
npm test
```

### Code Quality

Backend:
```bash
cd backend
ruff check .
ruff format .
```

Frontend:
```bash
cd frontend
npm run lint
```

## Manual Testing

For comprehensive manual testing instructions including:
- Environment setup
- Authentication flow testing
- API endpoint testing
- Troubleshooting guide

See **[MANUAL_TESTING.md](./MANUAL_TESTING.md)**

## Database Migrations

```bash
cd backend
source .venv/bin/activate

# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## API Documentation

The backend automatically generates interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Roadmap

### Phase 1: Project Scaffolding & Database
- ✅ FastAPI backend with SQLAlchemy + asyncpg
- ✅ React + Vite + TanStack Router/Query frontend
- ✅ Database models (14 tables) and Alembic migrations
- ✅ Tailwind CSS styling

### Phase 2: Auth & User Profiles
- ✅ RS256 JWT authentication via Supabase JWKS
- ✅ User profile management (create/update)
- ✅ Protected API endpoints
- ✅ Magic link + anonymous sign-in frontend flow

### Phase 3: Trip CRUD (In Progress)
- ✅ Trip CRUD API endpoints
- ✅ Trip member management (invite, remove, roles)
- ✅ Trip list page with status filter pills
- ✅ Trip detail page with edit, status transitions, members sidebar
- ✅ New trip creation page
- 🔄 Trip dashboard tabs (Itinerary | Checklists | Chat | Imports)

### Phase 4: Annual Calendar
- 🔲 Annual plan & calendar block API
- 🔲 12-month year grid calendar view
- 🔲 PTO/holiday block management
- 🔲 Drag-to-create trips from calendar
- 🔲 Public holiday auto-detection

### Phase 5: Itinerary Builder
- 🔲 Itinerary day + activity CRUD API
- 🔲 Day-by-day timeline with drag-and-drop reorder

### Phase 6: Checklists
- 🔲 Checklist CRUD with per-user check state
- 🔲 Checklist templates (packing, documents, pre-departure)

### Phase 7: AI Features
- 🔲 AI itinerary generation + chat assistant + checklist generation

### Phase 8: Gmail Import
- 🔲 Gmail OAuth + AI-powered booking parsing + import review UI

### Phase 9: Frontend AI Polish
- 🔲 AI generate buttons in itinerary and checklist views

### Phase 10: Integration & Deployment
- 🔲 End-to-end integration tests + Docker + deployment config

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linters
4. Create a pull request

## License

[License details here]
