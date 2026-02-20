# Trips Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace placeholder member avatars with real initials, add an itinerary progress bar to trip cards, and redesign the trip detail page with a continuous timeline layout and cross-day activity drag-and-drop.

**Architecture:** Seven tasks in order — backend schema + query changes first (Tasks 1–2), then frontend types (Task 3), then UI components (Tasks 4–7). Tasks 1 and 2 are independent; Tasks 4–7 depend on Task 3. The new `ItineraryTimeline` component replaces `ItineraryDayCard` usage in `TripDetailPage`. All activities for a trip are fetched in one query (`useTripActivities`) and grouped by day in memory for the DnD context.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query + @dnd-kit/core + @dnd-kit/sortable (frontend), Vitest + Testing Library (tests)

---

### Task 1: Backend — TripSummary member previews + itinerary stats

**Files:**
- Modify: `backend/src/travel_planner/schemas/trip.py`
- Modify: `backend/src/travel_planner/routers/trips.py`
- Modify: `backend/tests/test_trips.py`

---

**Step 1: Add failing tests**

Open `backend/tests/test_trips.py`. After the existing `test_list_trips_empty` test, add:

```python
def test_list_trips_includes_member_previews(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips returns member_previews with initials and colors."""
    owner_user = _make_user(display_name="Alice Smith")
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]
    # Second execute call for itinerary stats
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert "member_previews" in data[0]
    assert len(data[0]["member_previews"]) == 1
    assert data[0]["member_previews"][0]["initials"] == "AS"


def test_list_trips_includes_itinerary_stats(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips returns itinerary_day_count and days_with_activities."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [trip]

    # Stats row: trip_id, day_count=5, active_count=3
    stats_row = MagicMock()
    stats_row.trip_id = trip.id
    stats_row.day_count = 5
    stats_row.active_count = 3
    stats_mock = MagicMock()
    stats_mock.__iter__ = MagicMock(return_value=iter([stats_row]))
    mock_db_session.execute = AsyncMock(side_effect=[result_mock, stats_mock])

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["itinerary_day_count"] == 5
    assert data[0]["days_with_activities"] == 3
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_trips.py::test_list_trips_includes_member_previews tests/test_trips.py::test_list_trips_includes_itinerary_stats -v
```

Expected: FAIL — `member_previews` key missing from response

**Step 3: Add MemberPreview schema and update TripSummary**

In `backend/src/travel_planner/schemas/trip.py`, after the imports and before `TripCreate`, add:

```python
AVATAR_COLORS = [
    "#6366f1",  # indigo
    "#22c55e",  # green
    "#f59e0b",  # amber
    "#f43f5e",  # rose
    "#06b6d4",  # cyan
    "#a855f7",  # purple
    "#3b82f6",  # blue
    "#f97316",  # orange
]


def _member_initials(display_name: str, email: str | None) -> str:
    if display_name and display_name != "Anonymous":
        parts = display_name.split()
        return "".join(p[0] for p in parts if p)[:2].upper()
    if email:
        return email.split("@")[0][:2].upper()
    return "?"


def _member_color(user_id: uuid.UUID) -> str:
    return AVATAR_COLORS[user_id.int % len(AVATAR_COLORS)]


class MemberPreview(BaseModel):
    initials: str
    color: str
```

