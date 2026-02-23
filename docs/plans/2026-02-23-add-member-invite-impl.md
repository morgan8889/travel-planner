# Add Member Invite Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a trip owner adds a member by email and the person doesn't have an account, send them a Supabase invite email and show the invitation as a pending row in the members list.

**Architecture:** New `trip_invitations` table stores pending invites. `POST /trips/{id}/members` falls back to a Supabase Admin API invite when the email isn't found in auth. `GET /trips` and `GET /trips/{id}` auto-claim pending invitations when the signed-in user's email matches. A new `GET /trips/{id}/invitations` endpoint feeds pending rows to the frontend members list.

**Tech Stack:** FastAPI + SQLAlchemy (backend), httpx (Supabase Admin API call), React + TanStack Query (frontend), Supabase Auth (invite emails)

---

### Task 1: Migration + ORM model for `trip_invitations`

**Files:**
- Create: `backend/alembic/versions/<rev>_add_trip_invitations.py`
- Modify: `backend/src/travel_planner/models/trip.py`
- Test: `backend/tests/test_trips.py`

**Step 1: Get current head revision**

```bash
cd backend && uv run alembic heads
# Output: 0c007800d779 (head)
```

**Step 2: Write the failing test**

Add to `backend/tests/test_trips.py`:

```python
from travel_planner.models.trip import TripInvitation  # import will fail until model exists

def test_trip_invitation_model_fields():
    """TripInvitation has the expected fields."""
    inv = TripInvitation.__table__
    col_names = {c.name for c in inv.columns}
    assert col_names == {"id", "trip_id", "email", "invited_by", "created_at"}
```

**Step 3: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_trips.py::test_trip_invitation_model_fields -v
# Expected: FAIL with ImportError (TripInvitation not defined)
```

**Step 4: Add `TripInvitation` ORM model to `backend/src/travel_planner/models/trip.py`**

Add after the `TripMember` class:

```python
class TripInvitation(Base):
    __tablename__ = "trip_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE")
    )
    email: Mapped[str] = mapped_column(String(255))
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

**Step 5: Create the Alembic migration**

Create `backend/alembic/versions/<new_rev>_add_trip_invitations.py` — replace `<new_rev>` with a fresh hex string (e.g. `b1c2d3e4f567`):

```python
"""add trip_invitations table

Revision ID: b1c2d3e4f567
Revises: 0c007800d779
Create Date: 2026-02-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "b1c2d3e4f567"
down_revision = "0c007800d779"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trip_invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("trip_id", UUID(as_uuid=True), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_trip_invitations_email", "trip_invitations", ["email"])


def downgrade() -> None:
    op.drop_index("ix_trip_invitations_email", "trip_invitations")
    op.drop_table("trip_invitations")
```

**Step 6: Apply migration**

```bash
cd backend && uv run alembic upgrade head
# Expected: INFO running upgrade 0c007800d779 -> b1c2d3e4f567
```

**Step 7: Run test to verify it passes**

```bash
cd backend && uv run pytest tests/test_trips.py::test_trip_invitation_model_fields -v
# Expected: PASS
```

**Step 8: Commit**

```bash
git add backend/alembic/versions/ backend/src/travel_planner/models/trip.py backend/tests/test_trips.py
git commit -m "feat: add TripInvitation model and migration"
```

---

### Task 2: `GET /trips/{id}/invitations` endpoint + schema

**Files:**
- Modify: `backend/src/travel_planner/schemas/trip.py`
- Modify: `backend/src/travel_planner/routers/trips.py`
- Test: `backend/tests/test_trips.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_trips.py`:

