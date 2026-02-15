# Travel Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shared web-based travel planner with annual calendar, trip lifecycle management, AI assistance, and Gmail import.

**Architecture:** FastAPI monolith backend with React SPA frontend. Supabase provides Postgres, auth, and storage. Claude API powers AI features (itinerary generation, chat assistant, Gmail parsing).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic v2, Anthropic SDK, React 18, TypeScript, Vite, TanStack Router/Query, Tailwind CSS, dnd-kit, FullCalendar.

---

## Phase 1: Project Scaffolding & Database

### Task 1: Initialize Backend Project

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/src/travel_planner/__init__.py`
- Create: `backend/src/travel_planner/main.py`
- Create: `backend/src/travel_planner/config.py`

**Step 1: Create backend directory and pyproject.toml**

```bash
mkdir -p backend/src/travel_planner
```

```toml
# backend/pyproject.toml
[project]
name = "travel-planner-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.14.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "asyncpg>=0.30.0",
    "httpx>=0.28.0",
    "anthropic>=0.42.0",
    "google-api-python-client>=2.160.0",
    "google-auth-oauthlib>=1.2.0",
    "supabase>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.25.0",
    "pytest-cov>=6.0.0",
    "ruff>=0.9.0",
    "pyright>=1.1.0",
    "httpx>=0.28.0",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "standard"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Step 2: Create config module**

```python
# backend/src/travel_planner/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://localhost:5432/travel_planner"
    supabase_url: str = ""
    supabase_key: str = ""
    anthropic_api_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
```

**Step 3: Create FastAPI app entrypoint**

```python
# backend/src/travel_planner/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from travel_planner.config import settings

app = FastAPI(title="Travel Planner API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

```python
# backend/src/travel_planner/__init__.py
```

**Step 4: Install dependencies and verify**

```bash
cd backend && uv sync && uv sync --dev
```

**Step 5: Run the app to verify**

```bash
cd backend && uv run uvicorn travel_planner.main:app --reload
# GET http://localhost:8000/health → {"status": "ok"}
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend project with FastAPI scaffold"
```

---

### Task 2: Database Models

**Files:**
- Create: `backend/src/travel_planner/db.py`
- Create: `backend/src/travel_planner/models/__init__.py`
- Create: `backend/src/travel_planner/models/user.py`
- Create: `backend/src/travel_planner/models/trip.py`
- Create: `backend/src/travel_planner/models/itinerary.py`
- Create: `backend/src/travel_planner/models/checklist.py`
- Create: `backend/src/travel_planner/models/chat.py`
- Create: `backend/src/travel_planner/models/gmail.py`
- Create: `backend/src/travel_planner/models/calendar.py`

**Step 1: Create database connection module**

```python
# backend/src/travel_planner/db.py
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from travel_planner.config import settings

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

**Step 2: Create all model files**

```python
# backend/src/travel_planner/models/__init__.py
from travel_planner.models.calendar import AnnualPlan, CalendarBlock
from travel_planner.models.chat import ChatMessage, ChatThread
from travel_planner.models.checklist import Checklist, ChecklistItem, ChecklistItemUser
from travel_planner.models.gmail import GmailConnection, ImportRecord
from travel_planner.models.itinerary import Activity, ItineraryDay
from travel_planner.models.trip import Trip, TripMember
from travel_planner.models.user import Base, UserProfile

__all__ = [
    "Base",
    "UserProfile",
    "Trip",
    "TripMember",
    "AnnualPlan",
    "CalendarBlock",
    "ItineraryDay",
    "Activity",
    "Checklist",
    "ChecklistItem",
    "ChecklistItemUser",
    "ChatThread",
    "ChatMessage",
    "GmailConnection",
    "ImportRecord",
]
```

```python
# backend/src/travel_planner/models/user.py
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

```python
# backend/src/travel_planner/models/trip.py
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.user import Base


class TripType(str, enum.Enum):
    vacation = "vacation"
    remote_week = "remote_week"
    sabbatical = "sabbatical"


class TripStatus(str, enum.Enum):
    dreaming = "dreaming"
    planning = "planning"
    booked = "booked"
    active = "active"
    completed = "completed"


class MemberRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    type: Mapped[TripType] = mapped_column(Enum(TripType))
    destination: Mapped[str] = mapped_column(String(255))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus), default=TripStatus.dreaming
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    members: Mapped[list["TripMember"]] = relationship(back_populates="trip")
    children: Mapped[list["Trip"]] = relationship(back_populates="parent")
    parent: Mapped["Trip | None"] = relationship(
        back_populates="children", remote_side=[id]
    )


class TripMember(Base):
    __tablename__ = "trip_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole))

    trip: Mapped["Trip"] = relationship(back_populates="members")
```

```python
# backend/src/travel_planner/models/itinerary.py
import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.user import Base


class ActivityCategory(str, enum.Enum):
    transport = "transport"
    food = "food"
    activity = "activity"
    lodging = "lodging"


class ActivitySource(str, enum.Enum):
    manual = "manual"
    gmail_import = "gmail_import"


class ImportStatus(str, enum.Enum):
    pending_review = "pending_review"
    confirmed = "confirmed"
    rejected = "rejected"


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id")
    )
    date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    activities: Mapped[list["Activity"]] = relationship(
        back_populates="itinerary_day", order_by="Activity.sort_order"
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    itinerary_day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("itinerary_days.id")
    )
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[ActivityCategory] = mapped_column(Enum(ActivityCategory))
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmation_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[ActivitySource] = mapped_column(
        Enum(ActivitySource), default=ActivitySource.manual
    )
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    import_status: Mapped[ImportStatus | None] = mapped_column(
        Enum(ImportStatus), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    itinerary_day: Mapped["ItineraryDay"] = relationship(back_populates="activities")
```

```python
# backend/src/travel_planner/models/checklist.py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.user import Base


class Checklist(Base):
    __tablename__ = "checklists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id")
    )
    title: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="checklist", order_by="ChecklistItem.sort_order"
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    checklist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklists.id")
    )
    text: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    checklist: Mapped["Checklist"] = relationship(back_populates="items")
    user_checks: Mapped[list["ChecklistItemUser"]] = relationship(
        back_populates="item"
    )


class ChecklistItemUser(Base):
    __tablename__ = "checklist_item_users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklist_items.id")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
```

```python
# backend/src/travel_planner/models/chat.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.user import Base


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="thread", order_by="ChatMessage.created_at"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id")
    )
    role: Mapped[str] = mapped_column(String(20))  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    thread: Mapped["ChatThread"] = relationship(back_populates="messages")
```

```python
# backend/src/travel_planner/models/gmail.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from travel_planner.models.user import Base


class GmailConnection(Base):
    __tablename__ = "gmail_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), unique=True
    )
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    token_expiry: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ImportRecord(Base):
    __tablename__ = "import_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    email_id: Mapped[str] = mapped_column(String(255), unique=True)
    parsed_data: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

```python
# backend/src/travel_planner/models/calendar.py
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from travel_planner.models.user import Base


class BlockType(str, enum.Enum):
    pto = "pto"
    holiday = "holiday"


class AnnualPlan(Base):
    __tablename__ = "annual_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id")
    )
    year: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CalendarBlock(Base):
    __tablename__ = "calendar_blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    annual_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annual_plans.id")
    )
    type: Mapped[BlockType] = mapped_column(Enum(BlockType))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    destination: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Step 3: Write test to verify models load**

```python
# backend/tests/__init__.py
```

```python
# backend/tests/test_models.py
from travel_planner.models import (
    Activity,
    AnnualPlan,
    Base,
    CalendarBlock,
    ChatMessage,
    ChatThread,
    Checklist,
    ChecklistItem,
    ChecklistItemUser,
    GmailConnection,
    ImportRecord,
    ItineraryDay,
    Trip,
    TripMember,
    UserProfile,
)


def test_all_models_importable():
    models = [
        UserProfile, Trip, TripMember, AnnualPlan, CalendarBlock,
        ItineraryDay, Activity, Checklist, ChecklistItem, ChecklistItemUser,
        ChatThread, ChatMessage, GmailConnection, ImportRecord,
    ]
    assert len(models) == 14