Then update `TripSummary` to add three new fields with defaults (so existing uses of `TripSummary` for children in `_build_trip_response` don't break):

```python
class TripSummary(BaseModel):
    id: uuid.UUID
    type: TripType
    destination: str
    start_date: date
    end_date: date
    status: TripStatus
    notes: str | None
    destination_latitude: float | None = None
    destination_longitude: float | None = None
    parent_trip_id: uuid.UUID | None
    created_at: datetime
    member_count: int
    member_previews: list[MemberPreview] = []
    itinerary_day_count: int = 0
    days_with_activities: int = 0
    model_config = {"from_attributes": True}
```

**Step 4: Update `list_trips` in trips.py**

Replace the import block at the top of `backend/src/travel_planner/routers/trips.py` to add the itinerary models:

```python
from sqlalchemy import func, select
```

(Replace the existing `from sqlalchemy import select` — just add `func` to it.)

Also add after the existing trip model imports:
```python
from travel_planner.models.itinerary import Activity, ItineraryDay
from travel_planner.schemas.trip import (
    AddMemberRequest,
    MemberPreview,
    TripCreate,
    TripMemberResponse,
    TripResponse,
    TripSummary,
    TripUpdate,
    UpdateMemberRole,
    _member_color,
    _member_initials,
)
```

Replace the `list_trips` function:

```python
@router.get("", response_model=list[TripSummary])
async def list_trips(
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
    status: TripStatus | None = Query(default=None),
) -> list[TripSummary]:
    """List all trips the current user is a member of."""
    stmt = (
        select(Trip)
        .join(TripMember)
        .where(TripMember.user_id == user_id)
        .options(selectinload(Trip.members).joinedload(TripMember.user))
    )
    if status is not None:
        stmt = stmt.where(Trip.status == status)

    result = await db.execute(stmt)
    trips = result.scalars().all()

    # Bulk itinerary stats — 1 extra query for all trips
    trip_ids = [t.id for t in trips]
    stats_map: dict[object, tuple[int, int]] = {}
    if trip_ids:
        activity_per_day = (
            select(
                Activity.itinerary_day_id,
                func.count(Activity.id).label("cnt"),
            )
            .group_by(Activity.itinerary_day_id)
            .subquery("activity_per_day")
        )
        stats_stmt = (
            select(
                ItineraryDay.trip_id,
                func.count(ItineraryDay.id).label("day_count"),
                func.count(activity_per_day.c.itinerary_day_id).label("active_count"),
            )
            .outerjoin(
                activity_per_day,
                activity_per_day.c.itinerary_day_id == ItineraryDay.id,
            )
            .where(ItineraryDay.trip_id.in_(trip_ids))
            .group_by(ItineraryDay.trip_id)
        )
        stats_result = await db.execute(stats_stmt)
        stats_map = {
            row.trip_id: (row.day_count, row.active_count)
            for row in stats_result
        }

    summaries = []
    for t in trips:
        day_count, active_count = stats_map.get(t.id, (0, 0))
        sorted_members = sorted(t.members, key=lambda m: m.id)
        previews = [
            MemberPreview(
                initials=_member_initials(m.user.display_name, m.user.email),
                color=_member_color(m.user_id),
            )
            for m in sorted_members[:3]
        ]
        summaries.append(
            TripSummary(
                id=t.id,
                type=t.type,
                destination=t.destination,
                start_date=t.start_date,
                end_date=t.end_date,
                status=t.status,
                notes=t.notes,
                destination_latitude=t.destination_latitude,
                destination_longitude=t.destination_longitude,
                parent_trip_id=t.parent_trip_id,
                created_at=t.created_at,
                member_count=len(t.members),
                member_previews=previews,
                itinerary_day_count=day_count,
                days_with_activities=active_count,
            )
        )
    return summaries
```

**Step 5: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_trips.py -v
```

Expected: PASS (all trips tests)

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add backend/src/travel_planner/schemas/trip.py backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py && git commit -m "feat: TripSummary adds member_previews and itinerary stats"
```

---

### Task 2: Backend — ActivityUpdate itinerary_day_id

**Files:**
- Modify: `backend/src/travel_planner/schemas/itinerary.py`
- Modify: `backend/src/travel_planner/routers/itinerary.py`
- Modify: `backend/tests/test_itinerary.py`

---

**Step 1: Add failing test**

Open `backend/tests/test_itinerary.py`. Find the imports at the top to understand the helper IDs used. Add this test after the existing tests:

```python
def test_update_activity_moves_to_different_day(
    client: TestClient,
    auth_headers: dict,
    override_get_db,
    mock_db_session,
    activity_id: str,
    itinerary_day_id: str,
):
    """PATCH /itinerary/activities/{id} with itinerary_day_id moves activity to target day."""
    from travel_planner.models.itinerary import Activity, ActivityCategory, ItineraryDay

    source_day_id = UUID(itinerary_day_id)
    target_day_id = UUID("aaa04567-e89b-12d3-a456-426614174099")
    act_id = UUID(activity_id)

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # Mock activity
    activity = MagicMock(spec=Activity)
    activity.id = act_id
    activity.itinerary_day_id = source_day_id
    activity.title = "Visit Museum"
    activity.category = ActivityCategory.activity
    activity.start_time = None
    activity.end_time = None
    activity.location = None
    activity.latitude = None
    activity.longitude = None
    activity.notes = None
    activity.confirmation_number = None
    activity.sort_order = 0

    # Mock source day
    source_day = MagicMock(spec=ItineraryDay)
    source_day.id = source_day_id
    source_day.trip_id = trip.id

    # Mock target day (same trip)
    target_day = MagicMock(spec=ItineraryDay)
    target_day.id = target_day_id
    target_day.trip_id = trip.id

    # Execute call sequence:
    # 1. select Activity (get activity)
    # 2. select ItineraryDay (verify_day_access — get source day)
    # 3. select Trip (verify_trip_member inside verify_day_access)
    # 4. select ItineraryDay (get target day)
    act_mock = MagicMock()
    act_mock.scalar_one_or_none.return_value = activity

    src_day_mock = MagicMock()
    src_day_mock.scalar_one_or_none.return_value = source_day

    trip_mock = MagicMock()
    trip_mock.scalar_one_or_none.return_value = trip

    tgt_day_mock = MagicMock()
    tgt_day_mock.scalar_one_or_none.return_value = target_day

    mock_db_session.execute = AsyncMock(
        side_effect=[act_mock, src_day_mock, trip_mock, tgt_day_mock]
    )

    response = client.patch(
        f"/itinerary/activities/{activity_id}",
        json={"itinerary_day_id": str(target_day_id)},
        headers=auth_headers,
    )
    assert response.status_code == 200
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_itinerary.py::test_update_activity_moves_to_different_day -v
```

Expected: FAIL — 422 (schema rejects unknown field) or test setup error

**Step 3: Add itinerary_day_id to ActivityUpdate schema**

In `backend/src/travel_planner/schemas/itinerary.py`, add the import for `uuid.UUID` at the top (it already uses `UUID` from `uuid`). Then update `ActivityUpdate`:

```python
class ActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: ActivityCategory | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = None
    confirmation_number: str | None = None
    sort_order: int | None = None
    itinerary_day_id: UUID | None = None

    @model_validator(mode="after")
    def end_time_after_start_time(self) -> "ActivityUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self
```

**Step 4: Update update_activity handler to handle cross-day move**

In `backend/src/travel_planner/routers/itinerary.py`, replace the `update_activity` function:

```python
@router.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    activity_data: ActivityUpdate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Update an activity. Pass itinerary_day_id to move it to another day."""
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Verify user has access to the current day (returns the day object)
    current_day = await verify_day_access(activity.itinerary_day_id, db, user_id)

    # Handle cross-day move
    if (
        activity_data.itinerary_day_id is not None
        and activity_data.itinerary_day_id != activity.itinerary_day_id
    ):
        result2 = await db.execute(
            select(ItineraryDay).where(ItineraryDay.id == activity_data.itinerary_day_id)
        )
        target_day = result2.scalar_one_or_none()
        if target_day is None:
            raise HTTPException(status_code=404, detail="Target itinerary day not found")
        if target_day.trip_id != current_day.trip_id:
            raise HTTPException(
                status_code=403, detail="Target day belongs to a different trip"
            )

    update_data = activity_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(activity, field, value)

    await db.commit()
    await db.refresh(activity)
    return ActivityResponse.model_validate(activity)
```

Note: `verify_day_access` already returns the `ItineraryDay` — change the existing handler's call from `await verify_day_access(...)` (result unused) to `current_day = await verify_day_access(...)`.

**Step 5: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest tests/test_itinerary.py -v
```

Expected: PASS (all itinerary tests)

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add backend/src/travel_planner/schemas/itinerary.py backend/src/travel_planner/routers/itinerary.py backend/tests/test_itinerary.py && git commit -m "feat: ActivityUpdate accepts itinerary_day_id for cross-day moves"
```

---

### Task 3: Frontend types

**Files:**
- Modify: `frontend/src/lib/types.ts`

---

**Step 1: No test needed — TypeScript compilation validates these.**

**Step 2: Update types.ts**

Add `MemberPreview` interface and update `TripSummary` and `UpdateActivity`:

Find the existing `TripSummary` interface. Before it, add:

```typescript
export interface MemberPreview {
  initials: string
  color: string
}
```

Then update `TripSummary` to add three new fields at the end:

```typescript
export interface TripSummary {
  id: string
  type: TripType
  destination: string
  start_date: string
  end_date: string
  status: TripStatus
  notes: string | null
  destination_latitude: number | null
  destination_longitude: number | null
  parent_trip_id: string | null
  created_at: string
  member_count: number
  member_previews: MemberPreview[]
  itinerary_day_count: number
  days_with_activities: number
}
```

Update `UpdateActivity` to add `itinerary_day_id`:

```typescript
export interface UpdateActivity {
  title?: string
  category?: ActivityCategory
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  confirmation_number?: string | null
  sort_order?: number
  itinerary_day_id?: string
}
```

**Step 3: Run type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
```

Expected: No errors (or only pre-existing errors unrelated to this change)

**Step 4: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/lib/types.ts && git commit -m "feat: add MemberPreview type and extend TripSummary + UpdateActivity"
```

---

### Task 4: Frontend TripCard — real member initials + progress bar

**Files:**
- Modify: `frontend/src/__tests__/TripCard.test.tsx`
- Modify: `frontend/src/components/trips/TripCard.tsx`

---

**Step 1: Update TripCard tests to use member_previews and add progress bar tests**

Open `frontend/src/__tests__/TripCard.test.tsx`. Update `mockTrip` to include the new fields:

```typescript
const mockTrip: TripSummary = {
  id: 'trip-1',
  type: 'vacation',
  destination: 'Paris, France',
  start_date: '2026-06-15',
  end_date: '2026-06-22',
  status: 'planning',
  notes: null,
  parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
  member_count: 3,
  destination_latitude: null,
  destination_longitude: null,
  member_previews: [
    { initials: 'AS', color: '#6366f1' },
    { initials: 'BJ', color: '#22c55e' },
    { initials: 'CK', color: '#f59e0b' },
  ],
  itinerary_day_count: 7,
  days_with_activities: 3,
}
```

Replace the existing member avatars test and add new tests:

```typescript
it('renders real initials from member_previews', async () => {
  renderWithProviders(<TripCard trip={mockTrip} />)
  const memberSection = await screen.findByTestId('member-count')
  expect(memberSection).toBeInTheDocument()
  expect(memberSection).toHaveTextContent('AS')
  expect(memberSection).toHaveTextContent('BJ')
  expect(memberSection).toHaveTextContent('CK')
})

it('shows overflow count when more than 3 members', async () => {
  const tripWith5Members = {
    ...mockTrip,
    member_count: 5,
    member_previews: [
      { initials: 'AS', color: '#6366f1' },
      { initials: 'BJ', color: '#22c55e' },
      { initials: 'CK', color: '#f59e0b' },
    ],
  }
  renderWithProviders(<TripCard trip={tripWith5Members} />)
  expect(await screen.findByText('+2')).toBeInTheDocument()
})

it('shows dash avatar when no members', async () => {
  const soloTrip = { ...mockTrip, member_count: 0, member_previews: [] }
  renderWithProviders(<TripCard trip={soloTrip} />)
  const memberSection = await screen.findByTestId('member-count')
  expect(memberSection).toHaveTextContent('—')
})

it('shows progress bar when itinerary_day_count > 0', async () => {
  renderWithProviders(<TripCard trip={mockTrip} />)
  const bar = await screen.findByTestId('itinerary-progress')
  expect(bar).toBeInTheDocument()
  expect(bar).toHaveTextContent('3 / 7 days planned')
})

it('hides progress bar when itinerary_day_count is 0', async () => {
  const noItinerary = { ...mockTrip, itinerary_day_count: 0, days_with_activities: 0 }
  renderWithProviders(<TripCard trip={noItinerary} />)
  await screen.findByText('Paris, France')
  expect(screen.queryByTestId('itinerary-progress')).not.toBeInTheDocument()
})

it('shows "All days planned" when all days have activities', async () => {
  const allPlanned = { ...mockTrip, itinerary_day_count: 7, days_with_activities: 7 }
  renderWithProviders(<TripCard trip={allPlanned} />)
  const bar = await screen.findByTestId('itinerary-progress')
  expect(bar).toHaveTextContent('All days planned')
})
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: FAIL — `member_previews` not used, initials show "M1" not "AS", progress bar missing

**Step 3: Rewrite TripCard.tsx**

Replace `frontend/src/components/trips/TripCard.tsx` entirely:

```tsx
import { Link } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import type { TripSummary } from '../../lib/types'
import { TripStatusBadge } from './TripStatusBadge'
import { TripTypeBadge } from './TripTypeBadge'

interface TripCardProps {
  trip: TripSummary
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const endDay = end.getDate()
  const endYear = end.getFullYear()

  if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`
  }
  return `${startMonth} ${startDay}, ${start.getFullYear()} - ${endMonth} ${endDay}, ${endYear}`
}

export function TripCard({ trip }: TripCardProps) {
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const { member_count, member_previews, itinerary_day_count, days_with_activities } = trip

  const progressLabel =
    days_with_activities >= itinerary_day_count
      ? 'All days planned'
      : `${days_with_activities} / ${itinerary_day_count} days planned`
  const progressPct =
    itinerary_day_count > 0
      ? Math.round((days_with_activities / itinerary_day_count) * 100)
      : 0

  return (
    <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block group">
      <div className="bg-white rounded-2xl border border-cloud-200 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-cloud-300/20 hover:-translate-y-0.5 hover:border-indigo-200 animate-card-enter">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-cloud-900 group-hover:text-indigo-700 transition-colors duration-300 truncate mr-2">
            {trip.destination}
          </h3>
          <TripTypeBadge type={trip.type} />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-cloud-500 mb-3">
          <Calendar className="w-4 h-4 shrink-0" />
          <span data-testid="trip-dates">{dateRange}</span>
        </div>

        {itinerary_day_count > 0 && (
          <div className="mb-3" data-testid="itinerary-progress">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-cloud-500">{progressLabel}</span>
            </div>
            <div className="w-full h-1 bg-cloud-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <TripStatusBadge status={trip.status} />

          <div className="flex items-center -space-x-2" data-testid="member-count">
            {member_count === 0 ? (
              <div className="w-7 h-7 rounded-full bg-cloud-200 border-2 border-white flex items-center justify-center">
                <span className="text-[10px] font-medium text-cloud-600">—</span>
              </div>
            ) : (
              <>
                {member_previews.map((m, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ backgroundColor: m.color }}
                  >
                    <span className="text-[10px] font-medium text-white">{m.initials}</span>
                  </div>
                ))}
                {member_count > 3 && (
                  <div className="w-7 h-7 rounded-full bg-cloud-200 border-2 border-white flex items-center justify-center">
                    <span className="text-[10px] font-medium text-cloud-600">
                      +{member_count - 3}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/TripCard.test.tsx
```

Expected: PASS (all TripCard tests)

**Step 5: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/trips/TripCard.tsx frontend/src/__tests__/TripCard.test.tsx && git commit -m "feat: TripCard shows real member initials and itinerary progress bar"
```

---

### Task 5: Frontend useItinerary — new hooks for timeline

**Files:**
- Modify: `frontend/src/__tests__/useItinerary.test.tsx`
- Modify: `frontend/src/hooks/useItinerary.ts`

---

**Step 1: Add failing tests**

Add to the mock in `useItinerary.test.tsx` — update the `itineraryApi` mock object to include the new API endpoint (it uses `updateActivity` which is already mocked). No mock change needed.

Add these two `describe` blocks after the existing tests:

```typescript
describe('useMoveActivity', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls updateActivity with itinerary_day_id', async () => {
    const movedActivity = {
      id: 'act-1',
      itinerary_day_id: 'day-2',
      title: 'Visit Museum',
      category: 'activity',
      sort_order: 0,
    }
    mockPatch.mockResolvedValue({ data: movedActivity })

    const { result } = renderHook(() => useMoveActivity('trip-1'), { wrapper: createWrapper() })
    result.current.mutate({ activityId: 'act-1', targetDayId: 'day-2' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/itinerary/activities/act-1', { itinerary_day_id: 'day-2' })
  })
})

describe('useCreateActivityInDay', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates activity in the specified day', async () => {
    const newActivity = {
      id: 'act-1',
      itinerary_day_id: 'day-1',
      title: 'Visit Museum',
      category: 'activity',
      sort_order: 0,
    }
    mockPost.mockResolvedValue({ data: newActivity })

    const { result } = renderHook(() => useCreateActivityInDay('trip-1'), { wrapper: createWrapper() })
    result.current.mutate({ dayId: 'day-1', data: { title: 'Visit Museum', category: 'activity' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/itinerary/days/day-1/activities', { title: 'Visit Museum', category: 'activity' })
  })
})
```

Also add the new hooks to the import at the top:

```typescript
import {
  useItineraryDays,
  useActivities,
  useCreateDay,
  useCreateActivity,
  useDeleteActivity,
  useReorderActivities,
  useDeleteDay,
  useGenerateDays,
  useMoveActivity,
  useCreateActivityInDay,
} from '../hooks/useItinerary'
```

And also add `useReorderActivitiesForDay` to the `useReorderActivities` describe test — actually that hook isn't needed in tests because it's only used internally in the DnD handler. Skip it for now.

**Step 2: Run tests to verify they fail**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/useItinerary.test.tsx
```

Expected: FAIL — `useMoveActivity` and `useCreateActivityInDay` not exported

**Step 3: Add new hooks to useItinerary.ts**

Add at the end of `frontend/src/hooks/useItinerary.ts`:

```typescript
export function useMoveActivity(tripId: string) {
  const queryClient = useQueryClient()
  const tripActivitiesKey = [...itineraryKeys.all, 'trip-activities', tripId, { hasLocation: false }] as const

  return useMutation({
    mutationFn: async ({ activityId, targetDayId }: { activityId: string; targetDayId: string }) => {
      const { data: activity } = await itineraryApi.updateActivity(activityId, { itinerary_day_id: targetDayId })
      return activity
    },
    onMutate: async ({ activityId, targetDayId }) => {
      await queryClient.cancelQueries({ queryKey: tripActivitiesKey })
      const previous = queryClient.getQueryData(tripActivitiesKey)
      queryClient.setQueryData<import('../lib/types').Activity[]>(tripActivitiesKey, (old) =>
        old?.map((a) => a.id === activityId ? { ...a, itinerary_day_id: targetDayId } : a) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(tripActivitiesKey, context.previous)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
      queryClient.invalidateQueries({ queryKey: tripActivitiesKey })
    },
  })
}

export function useCreateActivityInDay(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dayId, data }: { dayId: string; data: import('../lib/types').CreateActivity }) => {
      const { data: activity } = await itineraryApi.createActivity(dayId, data)
      return activity
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
      queryClient.invalidateQueries({
        queryKey: [...itineraryKeys.all, 'trip-activities', tripId],
      })
    },
  })
}

export function useReorderActivitiesForDay(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dayId, activityIds }: { dayId: string; activityIds: string[] }) => {
      const { data } = await itineraryApi.reorderActivities(dayId, activityIds)
      return data
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      queryClient.invalidateQueries({
        queryKey: [...itineraryKeys.all, 'trip-activities', tripId],
      })
    },
  })
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/useItinerary.test.tsx
```

Expected: PASS (all useItinerary tests)

**Step 5: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/hooks/useItinerary.ts frontend/src/__tests__/useItinerary.test.tsx && git commit -m "feat: add useMoveActivity, useCreateActivityInDay, useReorderActivitiesForDay hooks"
```

---

### Task 6: Frontend — ItineraryTimeline component

**Files:**
- Create: `frontend/src/components/itinerary/ItineraryTimeline.tsx`
- Create: `frontend/src/components/itinerary/ActivityDragCard.tsx`

---

**Step 1: No new test file for these components (TripDetailPage integration test in Task 7 covers them). Proceed directly to implementation.**

**Step 2: Create ActivityDragCard (used in DragOverlay only)**

Create `frontend/src/components/itinerary/ActivityDragCard.tsx`:

```tsx
import { Plane, Utensils, MapPin, Hotel, type LucideIcon } from 'lucide-react'
import type { Activity, ActivityCategory } from '../../lib/types'

const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  transport: Plane,
  food: Utensils,
  activity: MapPin,
  lodging: Hotel,
}