```python
def test_list_invitations_owner_only(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips/{id}/invitations returns 403 for non-owner."""
    regular_user = _make_user()
    regular_member = _make_member(user=regular_user, role=MemberRole.member)
    trip = _make_trip(members=[regular_member])

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = trip
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.get(f"/trips/{TRIP_ID}/invitations", headers=auth_headers)
    assert response.status_code == 403


def test_list_invitations_success(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips/{id}/invitations returns pending invitations for owner."""
    from datetime import datetime, timezone
    from travel_planner.models.trip import TripInvitation

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    inv = MagicMock(spec=TripInvitation)
    inv.id = UUID("663e4567-e89b-12d3-a456-426614174005")
    inv.trip_id = TRIP_ID
    inv.email = "pending@example.com"
    inv.invited_by = TEST_USER_ID
    inv.created_at = datetime(2026, 2, 23, tzinfo=timezone.utc)

    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [inv]

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(f"/trips/{TRIP_ID}/invitations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["email"] == "pending@example.com"
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_invitations_owner_only tests/test_trips.py::test_list_invitations_success -v
# Expected: FAIL (endpoint doesn't exist yet)
```

**Step 3: Add schema to `backend/src/travel_planner/schemas/trip.py`**

Add after `UpdateMemberRole`:

```python
class TripInvitationResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    email: str
    invited_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
```

Also add `from datetime import datetime` at the top if not already present (check — it imports `date` and `datetime` already on line 3).

**Step 4: Add the endpoint to `backend/src/travel_planner/routers/trips.py`**

Add the import for `TripInvitation` and `TripInvitationResponse`. In the imports section at the top, add to the models import:

```python
from travel_planner.models.trip import MemberRole, Trip, TripInvitation, TripMember, TripStatus
```

Add to schemas import:

```python
from travel_planner.schemas.trip import (
    AddMemberRequest,
    MemberPreview,
    TripCreate,
    TripInvitationResponse,
    TripMemberResponse,
    TripResponse,
    TripSummary,
    TripUpdate,
    UpdateMemberRole,
    _member_color,
    _member_initials,
)
```

Add the endpoint after the existing `add_member` endpoint (around line 460):

```python
@router.get("/{trip_id}/invitations", response_model=list[TripInvitationResponse])
async def list_invitations(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> list[TripInvitationResponse]:
    """List pending invitations for a trip. Owner-only."""
    _, membership = await get_trip_with_membership(trip_id, user_id, db)
    if membership.role != MemberRole.owner:
        raise HTTPException(status_code=403, detail="Only the trip owner can view invitations")

    stmt = select(TripInvitation).where(TripInvitation.trip_id == trip_id)
    result = await db.execute(stmt)
    return result.scalars().all()
```

**Step 5: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_invitations_owner_only tests/test_trips.py::test_list_invitations_success -v
# Expected: PASS
```

**Step 6: Run full backend checks**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest -q
# Expected: all pass
```

**Step 7: Commit**

```bash
git add backend/src/travel_planner/schemas/trip.py backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py
git commit -m "feat: add GET /trips/{id}/invitations endpoint"
```

---

