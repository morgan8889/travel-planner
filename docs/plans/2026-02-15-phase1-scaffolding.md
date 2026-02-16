# Phase 1: Project Scaffolding & Database — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the backend (FastAPI) and frontend (React/Vite) projects with database models, migrations, and passing tests — ready for feature development.

**Architecture:** FastAPI monolith backend with async SQLAlchemy on Postgres (via Supabase). React SPA frontend with Vite, TanStack Router/Query, and Tailwind CSS.

**Tech Stack:** Python 3.12, uv, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, React 18, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS, Vitest.

---

### Task 1: Install Prerequisites

**Files:**
- None (system-level tooling)

**Step 1: Install uv**

Run:
```bash
brew install uv
```
Expected: uv installs successfully

**Step 2: Verify uv and Python 3.12 availability**

Run:
```bash
uv --version
```
Expected: version output like `uv 0.x.x`

Run:
```bash
uv python install 3.12
uv python list | grep 3.12
```
Expected: Python 3.12 appears in the list

**Step 3: Commit — no commit needed (no project files changed)**

---

### Task 2: Initialize Backend Project

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/src/travel_planner/__init__.py`
- Create: `backend/src/travel_planner/main.py`
- Create: `backend/src/travel_planner/config.py`

**Step 1: Create directory structure**

Run:
```bash
mkdir -p backend/src/travel_planner
```

**Step 2: Create pyproject.toml**

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

**Step 3: Create __init__.py**

```python
# backend/src/travel_planner/__init__.py
```

(Empty file.)

**Step 4: Create config module**

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

**Step 5: Create FastAPI app entrypoint**

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

**Step 6: Install dependencies**

Run:
```bash
cd backend && uv sync --all-extras
```
Expected: all dependencies install, `uv.lock` is created

**Step 7: Write health check test**

Create `backend/tests/__init__.py` (empty) and:

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient

from travel_planner.main import app


def test_health_check():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

**Step 8: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest tests/test_health.py -v
```
Expected: `test_health_check PASSED` — 1 passed

**Step 9: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend project with FastAPI scaffold"
```

---

### Task 3: Database Connection Module

**Files:**
- Create: `backend/src/travel_planner/db.py`
- Create: `backend/tests/test_db.py`

**Step 1: Write failing test for db module**

```python
# backend/tests/test_db.py
from travel_planner.db import get_db, engine, async_session


def test_engine_exists():
    assert engine is not None


def test_async_session_factory_exists():
    assert async_session is not None


def test_get_db_is_async_generator():
    import inspect
    assert inspect.isasyncgenfunction(get_db)
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd backend && uv run pytest tests/test_db.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'travel_planner.db'`

**Step 3: Create db module**

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

**Step 4: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest tests/test_db.py -v
```
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/src/travel_planner/db.py backend/tests/test_db.py
git commit -m "feat: add async database connection module"
```

---

### Task 4: Database Models — User & Trip

**Files:**
- Create: `backend/src/travel_planner/models/__init__.py`
- Create: `backend/src/travel_planner/models/user.py`
- Create: `backend/src/travel_planner/models/trip.py`
- Create: `backend/tests/test_models.py`

**Step 1: Create models directory**

Run:
```bash
mkdir -p backend/src/travel_planner/models
```

**Step 2: Write failing test for user and trip models**

```python
# backend/tests/test_models.py
from travel_planner.models import Base, UserProfile, Trip, TripMember
from travel_planner.models.trip import TripType, TripStatus, MemberRole


def test_user_and_trip_models_importable():
    models = [UserProfile, Trip, TripMember]
    assert len(models) == 3


def test_base_has_user_and_trip_tables():
    table_names = Base.metadata.tables.keys()
    assert "user_profiles" in table_names
    assert "trips" in table_names
    assert "trip_members" in table_names


def test_trip_type_enum():
    assert TripType.vacation == "vacation"
    assert TripType.remote_week == "remote_week"
    assert TripType.sabbatical == "sabbatical"


def test_trip_status_enum():
    assert TripStatus.dreaming == "dreaming"
    assert TripStatus.planning == "planning"
    assert TripStatus.booked == "booked"
    assert TripStatus.active == "active"
    assert TripStatus.completed == "completed"


def test_member_role_enum():
    assert MemberRole.owner == "owner"
    assert MemberRole.member == "member"
```

**Step 3: Run test to verify it fails**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'travel_planner.models'`

**Step 4: Create user model**

```python
# backend/src/travel_planner/models/user.py
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

**Step 5: Create trip model**

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

**Step 6: Create models __init__.py**

```python
# backend/src/travel_planner/models/__init__.py
from travel_planner.models.trip import Trip, TripMember
from travel_planner.models.user import Base, UserProfile

__all__ = [
    "Base",
    "UserProfile",
    "Trip",
    "TripMember",
]
```

**Step 7: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v
```
Expected: 5 passed

**Step 8: Commit**

```bash
git add backend/src/travel_planner/models/ backend/tests/test_models.py
git commit -m "feat: add User and Trip SQLAlchemy models"
```

