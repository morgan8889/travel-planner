# Phase 3: Itinerary & Checklists Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement full CRUD APIs and frontend UI for trip itineraries (daily activities) and checklists (trip preparation tasks).

**Architecture:** Two independent feature sets sharing the existing trip context. Itinerary provides day-by-day activity scheduling with categorization. Checklists provide collaborative trip preparation with per-user completion tracking.

**Tech Stack:** FastAPI routers, SQLAlchemy models (existing), Pydantic schemas, React components, TanStack Query, Vitest/pytest

---

## Task 1: Itinerary API - List Days

**Files:**
- Create: `backend/src/travel_planner/schemas/itinerary.py`
- Create: `backend/src/travel_planner/routers/itinerary.py`
- Modify: `backend/src/travel_planner/main.py:12` (add router)
- Test: `backend/tests/test_itinerary.py`

**Step 1: Write the failing test**

Create `backend/tests/test_itinerary.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_itinerary_days_empty(client: AsyncClient, auth_headers: dict, trip_id: str):
    """List itinerary days for trip with no days returns empty list"""
    response = await client.get(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_itinerary_days_not_member(client: AsyncClient, other_user_headers: dict, trip_id: str):
    """Non-member cannot list itinerary days"""
    response = await client.get(
        f"/itinerary/trips/{trip_id}/days",
        headers=other_user_headers
    )
    assert response.status_code == 403
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_itinerary.py::test_list_itinerary_days_empty -v`

Expected: FAIL with "No module named 'travel_planner.routers.itinerary'"

**Step 3: Create Pydantic schemas**

Create `backend/src/travel_planner/schemas/itinerary.py`:

```python
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class ItineraryDayResponse(BaseModel):
    id: UUID
    trip_id: UUID
    date: date
    notes: str | None
    activity_count: int

    class Config:
        from_attributes = True
```

**Step 4: Write minimal implementation**

Create `backend/src/travel_planner/routers/itinerary.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import get_current_user
from travel_planner.db import get_db
from travel_planner.models.itinerary import ItineraryDay
from travel_planner.models.trip import Trip, TripMember
from travel_planner.models.user import UserProfile
from travel_planner.schemas.itinerary import ItineraryDayResponse

router = APIRouter(prefix="/itinerary", tags=["itinerary"])


async def verify_trip_member(
    trip_id: UUID,
    db: AsyncSession,
    current_user: UserProfile
) -> Trip:
    """Verify user is member of trip, return trip"""
    result = await db.execute(
        select(Trip)
        .join(TripMember)
        .where(Trip.id == trip_id)
        .where(TripMember.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=403, detail="Not a member of this trip")
    return trip


@router.get("/trips/{trip_id}/days", response_model=list[ItineraryDayResponse])
async def list_itinerary_days(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """List all itinerary days for a trip"""
    await verify_trip_member(trip_id, db, current_user)

    result = await db.execute(
        select(
            ItineraryDay,
            func.count(Activity.id).label("activity_count")
        )
        .outerjoin(Activity)
        .where(ItineraryDay.trip_id == trip_id)
        .group_by(ItineraryDay.id)
        .order_by(ItineraryDay.date)
    )

    days = []
    for day, activity_count in result:
        days.append(
            ItineraryDayResponse(
                id=day.id,
                trip_id=day.trip_id,
                date=day.date,
                notes=day.notes,
                activity_count=activity_count or 0
            )
        )
    return days
```

**Step 5: Add missing import**

Update the router to import Activity:

```python
from travel_planner.models.itinerary import Activity, ItineraryDay
```

**Step 6: Register router in main**

Modify `backend/src/travel_planner/main.py`:

```python
from travel_planner.routers import auth, itinerary, trips

# ... existing code ...

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(itinerary.router)
```

**Step 7: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_itinerary.py -v`

Expected: 2 PASSED

**Step 8: Commit**

```bash
git add backend/src/travel_planner/schemas/itinerary.py \
        backend/src/travel_planner/routers/itinerary.py \
        backend/src/travel_planner/main.py \
        backend/tests/test_itinerary.py
git commit -m "feat: add itinerary days list API endpoint