### Task 3: Invite branch in `POST /trips/{id}/members`

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py`
- Test: `backend/tests/test_trips.py`

**Context:** When email is not in `user_profiles` or `auth.users`, the backend should call the Supabase Admin API to invite the user, insert a `trip_invitations` row, and return HTTP 202. Also remove the debug `logger.warning` calls added during debugging.

**Step 1: Write the failing test**

Add to `backend/tests/test_trips.py`:

```python
def test_add_member_sends_invite_when_no_account(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """POST /trips/{id}/members returns 202 and creates invitation when email unknown."""
    from unittest.mock import patch, AsyncMock as AsyncMockImport
    import httpx

    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # Call 1: get_trip_with_membership → trip found
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Call 2: user_profiles lookup → not found
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    # Call 3: auth.users lookup → not found
    result_mock3 = MagicMock()
    result_mock3.fetchone.return_value = None

    # Call 4: check existing invitation → not found
    result_mock4 = MagicMock()
    result_mock4.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2, result_mock3, result_mock4])
    mock_db_session.add = MagicMock()

    # Mock httpx so we don't hit Supabase in tests
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200

    with patch("travel_planner.routers.trips.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        payload = {"email": "newuser@example.com"}
        response = client.post(
            f"/trips/{TRIP_ID}/members", json=payload, headers=auth_headers
        )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "invited"
    assert data["email"] == "newuser@example.com"
```

**Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_trips.py::test_add_member_sends_invite_when_no_account -v
# Expected: FAIL
```

**Step 3: Update `add_member` in `backend/src/travel_planner/routers/trips.py`**

Add `httpx` and `Response` imports at the top:

```python
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from travel_planner.config import settings
```

Replace the current `add_member` body — specifically the section from "Look up the user by email" to the `if target_user is None: raise HTTPException(404)` — with this updated version:

```python
@router.post("/{trip_id}/members", status_code=201, response_model=TripMemberResponse)
async def add_member(
    trip_id: UUID,
    body: AddMemberRequest,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
) -> TripMemberResponse | Response:
    """Add a member to a trip by email. Returns 201 if added, 202 if invite sent."""
    trip, _ = await get_trip_with_membership(trip_id, user_id, db, require_owner=True)

    # Normalize email
    email = body.email.lower().strip()

    # 1. Look up in local user_profiles
    stmt = select(UserProfile).where(UserProfile.email == email)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()

    # 2. Fall back to auth.users (user has account but hasn't created a trip yet)
    if target_user is None:
        auth_row = await db.execute(
            text("SELECT id FROM auth.users WHERE email = :email"),
            {"email": email},
        )
        auth_user = auth_row.fetchone()
        if auth_user:
            auth_user_id = UUID(str(auth_user[0]))
            display_name = email.split("@")[0]
            upsert = insert(UserProfile).values(
                id=auth_user_id,
                email=email,
                display_name=display_name,
            )
            upsert = upsert.on_conflict_do_update(
                index_elements=["id"],
                set_={"email": email},
            )
            await db.execute(upsert)
            r2 = await db.execute(
                select(UserProfile).where(UserProfile.id == auth_user_id)
            )
            target_user = r2.scalar_one_or_none()

    # 3. No account at all — send Supabase invite, create pending invitation
    if target_user is None:
        # Check for duplicate pending invitation
        existing_inv = await db.execute(
            select(TripInvitation).where(
                TripInvitation.trip_id == trip_id,
                TripInvitation.email == email,
            )
        )
        if existing_inv.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Invitation already sent to this email")

        if settings.supabase_service_role_key:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{settings.supabase_url}/auth/v1/admin/users",
                    headers={
                        "apikey": settings.supabase_service_role_key,
                        "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    },
                    json={"email": email},
                )

        invitation = TripInvitation(
            trip_id=trip_id,
            email=email,
            invited_by=user_id,
        )
        db.add(invitation)
        await db.commit()
        return Response(
            content=f'{{"status":"invited","email":"{email}"}}',
            status_code=202,
            media_type="application/json",
        )

    # Check if already a member
    existing = next((m for m in trip.members if m.user_id == target_user.id), None)
    if existing is not None:
        raise HTTPException(status_code=409, detail="User is already a member of this trip")

    member = TripMember(trip_id=trip_id, user_id=target_user.id, role=MemberRole.member)
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return TripMemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        display_name=target_user.display_name,
        email=target_user.email,
    )
```

**Step 4: Run test to verify it passes**

```bash
cd backend && uv run pytest tests/test_trips.py::test_add_member_sends_invite_when_no_account -v
# Expected: PASS
```

**Step 5: Run full backend checks**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest -q
# Expected: all pass
```

**Step 6: Commit**

```bash
git add backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py
git commit -m "feat: send invite email and create pending invitation when member email not found"
```

---

### Task 4: Auto-claim pending invitations on `GET /trips` and `GET /trips/{id}`

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py`
- Test: `backend/tests/test_trips.py`

**Context:** When a user loads their trips, the backend checks if their email matches any pending `trip_invitations`. If so, it adds them as members and deletes the invitation rows. This is the same "self-healing on load" pattern used by auto-complete. We need `user.email` which requires changing `CurrentUserId` → `CurrentUser` in `list_trips` and `get_trip`.

**Step 1: Write the failing test**

```python
def test_list_trips_claims_pending_invitation(
    client: TestClient, auth_headers: dict, override_get_db, mock_db_session
):
    """GET /trips auto-claims pending invitations for the current user's email."""
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user, role=MemberRole.owner)
    trip = _make_trip(members=[owner_member])

    # trips query result
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [trip]
    trips_result = MagicMock()
    trips_result.scalars.return_value = scalars_mock

    # pending invitation for TEST_USER_EMAIL
    from travel_planner.models.trip import TripInvitation
    inv = MagicMock(spec=TripInvitation)
    inv.id = UUID("663e4567-e89b-12d3-a456-426614174005")
    inv.trip_id = TRIP_ID
    inv.email = TEST_USER_EMAIL
    inv.invited_by = OTHER_USER_ID

    inv_scalars = MagicMock()
    inv_scalars.all.return_value = [inv]
    inv_result = MagicMock()
    inv_result.scalars.return_value = inv_scalars

    # stats query
    stats_result = MagicMock()
    stats_result.all.return_value = []

    mock_db_session.execute = AsyncMock(side_effect=[trips_result, inv_result, stats_result])
    mock_db_session.add = MagicMock()
    mock_db_session.delete = AsyncMock()

    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    # Verify delete was called (invitation claimed)
    mock_db_session.delete.assert_called_once()
```

**Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_trips_claims_pending_invitation -v
# Expected: FAIL
```

**Step 3: Add `_claim_pending_invitations` helper and update `list_trips` / `get_trip`**

Add helper function in `trips.py` (after `get_trip_with_membership`):

```python
async def _claim_pending_invitations(user_id: UUID, user_email: str | None, db: AsyncSession) -> None:
    """Auto-add user to trips they were invited to before having an account."""
    if not user_email:
        return
    email = user_email.lower()
    stmt = select(TripInvitation).where(TripInvitation.email == email)
    result = await db.execute(stmt)
    invitations = result.scalars().all()
    if not invitations:
        return
    for inv in invitations:
        member = TripMember(trip_id=inv.trip_id, user_id=user_id, role=MemberRole.member)
        db.add(member)
        await db.delete(inv)
    try:
        await db.commit()
    except Exception:
        logger.exception("Failed to claim pending invitations for %s", email)
        await db.rollback()
```

Update `list_trips` signature to use `CurrentUser` and call the helper:

```python
# Change:
#   user_id: CurrentUserId,
# To:
#   user: CurrentUser,
# And update user_id references to user.id

@router.get("", response_model=list[TripSummary])
async def list_trips(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status: TripStatus | None = Query(default=None),
) -> list[TripSummary]:
    """List all trips the current user is a member of."""
    await _claim_pending_invitations(user.id, user.email, db)

    stmt = (
        select(Trip)
        .join(TripMember)
        .where(TripMember.user_id == user.id)
        ...
    )
```

Do the same for `get_trip`:

```python
@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> TripResponse:
    await _claim_pending_invitations(user.id, user.email, db)
    trip, _ = await get_trip_with_membership(trip_id, user.id, db)
    ...
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_trips.py::test_list_trips_claims_pending_invitation -v
# Expected: PASS
```

**Step 5: Run full backend checks**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest -q
# Expected: all pass (some existing tests may need mock updates if list_trips signature changed — fix by checking that `override_get_current_user` still works, it overrides `get_current_user` which returns `AuthUser` used by both `CurrentUser` and `CurrentUserId`)
```

**Note on existing tests:** If tests that call `GET /trips` fail because `user_id: CurrentUserId` was changed to `user: CurrentUser`, check `conftest.py` to see how `override_get_current_user` is set up. If it already returns an `AuthUser` object with both `.id` and `.email`, all existing tests should pass unchanged.

**Step 6: Commit**

```bash
git add backend/src/travel_planner/routers/trips.py backend/tests/test_trips.py
git commit -m "feat: auto-claim pending invitations on GET /trips and GET /trips/{id}"
```

---

### Task 5: Frontend — `TripInvitation` type + `useInvitations` hook

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/hooks/useTrips.ts`
- Modify: `frontend/src/hooks/useMembers.ts`
- Test: `frontend/src/__tests__/AddMemberModal.test.tsx` (will update in Task 7)

**Step 1: Add `TripInvitation` to `frontend/src/lib/types.ts`**

Add after the `TripMember` interface:

```typescript
export interface TripInvitation {
  id: string
  trip_id: string
  email: string
  invited_by: string
  created_at: string
}
```

**Step 2: Add `invitations` key to `tripKeys` in `frontend/src/hooks/useTrips.ts`**

```typescript
export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (status?: TripStatus) => [...tripKeys.lists(), { status }] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripKeys.details(), id] as const,
  invitations: (id: string) => [...tripKeys.detail(id), 'invitations'] as const,
}
```

**Step 3: Add `useInvitations` to `frontend/src/hooks/useMembers.ts`**

Add the import for `TripInvitation` and `tripKeys`:

```typescript
import type { TripMember, MemberRole, TripInvitation } from '../lib/types'
import { tripKeys } from './useTrips'
```

Add the new hook:

```typescript
export function useInvitations(tripId: string, isOwner: boolean) {
  return useQuery({
    queryKey: tripKeys.invitations(tripId),
    queryFn: async () => {
      const { data } = await api.get<TripInvitation[]>(`/trips/${tripId}/invitations`)
      return data
    },
    enabled: isOwner,
  })
}
```

Also update `useAddMember` to invalidate invitations on success:

```typescript
export function useAddMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post(`/trips/${tripId}/members`, { email })
      return response
    },
    onSuccess: (_data, _variables, _context) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.invitations(tripId) })
    },
  })
}
```

**Step 4: Run type check**

```bash
cd frontend && npx tsc --noEmit
# Expected: no errors
```

**Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/useTrips.ts frontend/src/hooks/useMembers.ts
git commit -m "feat: add TripInvitation type, invitations query key, and useInvitations hook"
```