def test_base_has_metadata():
    table_names = Base.metadata.tables.keys()
    expected = {
        "user_profiles", "trips", "trip_members", "annual_plans",
        "calendar_blocks", "itinerary_days", "activities", "checklists",
        "checklist_items", "checklist_item_users", "chat_threads",
        "chat_messages", "gmail_connections", "import_records",
    }
    assert expected == set(table_names)
```

**Step 4: Run tests**

```bash
cd backend && uv run pytest tests/test_models.py -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add SQLAlchemy database models for all entities"
```

---

### Task 3: Alembic Migrations Setup

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/` (auto-generated)

**Step 1: Initialize Alembic**

```bash
cd backend && uv run alembic init alembic
```

**Step 2: Update alembic/env.py to use our models and async engine**

Replace the generated `env.py` with async support that imports `Base.metadata` from `travel_planner.models`. Set `sqlalchemy.url` from `settings.database_url`.

**Step 3: Generate initial migration**

```bash
cd backend && uv run alembic revision --autogenerate -m "initial schema"
```

**Step 4: Verify migration file was created**

Check `backend/alembic/versions/` contains the migration.

**Step 5: Commit**

```bash
git add backend/alembic* backend/alembic.ini
git commit -m "feat: add Alembic migrations with initial schema"
```

---

### Task 4: Initialize Frontend Project

**Files:**
- Create: `frontend/` (Vite scaffold)
- Modify: `frontend/package.json` (add dependencies)
- Create: `frontend/src/App.tsx`
- Create: `frontend/tailwind.config.ts`

**Step 1: Scaffold React + TypeScript + Vite**

```bash
npm create vite@latest frontend -- --template react-ts
```

**Step 2: Install dependencies**

```bash
cd frontend && npm install @tanstack/react-router @tanstack/react-query tailwindcss @tailwindcss/vite axios
npm install -D @types/node vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 3: Configure Tailwind**

Set up `tailwind.config.ts` and add Tailwind directives to `src/index.css`.

**Step 4: Configure Vitest**

Add vitest config to `vite.config.ts`.

**Step 5: Create a minimal App.tsx with TanStack Router and Query providers**

Basic shell with a health check to confirm backend connectivity.

**Step 6: Write test to verify app renders**

```typescript
// frontend/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app", () => {
  render(<App />);
  expect(screen.getByText(/travel planner/i)).toBeInTheDocument();
});
```

**Step 7: Run test**

```bash
cd frontend && npx vitest run
```
Expected: PASS

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with React, Vite, TanStack, Tailwind"
```

---

## Phase 2: Auth & User Profiles

### Task 5: Supabase Auth Integration (Backend)

**Files:**
- Create: `backend/src/travel_planner/auth.py`
- Create: `backend/src/travel_planner/routers/__init__.py`
- Create: `backend/src/travel_planner/routers/auth.py`
- Create: `backend/tests/test_auth.py`

**Step 1: Write failing test for auth dependency**

Test that a request without a valid JWT returns 401.

**Step 2: Implement auth dependency**

Create a FastAPI dependency that extracts the Supabase JWT from the Authorization header, verifies it, and returns the user ID.

**Step 3: Create auth router**

Endpoints: `POST /auth/profile` (create/update profile), `GET /auth/me` (get current user profile).

**Step 4: Write tests for profile endpoints**

Test profile creation and retrieval with mocked auth.

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add Supabase JWT auth and user profile endpoints"
```

---

### Task 6: Auth Frontend (Login/Signup)

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/AuthForm.tsx`
- Create: `frontend/src/hooks/useAuth.ts`

**Step 1: Configure Supabase client**

Initialize `@supabase/supabase-js` with env vars for URL and anon key.

**Step 2: Create useAuth hook**

Manages auth state, magic link login, logout, session refresh.

**Step 3: Create AuthForm component**

Email input → sends magic link → shows "check your email" message.

**Step 4: Create API client**

Axios instance that attaches the Supabase JWT to all requests.

**Step 5: Write test for AuthForm rendering**

**Step 6: Run tests, verify pass**

**Step 7: Commit**

```bash
git commit -m "feat: add magic link auth flow with Supabase"
```

---

## Phase 3: Trip CRUD

### Task 7: Trip API Endpoints

**Files:**
- Create: `backend/src/travel_planner/routers/trips.py`
- Create: `backend/src/travel_planner/schemas/trip.py`
- Create: `backend/tests/test_trips.py`