---

### Task 5: Database Models — Calendar

**Files:**
- Create: `backend/src/travel_planner/models/calendar.py`
- Modify: `backend/src/travel_planner/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write failing test**

Add to `backend/tests/test_models.py`:

```python
from travel_planner.models import AnnualPlan, CalendarBlock
from travel_planner.models.calendar import BlockType


def test_calendar_models_importable():
    models = [AnnualPlan, CalendarBlock]
    assert len(models) == 2


def test_calendar_tables_exist():
    table_names = Base.metadata.tables.keys()
    assert "annual_plans" in table_names
    assert "calendar_blocks" in table_names


def test_block_type_enum():
    assert BlockType.pto == "pto"
    assert BlockType.holiday == "holiday"
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v -k "calendar"
```
Expected: FAIL — `ImportError: cannot import name 'AnnualPlan'`

**Step 3: Create calendar model**

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

**Step 4: Update models __init__.py**

```python
# backend/src/travel_planner/models/__init__.py
from travel_planner.models.calendar import AnnualPlan, CalendarBlock
from travel_planner.models.trip import Trip, TripMember
from travel_planner.models.user import Base, UserProfile

__all__ = [
    "Base",
    "UserProfile",
    "Trip",
    "TripMember",
    "AnnualPlan",
    "CalendarBlock",
]
```

**Step 5: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v
```
Expected: 8 passed (5 previous + 3 new)

**Step 6: Commit**

```bash
git add backend/src/travel_planner/models/ backend/tests/test_models.py
git commit -m "feat: add AnnualPlan and CalendarBlock models"
```

---

### Task 6: Database Models — Itinerary & Activity

**Files:**
- Create: `backend/src/travel_planner/models/itinerary.py`
- Modify: `backend/src/travel_planner/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write failing test**

Add to `backend/tests/test_models.py`:

```python
from travel_planner.models import ItineraryDay, Activity
from travel_planner.models.itinerary import ActivityCategory, ActivitySource, ImportStatus


def test_itinerary_models_importable():
    models = [ItineraryDay, Activity]
    assert len(models) == 2


def test_itinerary_tables_exist():
    table_names = Base.metadata.tables.keys()
    assert "itinerary_days" in table_names
    assert "activities" in table_names


def test_activity_category_enum():
    assert ActivityCategory.transport == "transport"
    assert ActivityCategory.food == "food"
    assert ActivityCategory.activity == "activity"
    assert ActivityCategory.lodging == "lodging"


def test_activity_source_enum():
    assert ActivitySource.manual == "manual"
    assert ActivitySource.gmail_import == "gmail_import"


def test_import_status_enum():
    assert ImportStatus.pending_review == "pending_review"
    assert ImportStatus.confirmed == "confirmed"
    assert ImportStatus.rejected == "rejected"
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v -k "itinerary"
```
Expected: FAIL — `ImportError: cannot import name 'ItineraryDay'`

**Step 3: Create itinerary model**

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

**Step 4: Update models __init__.py**

```python
# backend/src/travel_planner/models/__init__.py
from travel_planner.models.calendar import AnnualPlan, CalendarBlock
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
]
```

**Step 5: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v
```
Expected: 13 passed (8 previous + 5 new)

**Step 6: Commit**

```bash
git add backend/src/travel_planner/models/ backend/tests/test_models.py
git commit -m "feat: add ItineraryDay and Activity models"
```

---

### Task 7: Database Models — Checklist, Chat, Gmail

**Files:**
- Create: `backend/src/travel_planner/models/checklist.py`
- Create: `backend/src/travel_planner/models/chat.py`
- Create: `backend/src/travel_planner/models/gmail.py`
- Modify: `backend/src/travel_planner/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write failing test**

Add to `backend/tests/test_models.py`:

```python
from travel_planner.models import (
    Checklist, ChecklistItem, ChecklistItemUser,
    ChatThread, ChatMessage,
    GmailConnection, ImportRecord,
)


def test_remaining_models_importable():
    models = [
        Checklist, ChecklistItem, ChecklistItemUser,
        ChatThread, ChatMessage,
        GmailConnection, ImportRecord,
    ]
    assert len(models) == 7


def test_all_14_tables_exist():
    table_names = set(Base.metadata.tables.keys())
    expected = {
        "user_profiles", "trips", "trip_members", "annual_plans",
        "calendar_blocks", "itinerary_days", "activities", "checklists",
        "checklist_items", "checklist_item_users", "chat_threads",
        "chat_messages", "gmail_connections", "import_records",
    }
    assert expected == table_names
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v -k "remaining or all_14"
```
Expected: FAIL — `ImportError: cannot import name 'Checklist'`

**Step 3: Create checklist model**

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

    item: Mapped["ChecklistItem"] = relationship(back_populates="user_checks")
```

**Step 4: Create chat model**

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

**Step 5: Create gmail model**

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

**Step 6: Update models __init__.py with all models**

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

**Step 7: Run all model tests to verify they pass**