---

### Task 6: Frontend — `TripMembersList` shows pending rows

**Files:**
- Modify: `frontend/src/components/trips/TripMembersList.tsx`
- Test: `frontend/src/__tests__/TripMembersList.test.tsx`

**Step 1: Write the failing test**

Add to `frontend/src/__tests__/TripMembersList.test.tsx`:

```typescript
import type { TripInvitation } from '../lib/types'

const mockInvitation: TripInvitation = {
  id: 'inv-1',
  trip_id: 'trip-1',
  email: 'pending@example.com',
  invited_by: 'user-1',
  created_at: '2026-02-23T00:00:00Z',
}

it('renders pending invitation row with Pending badge', () => {
  render(
    <TripMembersList
      members={[]}
      invitations={[mockInvitation]}
      isOwner={true}
    />
  )
  expect(screen.getByText('pending@example.com')).toBeInTheDocument()
  expect(screen.getByText('Pending')).toBeInTheDocument()
})

it('renders no pending rows when invitations is empty', () => {
  render(
    <TripMembersList
      members={[]}
      invitations={[]}
      isOwner={false}
    />
  )
  expect(screen.queryByText('Pending')).not.toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/TripMembersList.test.tsx
# Expected: FAIL (invitations prop doesn't exist yet)
```

**Step 3: Update `TripMembersList`**