**Step 1: Write failing test for trip creation**

```python
async def test_create_trip(client, auth_headers):
    response = await client.post("/trips", json={
        "type": "vacation",
        "destination": "Tokyo",
        "start_date": "2026-04-01",
        "end_date": "2026-04-10",
    }, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["destination"] == "Tokyo"
```

**Step 2: Create Pydantic schemas for trip CRUD**

`TripCreate`, `TripUpdate`, `TripResponse` schemas.

**Step 3: Implement trip router**

Endpoints: `POST /trips`, `GET /trips`, `GET /trips/{id}`, `PATCH /trips/{id}`, `DELETE /trips/{id}`.

- Creating a trip auto-adds the creator as owner in `trip_members`.
- `GET /trips` returns only trips where the user is a member.
- `DELETE` only allowed for owner role.

**Step 4: Write tests for all CRUD operations**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add trip CRUD API endpoints"
```

---

### Task 8: Trip Member Management

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py`
- Create: `backend/src/travel_planner/schemas/member.py`
- Create: `backend/tests/test_members.py`

**Step 1: Write failing test for inviting a member**

**Step 2: Add endpoints**

`POST /trips/{id}/members` (invite by email), `DELETE /trips/{id}/members/{user_id}` (remove member, owner only), `GET /trips/{id}/members`.

**Step 3: Write tests for invite, remove, list**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add trip member invite and management endpoints"
```

---

### Task 9: Trip Frontend Pages

**Files:**
- Create: `frontend/src/routes/trips/index.tsx` (trip list)
- Create: `frontend/src/routes/trips/$tripId.tsx` (trip dashboard)
- Create: `frontend/src/components/TripCard.tsx`
- Create: `frontend/src/components/CreateTripModal.tsx`

**Step 1: Create trip list page**

Fetches `GET /trips`, displays as cards. "New Trip" button opens modal.

**Step 2: Create trip modal**

Form: type (vacation/remote_week/sabbatical), destination, dates, status. Posts to `POST /trips`.

**Step 3: Create trip dashboard shell**

Tab layout: Itinerary | Checklists | Chat | Imports. Shows trip header with destination, dates, status, members, countdown.

**Step 4: Write tests for trip list and modal**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add trip list, creation modal, and dashboard pages"
```

---

## Phase 4: Annual Calendar

### Task 10: Annual Plan & Calendar Block API

**Files:**
- Create: `backend/src/travel_planner/routers/calendar.py`
- Create: `backend/src/travel_planner/schemas/calendar.py`
- Create: `backend/tests/test_calendar.py`

**Step 1: Write failing test for annual plan creation**

**Step 2: Implement endpoints**

- `POST /calendar/plans` — create annual plan for year
- `GET /calendar/plans/{year}` — get plan with all blocks and trips for that year
- `POST /calendar/blocks` — create PTO/holiday block
- `PATCH /calendar/blocks/{id}` — update block
- `DELETE /calendar/blocks/{id}` — remove block

The `GET` endpoint also returns the user's trips for that year (joined from trips table via trip_members).

**Step 3: Write tests for all endpoints**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add annual plan and calendar block API endpoints"
```

---

### Task 11: Annual Calendar Frontend

**Files:**
- Create: `frontend/src/routes/index.tsx` (home = calendar)
- Create: `frontend/src/components/AnnualCalendar.tsx`
- Create: `frontend/src/components/CalendarBlock.tsx`
- Create: `frontend/src/hooks/useCalendar.ts`

**Step 1: Create useCalendar hook**

Fetches annual plan data, manages block creation/deletion.

**Step 2: Create AnnualCalendar component**

12-month year view. Each month shows days as a grid. Trips, remote weeks, sabbaticals, PTO, holidays rendered as colored blocks spanning their date ranges. Color coding by type.

**Step 3: Add drag-to-create**

Click and drag on empty days to create a new trip or PTO block (type selector popup).

**Step 4: Add holiday auto-detection**

Fetch public holidays for the user's country and display them.

**Step 5: Write tests for calendar rendering**

**Step 6: Run tests, verify pass**

**Step 7: Commit**

```bash
git commit -m "feat: add annual calendar view with drag-to-create"
```

---

## Phase 5: Itinerary Builder

### Task 12: Itinerary API

**Files:**
- Create: `backend/src/travel_planner/routers/itinerary.py`
- Create: `backend/src/travel_planner/schemas/itinerary.py`
- Create: `backend/tests/test_itinerary.py`

**Step 1: Write failing tests**

**Step 2: Implement endpoints**

- `GET /trips/{id}/itinerary` — returns all days with activities for a trip
- `POST /trips/{id}/itinerary/days` — create itinerary day
- `POST /itinerary/days/{day_id}/activities` — add activity
- `PATCH /activities/{id}` — update activity
- `DELETE /activities/{id}` — remove activity
- `PATCH /itinerary/days/{day_id}/reorder` — reorder activities (accepts ordered list of activity IDs)

Auto-create itinerary days for all dates in the trip range when first accessed.

**Step 3: Write tests for all operations**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add itinerary and activity CRUD endpoints"
```

