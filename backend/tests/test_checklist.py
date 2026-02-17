from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from travel_planner.models.checklist import Checklist, ChecklistItem, ChecklistItemUser
from tests.conftest import (
    OTHER_USER_EMAIL,
    OTHER_USER_ID,
    TEST_USER_ID,
    TRIP_ID,
    create_test_token,
    make_member,
    make_trip,
    make_user,
)

# Local aliases matching the previous private naming convention
_make_user = make_user
_make_trip = make_trip
_make_member = make_member


@pytest.fixture
def trip_id() -> str:
    """Return trip ID as string."""
    return str(TRIP_ID)


@pytest.fixture
def other_user_headers() -> dict[str, str]:
    """Create authorization headers for a different user."""
    token = create_test_token(str(OTHER_USER_ID), OTHER_USER_EMAIL)
    return {"Authorization": f"Bearer {token}"}


def test_create_checklist(
    client: TestClient, auth_headers: dict, trip_id: str, override_get_db, mock_db_session
):
    """Create checklist for trip"""
    # Setup: Trip exists and user is a member
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # First call: verify_trip_member query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    mock_db_session.execute = AsyncMock(return_value=result_mock1)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    # Mock refresh to set the ID on the checklist object
    async def mock_refresh(obj):
        obj.id = UUID("777e4567-e89b-12d3-a456-426614174006")

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/checklist/trips/{trip_id}/checklists",
        headers=auth_headers,
        json={
            "title": "Packing List"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Packing List"
    assert data["trip_id"] == trip_id
    assert data["items"] == []


def test_create_checklist_not_member(
    client: TestClient, other_user_headers: dict, trip_id: str, override_get_db, mock_db_session
):
    """Non-member cannot create checklist"""
    # Setup: verify_trip_member query returns None (user not a member)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.post(
        f"/checklist/trips/{trip_id}/checklists",
        headers=other_user_headers,
        json={"title": "Packing List"}
    )
    assert response.status_code == 403