Full updated component:

```typescript
import type { TripMember, TripInvitation } from '../../lib/types'
import { X } from 'lucide-react'

interface TripMembersListProps {
  members: TripMember[]
  invitations?: TripInvitation[]
  isOwner: boolean
  onRemove?: (memberId: string) => void
  onUpdateRole?: (memberId: string, role: 'owner' | 'member') => void
}

// ... (keep getInitials and avatarColors unchanged)

export function TripMembersList({
  members,
  invitations = [],
  isOwner,
  onRemove,
  onUpdateRole,
}: TripMembersListProps) {
  return (
    <ul className="divide-y divide-cloud-100">
      {members.map((member, index) => (
        // ... existing member rows unchanged
      ))}

      {invitations.map((inv) => (
        <li key={inv.id} className="flex items-center gap-3 py-3 last:pb-0 opacity-50">
          <div className="w-9 h-9 rounded-full bg-cloud-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-cloud-500">?</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-cloud-500 truncate">{inv.email}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Pending
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/__tests__/TripMembersList.test.tsx
# Expected: PASS
```

**Step 5: Commit**

```bash
git add frontend/src/components/trips/TripMembersList.tsx frontend/src/__tests__/TripMembersList.test.tsx
git commit -m "feat: show pending invitation rows in TripMembersList"
```