---

### Task 13: Itinerary Frontend

**Files:**
- Create: `frontend/src/components/ItineraryView.tsx`
- Create: `frontend/src/components/DayTimeline.tsx`
- Create: `frontend/src/components/ActivityCard.tsx`
- Create: `frontend/src/components/AddActivityModal.tsx`

**Step 1: Create ItineraryView**

Day-by-day layout. Each day is a column or card with its activities in timeline order. For remote_week trips, show a "work block" (9am-5pm visual indicator).

**Step 2: Create ActivityCard**

Shows: time, title, category icon, location, confirmation number. Click to edit. Import badge if source is gmail_import.

**Step 3: Create AddActivityModal**

Form: title, category, time, location, notes, confirmation number.

**Step 4: Add drag-and-drop reorder**

Use dnd-kit to reorder activities within a day and move between days. On drop, call `PATCH /itinerary/days/{day_id}/reorder`.

**Step 5: Write tests**

**Step 6: Run tests, verify pass**

**Step 7: Commit**

```bash
git commit -m "feat: add itinerary builder with drag-and-drop"
```

---

## Phase 6: Checklists

### Task 14: Checklist API

**Files:**
- Create: `backend/src/travel_planner/routers/checklists.py`
- Create: `backend/src/travel_planner/schemas/checklist.py`
- Create: `backend/tests/test_checklists.py`

**Step 1: Write failing tests**

**Step 2: Implement endpoints**

- `GET /trips/{id}/checklists` — list checklists for trip
- `POST /trips/{id}/checklists` — create checklist
- `POST /checklists/{id}/items` — add item
- `PATCH /checklists/items/{id}/check` — toggle per-user check (body: `{checked: bool}`)
- `DELETE /checklists/{id}` — delete checklist

**Step 3: Write tests**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add checklist CRUD with per-user check state"
```

---

### Task 15: Checklist Frontend

**Files:**
- Create: `frontend/src/components/ChecklistView.tsx`
- Create: `frontend/src/components/ChecklistCard.tsx`

**Step 1: Create ChecklistView**

Shows all checklists for a trip. "New Checklist" button. Template selector (packing, documents, pre-departure).

**Step 2: Create ChecklistCard**

Checklist title with items. Each item has a per-user checkbox. Shows other members' check status as small avatars.

**Step 3: Write tests**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add checklist UI with per-user checkboxes"
```

---

## Phase 7: AI Features

### Task 16: AI Service Layer

**Files:**
- Create: `backend/src/travel_planner/services/__init__.py`
- Create: `backend/src/travel_planner/services/ai.py`
- Create: `backend/tests/test_ai_service.py`

**Step 1: Write failing test for itinerary generation**

Mock the Anthropic client. Test that given a destination, dates, preferences, and trip type, the service returns structured itinerary data.

**Step 2: Implement AI service**

```python
# Core class with three methods:
class AIService:
    async def generate_itinerary(self, trip, preferences) -> list[dict]: ...
    async def chat(self, thread_messages, trip_context, user_message) -> str: ...
    async def parse_email(self, email_content) -> dict | None: ...
```

Each method uses the Anthropic SDK with a tailored system prompt. `generate_itinerary` returns structured JSON (list of days with activities). `chat` returns text (may include tool-use for creating activities). `parse_email` extracts booking data or returns None if not a booking.