def test_list_checklists_empty(
    client: TestClient, auth_headers: dict, trip_id: str, override_get_db, mock_db_session
):
    """List checklists for trip with no checklists returns empty list"""
    # Setup: Trip exists and user is a member
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    # First call: verify_trip_member query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: list checklists
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = []

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(
        f"/checklist/trips/{trip_id}/checklists",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []


def test_list_checklists_with_items(
    client: TestClient, auth_headers: dict, trip_id: str, override_get_db, mock_db_session
):
    """List checklists with items and user check status"""
    # Setup: Trip exists and user is a member
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    checklist_id = UUID("555e4567-e89b-12d3-a456-426614174004")
    item1_id = UUID("666e4567-e89b-12d3-a456-426614174005")
    item2_id = UUID("777e4567-e89b-12d3-a456-426614174006")

    # Create checklist with items
    checklist = MagicMock(spec=Checklist)
    checklist.id = checklist_id
    checklist.trip_id = TRIP_ID
    checklist.title = "Packing List"

    # Item 1 - checked by user
    item1 = MagicMock(spec=ChecklistItem)
    item1.id = item1_id
    item1.checklist_id = checklist_id
    item1.text = "Passport"
    item1.sort_order = 0

    # User has checked this item
    user_check1 = MagicMock(spec=ChecklistItemUser)
    user_check1.item_id = item1_id
    user_check1.user_id = TEST_USER_ID
    user_check1.checked = True

    item1.user_checks = [user_check1]

    # Item 2 - not checked by user
    item2 = MagicMock(spec=ChecklistItem)
    item2.id = item2_id
    item2.checklist_id = checklist_id
    item2.text = "Sunscreen"
    item2.sort_order = 1
    item2.user_checks = []  # No user checks

    checklist.items = [item1, item2]

    # First call: verify_trip_member query
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = trip

    # Second call: list checklists with items
    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [checklist]

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get(
        f"/checklist/trips/{trip_id}/checklists",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    assert data[0]["id"] == str(checklist_id)
    assert data[0]["title"] == "Packing List"
    assert len(data[0]["items"]) == 2

    # Verify item 1 is checked
    assert data[0]["items"][0]["id"] == str(item1_id)
    assert data[0]["items"][0]["text"] == "Passport"
    assert data[0]["items"][0]["checked"] is True

    # Verify item 2 is not checked
    assert data[0]["items"][1]["id"] == str(item2_id)
    assert data[0]["items"][1]["text"] == "Sunscreen"
    assert data[0]["items"][1]["checked"] is False


def test_add_item_to_checklist(
    client: TestClient, auth_headers: dict, checklist_id: str, override_get_db, mock_db_session
):
    """Add item to checklist with auto-incremented sort_order"""
    # Setup: Checklist exists and user has access
    cl_id = UUID(checklist_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    checklist = MagicMock(spec=Checklist)
    checklist.id = cl_id
    checklist.trip_id = TRIP_ID
    checklist.title = "Packing List"

    # First call: get checklist
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = checklist

    # Second call: verify_trip_member
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: get max sort_order
    result_mock3 = MagicMock()
    result_mock3.scalar.return_value = 2  # Max sort_order is 2

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2, result_mock3])
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    # Mock refresh to set the ID on the item object
    async def mock_refresh(obj):
        obj.id = UUID("888e4567-e89b-12d3-a456-426614174007")

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/checklist/checklists/{checklist_id}/items",
        headers=auth_headers,
        json={
            "text": "Toothbrush"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "Toothbrush"
    assert data["sort_order"] == 3  # Auto-incremented from max 2
    assert data["checked"] is False  # New items are unchecked


def test_add_item_not_member(
    client: TestClient, other_user_headers: dict, checklist_id: str, override_get_db, mock_db_session
):
    """Non-member cannot add item to checklist"""
    # Setup: Checklist exists but user is not a member
    cl_id = UUID(checklist_id)
    checklist = MagicMock(spec=Checklist)
    checklist.id = cl_id
    checklist.trip_id = TRIP_ID

    # First call: get checklist
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = checklist

    # Second call: verify_trip_member returns None
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.post(
        f"/checklist/checklists/{checklist_id}/items",
        headers=other_user_headers,
        json={"text": "Toothbrush"}
    )
    assert response.status_code == 403


def test_toggle_item_check_on(
    client: TestClient, auth_headers: dict, item_id: str, override_get_db, mock_db_session
):
    """Toggle item from unchecked to checked"""
    # Setup: Item exists and user has access
    it_id = UUID(item_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    checklist = MagicMock(spec=Checklist)
    checklist.id = UUID("555e4567-e89b-12d3-a456-426614174004")
    checklist.trip_id = TRIP_ID

    item = MagicMock(spec=ChecklistItem)
    item.id = it_id
    item.checklist_id = checklist.id
    item.text = "Passport"
    item.sort_order = 0
    item.checklist = checklist

    # First call: get item with checklist
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = item

    # Second call: verify_trip_member
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: get existing ChecklistItemUser (none exists)
    result_mock3 = MagicMock()
    result_mock3.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2, result_mock3])
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    # Mock refresh
    async def mock_refresh(obj):
        if isinstance(obj, ChecklistItemUser):
            obj.checked = True

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/checklist/items/{item_id}/toggle",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(it_id)
    assert data["text"] == "Passport"
    assert data["checked"] is True


def test_toggle_item_check_off(
    client: TestClient, auth_headers: dict, item_id: str, override_get_db, mock_db_session
):
    """Toggle item from checked to unchecked"""
    # Setup: Item exists and user has access
    it_id = UUID(item_id)
    owner_user = _make_user()
    owner_member = _make_member(user=owner_user)
    trip = _make_trip(members=[owner_member])

    checklist = MagicMock(spec=Checklist)
    checklist.id = UUID("555e4567-e89b-12d3-a456-426614174004")
    checklist.trip_id = TRIP_ID

    item = MagicMock(spec=ChecklistItem)
    item.id = it_id
    item.checklist_id = checklist.id
    item.text = "Passport"
    item.sort_order = 0
    item.checklist = checklist

    # Existing user check (checked)
    user_check = MagicMock(spec=ChecklistItemUser)
    user_check.item_id = it_id
    user_check.user_id = TEST_USER_ID
    user_check.checked = True

    # First call: get item with checklist
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = item

    # Second call: verify_trip_member
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = trip

    # Third call: get existing ChecklistItemUser
    result_mock3 = MagicMock()
    result_mock3.scalar_one_or_none.return_value = user_check

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2, result_mock3])
    mock_db_session.commit = AsyncMock()

    # Mock refresh to flip the checked status
    async def mock_refresh(obj):
        obj.checked = False

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        f"/checklist/items/{item_id}/toggle",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(it_id)
    assert data["text"] == "Passport"
    assert data["checked"] is False


def test_toggle_item_not_member(
    client: TestClient, other_user_headers: dict, item_id: str, override_get_db, mock_db_session
):
    """Non-member cannot toggle item"""
    # Setup: Item exists but user is not a member
    it_id = UUID(item_id)
    checklist = MagicMock(spec=Checklist)
    checklist.id = UUID("555e4567-e89b-12d3-a456-426614174004")
    checklist.trip_id = TRIP_ID

    item = MagicMock(spec=ChecklistItem)
    item.id = it_id
    item.checklist_id = checklist.id
    item.checklist = checklist

    # First call: get item with checklist
    result_mock1 = MagicMock()
    result_mock1.scalar_one_or_none.return_value = item

    # Second call: verify_trip_member returns None
    result_mock2 = MagicMock()
    result_mock2.scalar_one_or_none.return_value = None

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.post(
        f"/checklist/items/{item_id}/toggle",
        headers=other_user_headers
    )
    assert response.status_code == 403