---

### Task 7: Frontend — `TripDetailPage` wires it all together

**Files:**
- Modify: `frontend/src/pages/TripDetailPage.tsx`
- Test: `frontend/src/__tests__/TripDetailPage.test.tsx`

**Step 1: Write the failing test**

Add to `frontend/src/__tests__/TripDetailPage.test.tsx`:

```typescript
it('shows pending invitation in members list', async () => {
  // Mock useInvitations to return a pending invite
  vi.mock('../hooks/useMembers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../hooks/useMembers')>()
    return {
      ...actual,
      useInvitations: () => ({
        data: [{ id: 'inv-1', trip_id: mockTrip.id, email: 'pending@test.com', invited_by: 'u1', created_at: '' }],
        isLoading: false,
      }),
    }
  })
  // render TripDetailPage with owner trip and check Pending badge visible
  // ... (follow existing test patterns in this file)
})
```

**Step 2: Import `useInvitations` in `TripDetailPage.tsx`**

```typescript
import { useAddMember, useRemoveMember, useUpdateMemberRole, useInvitations } from '../hooks/useMembers'
```

**Step 3: Add invitations query and pass to `TripMembersList`**

Find where `isOwner` is computed (it's derived from the current user and trip members). Then:

```typescript
const { data: invitations = [] } = useInvitations(tripId, isOwner)
```

Find the `<TripMembersList>` usage (around line 600+) and add the `invitations` prop:

```tsx
<TripMembersList
  members={trip.members}
  invitations={invitations}
  isOwner={isOwner}
  onRemove={handleRemoveMember}
  onUpdateRole={handleUpdateRole}
/>
```

**Step 4: Handle 202 in `handleAddMember`**

The mutation now returns the full axios response. Update to close the modal on both 201 and 202:

```typescript
function handleAddMember(email: string) {
  setAddMemberError(null)
  addMember.mutate(email, {
    onSuccess: () => {
      setShowAddMember(false)
      setAddMemberError(null)
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Failed to add member'
      setAddMemberError(message)
    },
  })
}
```

No change needed here — `onSuccess` fires for any 2xx (201 and 202 both). The pending row appearing in the list is the feedback.

**Step 5: Run type check and tests**

```bash
cd frontend && npx tsc --noEmit && npx vitest run src/__tests__/TripDetailPage.test.tsx
# Expected: no errors, tests pass
```

**Step 6: Run all frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
# Expected: all pass
```

**Step 7: Commit**

```bash
git add frontend/src/pages/TripDetailPage.tsx frontend/src/__tests__/TripDetailPage.test.tsx
git commit -m "feat: wire invitations into TripDetailPage members section"
```

---

### Task 8: End-to-end verification + cleanup

**Files:**
- Modify: `backend/src/travel_planner/routers/trips.py` (remove debug logger.warning calls)

**Step 1: Add `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env`**

The user needs to add this manually from their Supabase project settings (Project Settings → API → service_role key).

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**Step 2: Remove debug logging**

In `trips.py`, remove these two lines added during debugging:
```python
logger.warning("add_member: local profile lookup for %s → %s, service_key_set=%s", body.email, target_user, False)
logger.warning("add_member: auth.users lookup for %s → %s", body.email, auth_user)
```

**Step 3: Run full checks**

```bash
# Backend
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest -q

# Frontend
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

**Step 4: Restart backend and verify in browser**

```bash
kill $(lsof -ti:8000) 2>/dev/null
cd backend && uv run uvicorn travel_planner.main:app --port 8000 &
```

Navigate to a trip, try adding an email that doesn't have an account. Expected:
- Modal closes
- Pending row appears in members list with amber "Pending" badge
- Supabase sends invite email to that address

**Step 5: Commit cleanup**

```bash
git add backend/src/travel_planner/routers/trips.py
git commit -m "chore: remove debug logging from add_member"
```