**Step 3: Write tests for all three methods with mocked API responses**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add AI service layer for itinerary, chat, and email parsing"
```

---

### Task 17: AI Itinerary Generation Endpoint

**Files:**
- Modify: `backend/src/travel_planner/routers/itinerary.py`
- Create: `backend/tests/test_itinerary_ai.py`

**Step 1: Write failing test**

`POST /trips/{id}/itinerary/generate` → returns generated itinerary days with activities.

**Step 2: Implement endpoint**

Calls `AIService.generate_itinerary()` with trip data and user preferences. Creates ItineraryDay and Activity records from the response. For remote_week trips, passes work hours constraint to the AI.

**Step 3: Write tests**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add AI itinerary generation endpoint"
```

---

### Task 18: AI Chat Endpoint

**Files:**
- Create: `backend/src/travel_planner/routers/chat.py`
- Create: `backend/src/travel_planner/schemas/chat.py`
- Create: `backend/tests/test_chat.py`

**Step 1: Write failing tests**

**Step 2: Implement endpoints**

- `POST /trips/{id}/chat` — send message, get AI response. Creates ChatThread if none exists. Stores both user message and AI response. Injects trip context (destination, dates, itinerary, members) into system prompt.
- `GET /trips/{id}/chat` — get conversation history.

**Step 3: Implement activity creation from chat**

The AI system prompt includes a tool definition for "add_activity". When the AI response includes a tool call, the endpoint creates the Activity and returns a confirmation message.

**Step 4: Write tests for chat flow and activity creation**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add AI chat endpoint with activity creation tool"
```

---

### Task 19: AI Chat Frontend

**Files:**
- Create: `frontend/src/components/ChatView.tsx`
- Create: `frontend/src/components/ChatMessage.tsx`

**Step 1: Create ChatView**

Chat interface within the trip dashboard. Message list with input box. Shows conversation history on load. Sends messages to `POST /trips/{id}/chat`. Displays AI responses with markdown rendering.

**Step 2: Create ChatMessage**

Renders user and assistant messages differently. When an activity was created from chat, shows a clickable confirmation card linking to the itinerary day.

**Step 3: Write tests**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add AI chat UI with activity creation feedback"
```

---

### Task 20: AI Checklist Generation

**Files:**
- Modify: `backend/src/travel_planner/services/ai.py`
- Modify: `backend/src/travel_planner/routers/checklists.py`
- Create: `backend/tests/test_checklist_ai.py`

**Step 1: Write failing test**

`POST /trips/{id}/checklists/generate` with body `{type: "packing"}` → returns a checklist with items.

**Step 2: Add generate_checklist method to AIService**

Takes trip destination, dates, trip type, and checklist type. Returns structured checklist items.

**Step 3: Implement endpoint**

Creates Checklist and ChecklistItem records from AI response.

**Step 4: Write tests**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add AI checklist generation endpoint"
```

---

## Phase 8: Gmail Import

### Task 21: Gmail OAuth Flow

**Files:**
- Create: `backend/src/travel_planner/routers/gmail.py`
- Create: `backend/src/travel_planner/services/gmail.py`
- Create: `backend/tests/test_gmail.py`

**Step 1: Write failing tests**

**Step 2: Implement OAuth endpoints**

- `GET /gmail/auth-url` — returns Google OAuth URL for Gmail read-only scope
- `POST /gmail/callback` — exchanges auth code for tokens, stores GmailConnection
- `GET /gmail/status` — returns connection status and last sync time
- `DELETE /gmail/disconnect` — removes GmailConnection

**Step 3: Write tests with mocked Google OAuth**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add Gmail OAuth connection flow"
```

---

### Task 22: Gmail Import Service

**Files:**
- Modify: `backend/src/travel_planner/services/gmail.py`
- Create: `backend/tests/test_gmail_import.py`

**Step 1: Write failing tests**

**Step 2: Implement email scanning and parsing**

```python
class GmailService:
    async def sync_bookings(self, user_id: uuid.UUID) -> list[Activity]:
        # 1. Fetch new emails since last_sync_at
        # 2. Filter for travel-related subjects
        # 3. For each email, call AIService.parse_email()
        # 4. For parsed bookings, match to existing trips by date/destination
        # 5. Create Activities with source=gmail_import, import_status=pending_review
        # 6. Create ImportRecord for each processed email
        # 7. Update last_sync_at
```