interface ActivityDragCardProps {
  activity: Activity
}

export function ActivityDragCard({ activity }: ActivityDragCardProps) {
  const CategoryIcon = CATEGORY_ICONS[activity.category]
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-indigo-300 rounded-lg shadow-lg opacity-90 cursor-grabbing">
      <div className="flex-shrink-0 text-cloud-400">
        <CategoryIcon className="w-5 h-5" />
      </div>
      <span className="font-medium text-cloud-900 truncate">{activity.title}</span>
    </div>
  )
}
```

**Step 3: Create ItineraryTimeline component**

Create `frontend/src/components/itinerary/ItineraryTimeline.tsx`:

```tsx
import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ItineraryDay, Activity } from '../../lib/types'
import {
  useMoveActivity,
  useReorderActivitiesForDay,
  useCreateActivityInDay,
  useDeleteDay,
} from '../../hooks/useItinerary'
import { ActivityItem } from './ActivityItem'
import { ActivityDragCard } from './ActivityDragCard'
import { ActivityForm } from './ActivityForm'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Trash2 } from 'lucide-react'

interface ItineraryTimelineProps {
  days: ItineraryDay[]
  allActivities: Activity[]
  tripId: string
}

function EmptyDayDropZone({ dayId }: { dayId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty-${dayId}`, data: { dayId } })
  return (
    <div
      ref={setNodeRef}
      className={`h-10 rounded border-2 border-dashed transition-colors ${
        isOver ? 'border-indigo-400 bg-indigo-50' : 'border-cloud-200'
      }`}
    />
  )
}

export function ItineraryTimeline({ days, allActivities, tripId }: ItineraryTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null)

  const moveActivity = useMoveActivity(tripId)
  const reorderActivities = useReorderActivitiesForDay(tripId)
  const createActivity = useCreateActivityInDay(tripId)
  const deleteDay = useDeleteDay(tripId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Group activities by day ID
  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of allActivities) {
      const group = map.get(a.itinerary_day_id) ?? []
      group.push(a)
      map.set(a.itinerary_day_id, group)
    }
    // Sort each group by sort_order
    for (const [key, acts] of map) {
      map.set(key, [...acts].sort((a, b) => a.sort_order - b.sort_order))
    }
    return map
  }, [allActivities])

  const activeActivity = useMemo(
    () => (activeId ? allActivities.find((a) => a.id === activeId) ?? null : null),
    [activeId, allActivities],
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeActivity = allActivities.find((a) => a.id === active.id)
    if (!activeActivity) return

    const sourceDayId = activeActivity.itinerary_day_id

    // Determine target day
    let targetDayId: string
    const overId = String(over.id)
    if (overId.startsWith('empty-')) {
      targetDayId = overId.replace('empty-', '')
    } else {
      const overActivity = allActivities.find((a) => a.id === overId)
      if (!overActivity) return
      targetDayId = overActivity.itinerary_day_id
    }

    if (sourceDayId === targetDayId) {
      // Same day: reorder
      const dayActs = activitiesByDay.get(sourceDayId) ?? []
      const oldIndex = dayActs.findIndex((a) => a.id === active.id)
      const newIndex = dayActs.findIndex((a) => a.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const reordered = [...dayActs]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      reorderActivities.mutate({ dayId: sourceDayId, activityIds: reordered.map((a) => a.id) })
    } else {
      // Cross-day move
      moveActivity.mutate({ activityId: String(active.id), targetDayId })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative ml-4" data-testid="itinerary-timeline">
        {/* Spine */}
        <div className="absolute left-0 top-2 bottom-2 border-l-2 border-cloud-200" />

        {days.map((day) => {
          const dayActs = activitiesByDay.get(day.id) ?? []
          const formattedDate = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
          const isAdding = expandedDayId === day.id

          return (
            <div key={day.id} className="mb-6">
              {/* Day header */}
              <div className="flex items-center gap-3 mb-2 relative">
                <div className="absolute -left-[1.1875rem] w-3 h-3 rounded-full bg-cloud-300 border-2 border-white flex-shrink-0" />
                <span className="ml-3 text-sm font-semibold text-cloud-700">{formattedDate}</span>
                <div className="flex-1" />
                <button
                  onClick={() => setExpandedDayId(isAdding ? null : day.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add activity
                </button>
                <button
                  onClick={() => setDeletingDayId(day.id)}
                  className="p-1 text-cloud-400 hover:text-red-600 rounded transition-colors"
                  aria-label="Delete day"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Activities */}
              <div className="ml-6 space-y-2">
                <SortableContext
                  items={dayActs.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {dayActs.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} tripId={tripId} />
                  ))}
                </SortableContext>

                {dayActs.length === 0 && !isAdding && (
                  <EmptyDayDropZone dayId={day.id} />
                )}

                {isAdding && (
                  <ActivityForm
                    dayId={day.id}
                    tripId={tripId}
                    onSave={async (data) => {
                      await createActivity.mutateAsync({ dayId: day.id, data })
                      setExpandedDayId(null)
                    }}
                    onCancel={() => setExpandedDayId(null)}
                    isPending={createActivity.isPending}
                    error={createActivity.isError ? (createActivity.error as Error) : null}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeActivity && <ActivityDragCard activity={activeActivity} />}
      </DragOverlay>

      <ConfirmDialog
        isOpen={deletingDayId !== null}
        onClose={() => setDeletingDayId(null)}
        onConfirm={() => {
          if (deletingDayId) {
            deleteDay.mutate(deletingDayId)
            setDeletingDayId(null)
          }
        }}
        title="Delete Day"
        message="Delete this day and all its activities?"
        confirmLabel="Delete"
        isLoading={deleteDay.isPending}
      />
    </DndContext>
  )
}
```

**Step 4: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/itinerary/ItineraryTimeline.tsx frontend/src/components/itinerary/ActivityDragCard.tsx && git commit -m "feat: ItineraryTimeline component with left spine and cross-day DnD"
```

---

### Task 7: Frontend TripDetailPage — wire up timeline

**Files:**
- Modify: `frontend/src/__tests__/TripDetailPage.test.tsx`
- Modify: `frontend/src/pages/TripDetailPage.tsx`

---

**Step 1: Check the current TripDetailPage test**

Read `frontend/src/__tests__/TripDetailPage.test.tsx` to understand what's currently tested. Find any test that checks for `ItineraryDayCard` elements.

**Step 2: Add timeline test and update mock trip data**

The existing tests mock data and check for text/elements. Find the mock trip data in the test file and add `member_previews`, `itinerary_day_count`, `days_with_activities` fields (so TypeScript is happy). Also add a test for the timeline:

Look for the `mockTrip` definition in the test file. Add the new fields:
```typescript
member_previews: [],
itinerary_day_count: 0,
days_with_activities: 0,
```

Then add a new test for the timeline structure:
```typescript
it('renders itinerary-timeline when days are loaded', async () => {
  // This test verifies the timeline container renders.
  // Setup depends on how the existing test file mocks the API.
  // Add mock for useTripActivities (which returns all activities for the trip).
  // The exact mock setup depends on what vi.mock calls exist in the file.
  // At minimum, assert the testid renders when days are present.
})
```

**Important:** The exact test additions depend on the current mock structure in `TripDetailPage.test.tsx`. Read the file first to understand what's mocked and what to assert. The key assertion is:
```typescript
const timeline = await screen.findByTestId('itinerary-timeline')
expect(timeline).toBeInTheDocument()
```

**Step 3: Update TripDetailPage.tsx to use ItineraryTimeline**

Open `frontend/src/pages/TripDetailPage.tsx`.

**Change 1:** Remove the `ItineraryDayCard` import and add `ItineraryTimeline`. Also add `useTripActivities` to the itinerary hook imports:

```tsx
// Remove:
import { ItineraryDayCard } from '../components/itinerary/ItineraryDayCard'

// Add:
import { ItineraryTimeline } from '../components/itinerary/ItineraryTimeline'
```

In the hook imports line (line 11), add `useTripActivities`:
```tsx
import { useItineraryDays, useGenerateDays, useDeleteDay, useTripActivities } from '../hooks/useItinerary'
```

**Change 2:** Add the `useTripActivities` call near the other itinerary hooks (around line 97):

```tsx
const { data: allActivities } = useTripActivities(tripId)
```

**Change 3:** Replace the itinerary list rendering (the `<div className="space-y-4">` block, around lines 499–504):

Current:
```tsx
) : itineraryDays && itineraryDays.length > 0 ? (
  <div className="space-y-4">
    {itineraryDays.map((day) => (
      <ItineraryDayCard key={day.id} day={day} tripId={tripId} />
    ))}
  </div>
```

Replace with:
```tsx
) : itineraryDays && itineraryDays.length > 0 ? (
  <ItineraryTimeline
    days={itineraryDays}
    allActivities={allActivities ?? []}
    tripId={tripId}
  />
```

**Step 4: Run type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
```

Fix any type errors. Common ones:
- `TripSummary` missing new required fields in mock data → add them with empty/zero values
- `member_previews` being non-optional in existing tests

**Step 5: Run all frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: PASS (all tests)

**Step 6: Commit**

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/pages/TripDetailPage.tsx frontend/src/__tests__/TripDetailPage.test.tsx && git commit -m "feat: replace ItineraryDayCard with ItineraryTimeline in TripDetailPage"
```

---

### Task 8: Full validation

**Step 1: Run backend tests**

```bash
cd /Users/nick/Code/travel-planner/backend && uv run pytest
```

Expected: All tests pass

**Step 2: Run frontend tests**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run
```

Expected: All tests pass

**Step 3: Type check**

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 4: Backend lint**

```bash
cd /Users/nick/Code/travel-planner/backend && uv run ruff check . && uv run ruff format --check .
```

Expected: No issues

**Step 5: Frontend lint**

```bash
cd /Users/nick/Code/travel-planner/frontend && npm run lint
```

Expected: No issues
