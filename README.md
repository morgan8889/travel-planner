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
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
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
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -e .
   uvicorn travel_planner.main:app --reload
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
source .venv/bin/activate
pytest
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

## Project Features

### Phase 1: Foundation
- ✅ Project structure setup
- ✅ Basic authentication endpoints
- ✅ Database models and migrations

### Phase 2: Auth & User Profiles (Current)
- ✅ RS256 JWT authentication
- ✅ User profile management
- ✅ Protected API endpoints
- ✅ Automated tests for auth flow

### Phase 3: Trip Planning (Upcoming)
- 🔄 Trip CRUD operations
- 🔄 Destination management
- 🔄 Activity planning

### Phase 4: AI Integration (Upcoming)
- 🔄 AI-powered trip recommendations
- 🔄 Itinerary generation
- 🔄 Smart suggestions

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linters
4. Create a pull request

## License

[License details here]