- Add ItineraryDayResponse schema with activity count
- Add verify_trip_member helper for access control
- Add GET /itinerary/trips/{trip_id}/days endpoint
- Test member-only access and empty list"
```

---

## Task 2: Itinerary API - Create Day

**Files:**
- Modify: `backend/src/travel_planner/schemas/itinerary.py`
- Modify: `backend/src/travel_planner/routers/itinerary.py`
- Modify: `backend/tests/test_itinerary.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_itinerary.py`:

```python
@pytest.mark.asyncio
async def test_create_itinerary_day(client: AsyncClient, auth_headers: dict, trip_id: str):
    """Create itinerary day for trip"""
    response = await client.post(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers,
        json={
            "date": "2026-07-15",
            "notes": "Arrival day"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["date"] == "2026-07-15"
    assert data["notes"] == "Arrival day"
    assert data["activity_count"] == 0
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_itinerary.py::test_create_itinerary_day -v`

Expected: FAIL with 404 or 405

**Step 3: Add schema**

Add to `backend/src/travel_planner/schemas/itinerary.py`:

```python
class ItineraryDayCreate(BaseModel):
    date: date
    notes: str | None = None
```

**Step 4: Implement endpoint**

Add to `backend/src/travel_planner/routers/itinerary.py`:

```python
from travel_planner.schemas.itinerary import ItineraryDayCreate, ItineraryDayResponse


@router.post("/trips/{trip_id}/days", response_model=ItineraryDayResponse, status_code=201)
async def create_itinerary_day(
    trip_id: UUID,
    day_data: ItineraryDayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Create a new itinerary day"""
    await verify_trip_member(trip_id, db, current_user)

    day = ItineraryDay(
        trip_id=trip_id,
        date=day_data.date,
        notes=day_data.notes
    )
    db.add(day)
    await db.commit()
    await db.refresh(day)

    return ItineraryDayResponse(
        id=day.id,
        trip_id=day.trip_id,
        date=day.date,
        notes=day.notes,
        activity_count=0
    )
```

**Step 5: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_itinerary.py::test_create_itinerary_day -v`

Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/travel_planner/schemas/itinerary.py \
        backend/src/travel_planner/routers/itinerary.py \
        backend/tests/test_itinerary.py
git commit -m "feat: add create itinerary day endpoint

- Add ItineraryDayCreate schema
- Add POST /itinerary/trips/{trip_id}/days endpoint
- Test successful day creation"
```

---

## Task 3: Itinerary API - Activities CRUD

**Files:**
- Modify: `backend/src/travel_planner/schemas/itinerary.py`
- Modify: `backend/src/travel_planner/routers/itinerary.py`
- Modify: `backend/tests/test_itinerary.py`

**Step 1: Write the failing tests**

Add to `backend/tests/test_itinerary.py`:

```python
@pytest.mark.asyncio
async def test_create_activity(
    client: AsyncClient,
    auth_headers: dict,
    trip_id: str,
    itinerary_day_id: str
):
    """Create activity for itinerary day"""
    response = await client.post(
        f"/itinerary/days/{itinerary_day_id}/activities",
        headers=auth_headers,
        json={
            "title": "Flight to Paris",
            "category": "transport",
            "start_time": "14:30:00",
            "end_time": "17:45:00",
            "location": "CDG Airport",
            "notes": "Air France AF123",
            "confirmation_number": "ABC123"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Flight to Paris"
    assert data["category"] == "transport"


@pytest.mark.asyncio
async def test_list_activities(
    client: AsyncClient,
    auth_headers: dict,
    itinerary_day_id: str
):
    """List activities for itinerary day"""
    response = await client.get(
        f"/itinerary/days/{itinerary_day_id}/activities",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_update_activity(
    client: AsyncClient,
    auth_headers: dict,
    activity_id: str
):
    """Update activity"""
    response = await client.patch(
        f"/itinerary/activities/{activity_id}",
        headers=auth_headers,
        json={"title": "Updated title", "notes": "Updated notes"}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"


@pytest.mark.asyncio
async def test_delete_activity(
    client: AsyncClient,
    auth_headers: dict,
    activity_id: str
):
    """Delete activity"""
    response = await client.delete(
        f"/itinerary/activities/{activity_id}",
        headers=auth_headers
    )
    assert response.status_code == 204
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_itinerary.py -k activity -v`

Expected: Multiple FAILs

**Step 3: Add schemas**

Add to `backend/src/travel_planner/schemas/itinerary.py`:

```python
from datetime import time
from travel_planner.models.itinerary import ActivityCategory


class ActivityCreate(BaseModel):
    title: str
    category: ActivityCategory
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    notes: str | None = None
    confirmation_number: str | None = None


class ActivityUpdate(BaseModel):
    title: str | None = None
    category: ActivityCategory | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    notes: str | None = None
    confirmation_number: str | None = None
    sort_order: int | None = None


class ActivityResponse(BaseModel):
    id: UUID
    itinerary_day_id: UUID
    title: str
    category: ActivityCategory
    start_time: time | None
    end_time: time | None
    location: str | None
    notes: str | None
    confirmation_number: str | None
    sort_order: int

    class Config:
        from_attributes = True
```

**Step 4: Implement endpoints**

Add to `backend/src/travel_planner/routers/itinerary.py`:

```python
from travel_planner.schemas.itinerary import (
    ActivityCreate,
    ActivityResponse,
    ActivityUpdate,
    ItineraryDayCreate,
    ItineraryDayResponse,
)


async def verify_day_access(
    day_id: UUID,
    db: AsyncSession,
    current_user: UserProfile
) -> ItineraryDay:
    """Verify user has access to itinerary day via trip membership"""
    result = await db.execute(
        select(ItineraryDay)
        .join(Trip, ItineraryDay.trip_id == Trip.id)
        .join(TripMember)
        .where(ItineraryDay.id == day_id)
        .where(TripMember.user_id == current_user.id)
    )
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=403, detail="Not a member of this trip")
    return day


@router.post("/days/{day_id}/activities", response_model=ActivityResponse, status_code=201)
async def create_activity(
    day_id: UUID,
    activity_data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Create activity for itinerary day"""
    await verify_day_access(day_id, db, current_user)

    # Get max sort_order
    result = await db.execute(
        select(func.max(Activity.sort_order))
        .where(Activity.itinerary_day_id == day_id)
    )
    max_sort = result.scalar() or 0

    activity = Activity(
        itinerary_day_id=day_id,
        title=activity_data.title,
        category=activity_data.category,
        start_time=activity_data.start_time,
        end_time=activity_data.end_time,
        location=activity_data.location,
        notes=activity_data.notes,
        confirmation_number=activity_data.confirmation_number,
        sort_order=max_sort + 1
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@router.get("/days/{day_id}/activities", response_model=list[ActivityResponse])
async def list_activities(
    day_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """List activities for itinerary day"""
    await verify_day_access(day_id, db, current_user)

    result = await db.execute(
        select(Activity)
        .where(Activity.itinerary_day_id == day_id)
        .order_by(Activity.sort_order)
    )
    return result.scalars().all()


@router.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    activity_data: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Update activity"""
    result = await db.execute(
        select(Activity)
        .join(ItineraryDay)
        .join(Trip, ItineraryDay.trip_id == Trip.id)
        .join(TripMember)
        .where(Activity.id == activity_id)
        .where(TripMember.user_id == current_user.id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    update_data = activity_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(activity, key, value)

    await db.commit()
    await db.refresh(activity)
    return activity


@router.delete("/activities/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Delete activity"""
    result = await db.execute(
        select(Activity)
        .join(ItineraryDay)
        .join(Trip, ItineraryDay.trip_id == Trip.id)
        .join(TripMember)
        .where(Activity.id == activity_id)
        .where(TripMember.user_id == current_user.id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    await db.delete(activity)
    await db.commit()
```

**Step 5: Add test fixtures**

Add to `backend/tests/conftest.py`:

```python
@pytest.fixture
async def itinerary_day_id(client: AsyncClient, auth_headers: dict, trip_id: str) -> str:
    """Create itinerary day and return ID"""
    response = await client.post(
        f"/itinerary/trips/{trip_id}/days",
        headers=auth_headers,
        json={"date": "2026-07-15", "notes": "Day 1"}
    )
    return response.json()["id"]


@pytest.fixture
async def activity_id(client: AsyncClient, auth_headers: dict, itinerary_day_id: str) -> str:
    """Create activity and return ID"""
    response = await client.post(
        f"/itinerary/days/{itinerary_day_id}/activities",
        headers=auth_headers,
        json={
            "title": "Test Activity",
            "category": "activity",
            "notes": "Test notes"
        }
    )
    return response.json()["id"]
```

**Step 6: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_itinerary.py -v`

Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/src/travel_planner/schemas/itinerary.py \
        backend/src/travel_planner/routers/itinerary.py \
        backend/tests/test_itinerary.py \
        backend/tests/conftest.py
git commit -m "feat: add activity CRUD endpoints

- Add ActivityCreate, ActivityUpdate, ActivityResponse schemas
- Add verify_day_access helper
- Add POST/GET/PATCH/DELETE /itinerary/activities endpoints
- Auto-increment sort_order on create
- Test all CRUD operations"
```

---

## Task 4: Checklist API - Complete CRUD

**Files:**
- Create: `backend/src/travel_planner/schemas/checklist.py`
- Create: `backend/src/travel_planner/routers/checklist.py`
- Modify: `backend/src/travel_planner/main.py`
- Create: `backend/tests/test_checklist.py`

**Step 1: Write failing tests**

Create `backend/tests/test_checklist.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_checklist(client: AsyncClient, auth_headers: dict, trip_id: str):
    """Create checklist for trip"""
    response = await client.post(
        f"/checklist/trips/{trip_id}/checklists",
        headers=auth_headers,
        json={"title": "Packing List"}
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Packing List"


@pytest.mark.asyncio
async def test_list_checklists(client: AsyncClient, auth_headers: dict, trip_id: str):
    """List checklists for trip"""
    response = await client.get(
        f"/checklist/trips/{trip_id}/checklists",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_add_checklist_item(
    client: AsyncClient,
    auth_headers: dict,
    checklist_id: str
):
    """Add item to checklist"""
    response = await client.post(
        f"/checklist/checklists/{checklist_id}/items",
        headers=auth_headers,
        json={"text": "Pack passport"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "Pack passport"
    assert data["checked"] is False


@pytest.mark.asyncio
async def test_toggle_checklist_item(
    client: AsyncClient,
    auth_headers: dict,
    checklist_item_id: str
):
    """Toggle checklist item checked status"""
    response = await client.post(
        f"/checklist/items/{checklist_item_id}/toggle",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["checked"] is True
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_checklist.py -v`

Expected: Multiple FAILs

**Step 3: Create schemas**

Create `backend/src/travel_planner/schemas/checklist.py`:

```python
from uuid import UUID

from pydantic import BaseModel


class ChecklistCreate(BaseModel):
    title: str


class ChecklistItemCreate(BaseModel):
    text: str


class ChecklistItemResponse(BaseModel):
    id: UUID
    checklist_id: UUID
    text: str
    sort_order: int
    checked: bool

    class Config:
        from_attributes = True


class ChecklistResponse(BaseModel):
    id: UUID
    trip_id: UUID
    title: str
    items: list[ChecklistItemResponse]

    class Config:
        from_attributes = True
```

**Step 4: Implement router**

Create `backend/src/travel_planner/routers/checklist.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import get_current_user
from travel_planner.db import get_db
from travel_planner.models.checklist import Checklist, ChecklistItem, ChecklistItemUser
from travel_planner.models.trip import Trip, TripMember
from travel_planner.models.user import UserProfile
from travel_planner.schemas.checklist import (
    ChecklistCreate,
    ChecklistItemCreate,
    ChecklistItemResponse,
    ChecklistResponse,
)

router = APIRouter(prefix="/checklist", tags=["checklist"])


async def verify_trip_member(
    trip_id: UUID,
    db: AsyncSession,
    current_user: UserProfile
) -> Trip:
    """Verify user is member of trip"""
    result = await db.execute(
        select(Trip)
        .join(TripMember)
        .where(Trip.id == trip_id)
        .where(TripMember.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=403, detail="Not a member of this trip")
    return trip


@router.post("/trips/{trip_id}/checklists", response_model=ChecklistResponse, status_code=201)
async def create_checklist(
    trip_id: UUID,
    checklist_data: ChecklistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Create checklist for trip"""
    await verify_trip_member(trip_id, db, current_user)

    checklist = Checklist(trip_id=trip_id, title=checklist_data.title)
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)

    return ChecklistResponse(
        id=checklist.id,
        trip_id=checklist.trip_id,
        title=checklist.title,
        items=[]
    )


@router.get("/trips/{trip_id}/checklists", response_model=list[ChecklistResponse])
async def list_checklists(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """List checklists for trip with items and user check status"""
    await verify_trip_member(trip_id, db, current_user)

    result = await db.execute(
        select(Checklist)
        .where(Checklist.trip_id == trip_id)
        .order_by(Checklist.created_at)
    )
    checklists = result.scalars().all()

    response = []
    for checklist in checklists:
        # Get items with user check status
        items_result = await db.execute(
            select(ChecklistItem, ChecklistItemUser.checked)
            .outerjoin(
                ChecklistItemUser,
                (ChecklistItemUser.item_id == ChecklistItem.id) &
                (ChecklistItemUser.user_id == current_user.id)
            )
            .where(ChecklistItem.checklist_id == checklist.id)
            .order_by(ChecklistItem.sort_order)
        )

        items = []
        for item, checked in items_result:
            items.append(
                ChecklistItemResponse(
                    id=item.id,
                    checklist_id=item.checklist_id,
                    text=item.text,
                    sort_order=item.sort_order,
                    checked=checked or False
                )
            )

        response.append(
            ChecklistResponse(
                id=checklist.id,
                trip_id=checklist.trip_id,
                title=checklist.title,
                items=items
            )
        )

    return response


@router.post("/checklists/{checklist_id}/items", response_model=ChecklistItemResponse, status_code=201)
async def add_checklist_item(
    checklist_id: UUID,
    item_data: ChecklistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Add item to checklist"""
    # Verify access
    result = await db.execute(
        select(Checklist)
        .join(Trip)
        .join(TripMember)
        .where(Checklist.id == checklist_id)
        .where(TripMember.user_id == current_user.id)
    )
    checklist = result.scalar_one_or_none()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    # Get max sort_order
    max_result = await db.execute(
        select(func.max(ChecklistItem.sort_order))
        .where(ChecklistItem.checklist_id == checklist_id)
    )
    max_sort = max_result.scalar() or 0

    item = ChecklistItem(
        checklist_id=checklist_id,
        text=item_data.text,
        sort_order=max_sort + 1
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return ChecklistItemResponse(
        id=item.id,
        checklist_id=item.checklist_id,
        text=item.text,
        sort_order=item.sort_order,
        checked=False
    )


@router.post("/items/{item_id}/toggle", response_model=ChecklistItemResponse)
async def toggle_checklist_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
):
    """Toggle checklist item checked status for current user"""
    # Verify item exists and user has access
    result = await db.execute(
        select(ChecklistItem)
        .join(Checklist)
        .join(Trip)
        .join(TripMember)
        .where(ChecklistItem.id == item_id)
        .where(TripMember.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Get or create user check
    check_result = await db.execute(
        select(ChecklistItemUser)
        .where(ChecklistItemUser.item_id == item_id)
        .where(ChecklistItemUser.user_id == current_user.id)
    )
    user_check = check_result.scalar_one_or_none()

    if user_check:
        user_check.checked = not user_check.checked
    else:
        user_check = ChecklistItemUser(
            item_id=item_id,
            user_id=current_user.id,
            checked=True
        )
        db.add(user_check)

    await db.commit()
    await db.refresh(user_check)

    return ChecklistItemResponse(
        id=item.id,
        checklist_id=item.checklist_id,
        text=item.text,
        sort_order=item.sort_order,
        checked=user_check.checked
    )
```

**Step 5: Register router**

Modify `backend/src/travel_planner/main.py`:

```python
from travel_planner.routers import auth, checklist, itinerary, trips

# ... existing code ...

app.include_router(checklist.router)
```

**Step 6: Add test fixtures**

Add to `backend/tests/conftest.py`:

```python
@pytest.fixture
async def checklist_id(client: AsyncClient, auth_headers: dict, trip_id: str) -> str:
    """Create checklist and return ID"""
    response = await client.post(
        f"/checklist/trips/{trip_id}/checklists",
        headers=auth_headers,
        json={"title": "Test Checklist"}
    )
    return response.json()["id"]


@pytest.fixture
async def checklist_item_id(client: AsyncClient, auth_headers: dict, checklist_id: str) -> str:
    """Create checklist item and return ID"""
    response = await client.post(
        f"/checklist/checklists/{checklist_id}/items",
        headers=auth_headers,
        json={"text": "Test Item"}
    )
    return response.json()["id"]
```

**Step 7: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_checklist.py -v`

Expected: All tests PASS

**Step 8: Commit**

```bash
git add backend/src/travel_planner/schemas/checklist.py \
        backend/src/travel_planner/routers/checklist.py \
        backend/src/travel_planner/main.py \
        backend/tests/test_checklist.py \
        backend/tests/conftest.py
git commit -m "feat: add checklist CRUD endpoints

- Add ChecklistCreate, ChecklistItemCreate, ChecklistResponse schemas
- Add checklist and item CRUD endpoints
- Add per-user item toggle tracking
- Test all checklist operations"
```

---

## Task 5: Frontend Itinerary Types & API

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add TypeScript types**

Add to `frontend/src/lib/types.ts`:

```typescript
export type ActivityCategory = 'transport' | 'food' | 'activity' | 'lodging'

export interface ItineraryDay {
  id: string
  trip_id: string
  date: string
  notes: string | null
  activity_count: number
}

export interface Activity {
  id: string
  itinerary_day_id: string
  title: string
  category: ActivityCategory
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  confirmation_number: string | null
  sort_order: number
}

export interface CreateItineraryDay {
  date: string
  notes?: string | null
}

export interface CreateActivity {
  title: string
  category: ActivityCategory
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  notes?: string | null
  confirmation_number?: string | null
}

export interface UpdateActivity {
  title?: string
  category?: ActivityCategory
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  notes?: string | null
  confirmation_number?: string | null
  sort_order?: number
}
```

**Step 2: Add API functions**

Add to `frontend/src/lib/api.ts`:

```typescript
// Itinerary
export const itineraryApi = {
  listDays: (tripId: string) =>
    api.get<ItineraryDay[]>(`/itinerary/trips/${tripId}/days`),

  createDay: (tripId: string, data: CreateItineraryDay) =>
    api.post<ItineraryDay>(`/itinerary/trips/${tripId}/days`, data),

  listActivities: (dayId: string) =>
    api.get<Activity[]>(`/itinerary/days/${dayId}/activities`),

  createActivity: (dayId: string, data: CreateActivity) =>
    api.post<Activity>(`/itinerary/days/${dayId}/activities`, data),

  updateActivity: (activityId: string, data: UpdateActivity) =>
    api.patch<Activity>(`/itinerary/activities/${activityId}`, data),

  deleteActivity: (activityId: string) =>
    api.delete(`/itinerary/activities/${activityId}`),
}
```

**Step 3: Test imports**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add itinerary types and API functions

- Add ItineraryDay, Activity types
- Add ActivityCategory enum type
- Add create/update interfaces
- Add itineraryApi with all CRUD methods"
```

---

## Task 6: Frontend Checklist Types & API

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add TypeScript types**

Add to `frontend/src/lib/types.ts`:

```typescript
export interface ChecklistItem {
  id: string
  checklist_id: string
  text: string
  sort_order: number
  checked: boolean
}

export interface Checklist {
  id: string
  trip_id: string
  title: string
  items: ChecklistItem[]
}

export interface CreateChecklist {
  title: string
}

export interface CreateChecklistItem {
  text: string
}
```

**Step 2: Add API functions**

Add to `frontend/src/lib/api.ts`:

```typescript
// Checklist
export const checklistApi = {
  list: (tripId: string) =>
    api.get<Checklist[]>(`/checklist/trips/${tripId}/checklists`),

  create: (tripId: string, data: CreateChecklist) =>
    api.post<Checklist>(`/checklist/trips/${tripId}/checklists`, data),

  addItem: (checklistId: string, data: CreateChecklistItem) =>
    api.post<ChecklistItem>(`/checklist/checklists/${checklistId}/items`, data),

  toggleItem: (itemId: string) =>
    api.post<ChecklistItem>(`/checklist/items/${itemId}/toggle`, {}),
}
```

**Step 3: Test imports**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add checklist types and API functions

- Add Checklist, ChecklistItem types
- Add create interfaces
- Add checklistApi with CRUD methods"
```

---

## Task 7: Frontend Itinerary Components

**Files:**
- Create: `frontend/src/components/itinerary/ItineraryDayCard.tsx`
- Create: `frontend/src/components/itinerary/ActivityItem.tsx`
- Create: `frontend/src/components/itinerary/AddActivityModal.tsx`
- Create: `frontend/src/hooks/useItinerary.ts`

**Step 1: Create itinerary hook**

Create `frontend/src/hooks/useItinerary.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { itineraryApi } from '../lib/api'
import type { CreateActivity, CreateItineraryDay, UpdateActivity } from '../lib/types'

export function useItineraryDays(tripId: string) {
  return useQuery({
    queryKey: ['itinerary-days', tripId],
    queryFn: () => itineraryApi.listDays(tripId),
  })
}

export function useActivities(dayId: string) {
  return useQuery({
    queryKey: ['activities', dayId],
    queryFn: () => itineraryApi.listActivities(dayId),
  })
}

export function useCreateDay(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateItineraryDay) => itineraryApi.createDay(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary-days', tripId] })
    },
  })
}

export function useCreateActivity(dayId: string, tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateActivity) => itineraryApi.createActivity(dayId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', dayId] })
      queryClient.invalidateQueries({ queryKey: ['itinerary-days', tripId] })
    },
  })
}

export function useUpdateActivity(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivity }) =>
      itineraryApi.updateActivity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['itinerary-days', tripId] })
    },
  })
}

export function useDeleteActivity(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (activityId: string) => itineraryApi.deleteActivity(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['itinerary-days', tripId] })
    },
  })
}
```

**Step 2: Create ItineraryDayCard component**

Create `frontend/src/components/itinerary/ItineraryDayCard.tsx`:

```typescript
import { CalendarIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import type { ItineraryDay } from '../../lib/types'
import { useActivities } from '../../hooks/useItinerary'
import { ActivityItem } from './ActivityItem'
import { AddActivityModal } from './AddActivityModal'

interface Props {
  day: ItineraryDay
  tripId: string
}

export function ItineraryDayCard({ day, tripId }: Props) {
  const [showAddModal, setShowAddModal] = useState(false)
  const { data: activities = [], isLoading } = useActivities(day.id)

  const formattedDate = new Date(day.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="font-semibold text-lg">{formattedDate}</h3>
            {day.notes && <p className="text-sm text-gray-600">{day.notes}</p>}
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Add Activity
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading activities...</p>
      ) : activities.length === 0 ? (
        <p className="text-gray-500 italic">No activities yet</p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} tripId={tripId} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddActivityModal
          dayId={day.id}
          tripId={tripId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
```

**Step 3: Create ActivityItem component**

Create `frontend/src/components/itinerary/ActivityItem.tsx`:

```typescript
import {
  TrashIcon,
  MapPinIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import type { Activity } from '../../lib/types'
import { useDeleteActivity } from '../../hooks/useItinerary'

const CATEGORY_ICONS = {
  transport: '✈️',
  food: '🍽️',
  activity: '🎯',
  lodging: '🏨',
}

interface Props {
  activity: Activity
  tripId: string
}

export function ActivityItem({ activity, tripId }: Props) {
  const deleteMutation = useDeleteActivity(tripId)

  const handleDelete = async () => {
    if (confirm('Delete this activity?')) {
      await deleteMutation.mutateAsync(activity.id)
    }
  }

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{CATEGORY_ICONS[activity.category]}</span>
            <h4 className="font-semibold text-lg">{activity.title}</h4>
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            {(activity.start_time || activity.end_time) && (
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                {activity.start_time && <span>{activity.start_time}</span>}
                {activity.start_time && activity.end_time && <span>-</span>}
                {activity.end_time && <span>{activity.end_time}</span>}
              </div>
            )}

            {activity.location && (
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                {activity.location}
              </div>
            )}

            {activity.confirmation_number && (
              <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block">
                {activity.confirmation_number}
              </p>
            )}

            {activity.notes && <p className="mt-2 text-gray-700">{activity.notes}</p>}
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="text-red-600 hover:text-red-800 p-2"
          disabled={deleteMutation.isPending}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Create AddActivityModal component**

Create `frontend/src/components/itinerary/AddActivityModal.tsx`:

```typescript
import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { useCreateActivity } from '../../hooks/useItinerary'
import type { ActivityCategory, CreateActivity } from '../../lib/types'

interface Props {
  dayId: string
  tripId: string
  onClose: () => void
}

export function AddActivityModal({ dayId, tripId, onClose }: Props) {
  const [formData, setFormData] = useState<CreateActivity>({
    title: '',
    category: 'activity',
    start_time: null,
    end_time: null,
    location: null,
    notes: null,
    confirmation_number: null,
  })

  const createMutation = useCreateActivity(dayId, tripId)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await createMutation.mutateAsync(formData)
    onClose()
  }

  return (
    <Modal title="Add Activity" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value as ActivityCategory })
            }
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="transport">✈️ Transport</option>
            <option value="food">🍽️ Food</option>
            <option value="activity">🎯 Activity</option>
            <option value="lodging">🏨 Lodging</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              value={formData.start_time || ''}
              onChange={(e) =>
                setFormData({ ...formData, start_time: e.target.value || null })
              }
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              value={formData.end_time || ''}
              onChange={(e) =>
                setFormData({ ...formData, end_time: e.target.value || null })
              }
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <input
            type="text"
            value={formData.location || ''}
            onChange={(e) => setFormData({ ...formData, location: e.target.value || null })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confirmation #</label>
          <input
            type="text"
            value={formData.confirmation_number || ''}
            onChange={(e) =>
              setFormData({ ...formData, confirmation_number: e.target.value || null })
            }
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {createMutation.isPending ? 'Adding...' : 'Add Activity'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

**Step 5: Test TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/hooks/useItinerary.ts \
        frontend/src/components/itinerary/
git commit -m "feat: add itinerary frontend components

- Add useItinerary hooks for days and activities
- Add ItineraryDayCard with activity list
- Add ActivityItem with delete functionality
- Add AddActivityModal with full form"
```

---

## Task 8: Frontend Checklist Components

**Files:**
- Create: `frontend/src/components/checklist/ChecklistCard.tsx`
- Create: `frontend/src/components/checklist/AddChecklistModal.tsx`
- Create: `frontend/src/hooks/useChecklists.ts`

**Step 1: Create checklist hook**

Create `frontend/src/hooks/useChecklists.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checklistApi } from '../lib/api'
import type { CreateChecklist, CreateChecklistItem } from '../lib/types'

export function useChecklists(tripId: string) {
  return useQuery({
    queryKey: ['checklists', tripId],
    queryFn: () => checklistApi.list(tripId),
  })
}

export function useCreateChecklist(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateChecklist) => checklistApi.create(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', tripId] })
    },
  })
}

export function useAddChecklistItem(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ checklistId, data }: { checklistId: string; data: CreateChecklistItem }) =>
      checklistApi.addItem(checklistId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', tripId] })
    },
  })
}

export function useToggleChecklistItem(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => checklistApi.toggleItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', tripId] })
    },
  })
}
```

**Step 2: Create ChecklistCard component**

Create `frontend/src/components/checklist/ChecklistCard.tsx`:

```typescript
import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { Checklist } from '../../lib/types'
import { useAddChecklistItem, useToggleChecklistItem } from '../../hooks/useChecklists'

interface Props {
  checklist: Checklist
  tripId: string
}

export function ChecklistCard({ checklist, tripId }: Props) {
  const [newItemText, setNewItemText] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const addItemMutation = useAddChecklistItem(tripId)
  const toggleMutation = useToggleChecklistItem(tripId)

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim()) return

    await addItemMutation.mutateAsync({
      checklistId: checklist.id,
      data: { text: newItemText.trim() },
    })
    setNewItemText('')
    setShowAddForm(false)
  }

  const handleToggle = async (itemId: string) => {
    await toggleMutation.mutateAsync(itemId)
  }

  const completedCount = checklist.items.filter((item) => item.checked).length
  const totalCount = checklist.items.length

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{checklist.title}</h3>
          <p className="text-sm text-gray-600">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="New item..."
              className="flex-1 px-3 py-2 border rounded-lg"
              autoFocus
            />
            <button
              type="submit"
              disabled={addItemMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewItemText('')
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {checklist.items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleToggle(item.id)}
              disabled={toggleMutation.isPending}
              className="h-5 w-5 rounded border-gray-300"
            />
            <span className={item.checked ? 'line-through text-gray-500' : ''}>
              {item.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Create AddChecklistModal component**

Create `frontend/src/components/checklist/AddChecklistModal.tsx`:

```typescript
import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { useCreateChecklist } from '../../hooks/useChecklists'

interface Props {
  tripId: string
  onClose: () => void
}

export function AddChecklistModal({ tripId, onClose }: Props) {
  const [title, setTitle] = useState('')
  const createMutation = useCreateChecklist(tripId)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await createMutation.mutateAsync({ title })
    onClose()
  }

  return (
    <Modal title="Create Checklist" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Packing List"
            className="w-full px-3 py-2 border rounded-lg"
            autoFocus
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

**Step 4: Test TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/hooks/useChecklists.ts \
        frontend/src/components/checklist/
git commit -m "feat: add checklist frontend components

- Add useChecklists hooks
- Add ChecklistCard with item toggle
- Add inline item addition
- Add AddChecklistModal for new checklists"
```

---

## Task 9: Integrate into Trip Detail Page

**Files:**
- Modify: `frontend/src/pages/TripDetailPage.tsx`

**Step 1: Add itinerary and checklist tabs**

Modify `frontend/src/pages/TripDetailPage.tsx` to add new sections. Add imports:

```typescript
import { ItineraryDayCard } from '../components/itinerary/ItineraryDayCard'
import { ChecklistCard } from '../components/checklist/ChecklistCard'
import { AddChecklistModal } from '../components/checklist/AddChecklistModal'
import { useItineraryDays, useCreateDay } from '../hooks/useItinerary'
import { useChecklists } from '../hooks/useChecklists'
```

Add state for modals and active tab:

```typescript
const [showAddChecklistModal, setShowAddChecklistModal] = useState(false)
const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'checklists'>('overview')

const { data: itineraryDays = [] } = useItineraryDays(tripId)
const { data: checklists = [] } = useChecklists(tripId)
const createDayMutation = useCreateDay(tripId)
```

Add tab navigation after the header section:

```typescript
<div className="border-b mb-6">
  <div className="flex gap-4">
    <button
      onClick={() => setActiveTab('overview')}
      className={`px-4 py-2 border-b-2 transition-colors ${
        activeTab === 'overview'
          ? 'border-blue-600 text-blue-600 font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-800'
      }`}
    >
      Overview
    </button>
    <button
      onClick={() => setActiveTab('itinerary')}
      className={`px-4 py-2 border-b-2 transition-colors ${
        activeTab === 'itinerary'
          ? 'border-blue-600 text-blue-600 font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-800'
      }`}
    >
      Itinerary ({itineraryDays.length} days)
    </button>
    <button
      onClick={() => setActiveTab('checklists')}
      className={`px-4 py-2 border-b-2 transition-colors ${
        activeTab === 'checklists'
          ? 'border-blue-600 text-blue-600 font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-800'
      }`}
    >
      Checklists ({checklists.length})
    </button>
  </div>
</div>
```

Add conditional rendering for each tab. Replace the members section with:

```typescript
{activeTab === 'overview' && (
  <div className="space-y-6">
    {/* Existing members section */}
    <TripMembersList tripId={tripId} members={trip.members} isOwner={isOwner} />
  </div>
)}

{activeTab === 'itinerary' && (
  <div>
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold">Itinerary</h2>
      <button
        onClick={async () => {
          const date = prompt('Enter date (YYYY-MM-DD):')
          if (date) {
            await createDayMutation.mutateAsync({ date, notes: null })
          }
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Add Day
      </button>
    </div>

    {itineraryDays.length === 0 ? (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">No itinerary days yet</p>
        <p className="text-sm text-gray-500">Add a day to start planning your trip schedule</p>
      </div>
    ) : (
      <div className="space-y-4">
        {itineraryDays.map((day) => (
          <ItineraryDayCard key={day.id} day={day} tripId={tripId} />
        ))}
      </div>
    )}
  </div>
)}

{activeTab === 'checklists' && (
  <div>
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold">Checklists</h2>
      <button
        onClick={() => setShowAddChecklistModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        New Checklist
      </button>
    </div>

    {checklists.length === 0 ? (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">No checklists yet</p>
        <p className="text-sm text-gray-500">Create a checklist to track trip preparation</p>
      </div>
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {checklists.map((checklist) => (
          <ChecklistCard key={checklist.id} checklist={checklist} tripId={tripId} />
        ))}
      </div>
    )}

    {showAddChecklistModal && (
      <AddChecklistModal
        tripId={tripId}
        onClose={() => setShowAddChecklistModal(false)}
      />
    )}
  </div>
)}
```

**Step 2: Test TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/pages/TripDetailPage.tsx
git commit -m "feat: integrate itinerary and checklists into trip detail page

- Add tab navigation (overview, itinerary, checklists)
- Add itinerary section with day creation
- Add checklists section with grid layout
- Show counts in tab labels"
```

---

## Execution Complete

Plan saved to `docs/plans/2026-02-16-phase3-itinerary-checklists.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