Run:
```bash
cd backend && uv run pytest tests/test_models.py -v
```
Expected: 15 passed (13 previous + 2 new)

**Step 8: Commit**

```bash
git add backend/src/travel_planner/models/ backend/tests/test_models.py
git commit -m "feat: add Checklist, Chat, and Gmail models"
```

---

### Task 8: Alembic Migrations Setup

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (auto-generated)

**Step 1: Initialize Alembic**

Run:
```bash
cd backend && uv run alembic init alembic
```
Expected: creates `alembic/` directory and `alembic.ini`

**Step 2: Update alembic.ini — set sqlalchemy.url placeholder**

In `backend/alembic.ini`, find the line:
```
sqlalchemy.url = driver://user:pass@localhost/dbname
```
Replace with:
```
sqlalchemy.url = postgresql+asyncpg://localhost:5432/travel_planner
```

(This will be overridden by env.py at runtime, but keeps alembic.ini valid.)

**Step 3: Replace alembic/env.py with async version**

```python
# backend/alembic/env.py
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from travel_planner.config import settings
from travel_planner.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 4: Generate initial migration (offline mode — no DB required)**

Run:
```bash
cd backend && uv run alembic revision --autogenerate -m "initial schema"
```
Expected: creates a migration file in `backend/alembic/versions/`. Note: this may warn about no database connection but should still generate the migration based on model metadata.

If this fails because it tries to connect to the database, generate a blank migration instead:
```bash
cd backend && uv run alembic revision -m "initial schema"
```
Then manually verify the migration file exists.

**Step 5: Verify migration file was created**

Run:
```bash
ls backend/alembic/versions/*.py
```
Expected: one `.py` file with the migration

**Step 6: Commit**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "feat: add Alembic async migrations with initial schema"
```

---

### Task 9: Initialize Frontend Project

**Files:**
- Create: `frontend/` (Vite scaffold)
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`

**Step 1: Scaffold React + TypeScript + Vite**

Run:
```bash
npm create vite@latest frontend -- --template react-ts
```
Expected: creates `frontend/` with React + TypeScript template

**Step 2: Install project dependencies**

Run:
```bash
cd frontend && npm install
```
Expected: installs base dependencies

**Step 3: Install additional dependencies**

Run:
```bash
cd frontend && npm install @tanstack/react-router @tanstack/react-query @supabase/supabase-js axios
```
Expected: adds TanStack Router, TanStack Query, Supabase client, and Axios

**Step 4: Install Tailwind CSS v4 (Vite plugin)**

Run:
```bash
cd frontend && npm install tailwindcss @tailwindcss/vite
```
Expected: adds Tailwind CSS and its Vite plugin

**Step 5: Install dev dependencies**

Run:
```bash
cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```
Expected: adds testing libraries

**Step 6: Configure Vite with Tailwind and Vitest**

Replace `frontend/vite.config.ts`:

```typescript
// frontend/vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

**Step 7: Create test setup file**

```typescript
// frontend/src/test-setup.ts
import "@testing-library/jest-dom/vitest";
```

**Step 8: Set up Tailwind CSS**

Replace `frontend/src/index.css`:

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

**Step 9: Create minimal App.tsx**

```tsx
// frontend/src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Travel Planner
            </h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-gray-600">Welcome to Travel Planner</p>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
```

**Step 10: Write test**

```tsx
// frontend/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("Travel Planner")).toBeInTheDocument();
  });

  it("renders the welcome message", () => {
    render(<App />);
    expect(screen.getByText("Welcome to Travel Planner")).toBeInTheDocument();
  });
});
```

**Step 11: Run test to verify it passes**

Run:
```bash
cd frontend && npx vitest run
```
Expected: 2 tests passed

**Step 12: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with React, Vite, TanStack, Tailwind"
```

---

### Task 10: Verify Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run all backend tests**

Run:
```bash
cd backend && uv run pytest -v
```
Expected: 16 tests passed (1 health + 3 db + 12 models)

**Step 2: Run all frontend tests**

Run:
```bash
cd frontend && npx vitest run
```
Expected: 2 tests passed

**Step 3: Run backend linting**

Run:
```bash
cd backend && uv run ruff check src/ tests/
```
Expected: no errors

**Step 4: Run backend type checking**

Run:
```bash
cd backend && uv run pyright src/
```
Expected: no errors (or only warnings)

**Step 5: No commit needed — this is verification only**

---

## Summary

| Task | Description | Tests Added |
|------|------------|-------------|
| 1 | Install uv + Python 3.12 | — |
| 2 | Backend scaffold (FastAPI, config) | 1 |
| 3 | Database connection module | 3 |
| 4 | User & Trip models | 5 |
| 5 | Calendar models | 3 |
| 6 | Itinerary & Activity models | 5 |
| 7 | Checklist, Chat, Gmail models | 2 |
| 8 | Alembic migrations | — |
| 9 | Frontend scaffold (React, Vite, Tailwind) | 2 |
| 10 | Full test suite verification | — |

**Total: 10 tasks, ~21 tests, 8 commits**