**Step 3: Add sync endpoint**

`POST /gmail/sync` — triggers a sync for the current user. Returns list of newly imported activities.

**Step 4: Write tests with mocked Gmail API and AI service**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add Gmail booking import with AI parsing"
```

---

### Task 23: Import Review Frontend

**Files:**
- Create: `frontend/src/components/ImportReview.tsx`
- Create: `frontend/src/components/ImportCard.tsx`

**Step 1: Create ImportReview**

Tab in trip dashboard showing pending imports. "Sync Now" button. List of imported activities awaiting review.

**Step 2: Create ImportCard**

Shows parsed booking details: type, dates, location, confirmation number. "Accept" assigns to trip (sets import_status=confirmed). "Reject" dismisses (sets import_status=rejected). Trip auto-match suggestion shown if applicable.

**Step 3: Add Gmail connection settings**

Settings page or modal: "Connect Gmail" button → OAuth flow. Shows connection status.

**Step 4: Write tests**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add Gmail import review UI"
```

---

## Phase 9: Itinerary Generation Frontend + Polish

### Task 24: AI Generate Button in Itinerary

**Files:**
- Modify: `frontend/src/components/ItineraryView.tsx`
- Create: `frontend/src/components/GenerateItineraryModal.tsx`

**Step 1: Add "AI Generate" button to ItineraryView**

Shows when itinerary is empty or as a toolbar action.

**Step 2: Create GenerateItineraryModal**

Confirmation dialog showing: destination, dates, trip type, user preferences. "Generate" button calls `POST /trips/{id}/itinerary/generate`. Shows loading state. On success, refreshes itinerary view with generated content.

**Step 3: Write tests**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add AI itinerary generation UI"
```

---

### Task 25: AI Generate Button in Checklists

**Files:**
- Modify: `frontend/src/components/ChecklistView.tsx`
- Create: `frontend/src/components/GenerateChecklistModal.tsx`

**Step 1: Add "AI Generate" option to checklist creation**

Template selector includes: "AI-generated packing list", "AI-generated prep checklist" alongside manual creation.

**Step 2: Create GenerateChecklistModal**

Shows checklist type options. "Generate" calls `POST /trips/{id}/checklists/generate`. Loading state, then displays generated checklist.

**Step 3: Write tests**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add AI checklist generation UI"
```

---

## Phase 10: Integration & Deployment

### Task 26: End-to-End Integration Tests

**Files:**
- Create: `backend/tests/test_integration.py`

**Step 1: Write integration test for full trip lifecycle**

Create user → create annual plan → create trip → generate itinerary → add manual activity → create checklist → send chat message → verify all data.

**Step 2: Write integration test for Gmail import flow**

Mock Gmail API → sync → review imports → accept/reject → verify activities.

**Step 3: Run all tests**

```bash
cd backend && uv run pytest --cov=travel_planner -v
cd frontend && npx vitest run
```

**Step 4: Fix any failures**

**Step 5: Commit**

```bash
git commit -m "test: add end-to-end integration tests"
```

---

### Task 27: Environment & Deployment Configuration

**Files:**
- Create: `.env.example`
- Create: `backend/Dockerfile`
- Create: `frontend/vercel.json`
- Create: `docker-compose.yml` (local dev)

**Step 1: Create .env.example**

Document all required environment variables.

**Step 2: Create backend Dockerfile**

Python 3.12, install via uv, run uvicorn.

**Step 3: Create docker-compose for local dev**

Backend + Supabase local (via supabase CLI) for development.

**Step 4: Create vercel.json for frontend**

Configure build and rewrites for SPA routing.

**Step 5: Test local docker-compose up**

**Step 6: Commit**

```bash
git commit -m "feat: add deployment configuration"
```

---

### Task 28: CLAUDE.md Project Configuration

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write project-specific CLAUDE.md**

Document: project structure, how to run backend/frontend, how to run tests, key conventions, environment setup instructions.

**Step 2: Commit**

```bash
git commit -m "docs: add project CLAUDE.md"
```
