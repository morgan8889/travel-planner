from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

from tests.conftest import OTHER_USER_ID, TEST_USER_ID
from travel_planner.models.calendar import CustomDay, HolidayCalendar
from travel_planner.schemas.calendar import CustomDayCreate, EnableCountryRequest

HOLIDAY_CAL_ID = UUID("aaa14567-e89b-12d3-a456-426614174010")
CUSTOM_DAY_ID = UUID("bbb24567-e89b-12d3-a456-426614174011")


# --- Schema Tests ---


def test_custom_day_create_valid():
    cd = CustomDayCreate(name="Mom's birthday", date=date(2026, 5, 15), recurring=True)
    assert cd.name == "Mom's birthday"
    assert cd.recurring is True


def test_enable_country_valid():
    req = EnableCountryRequest(country_code="US", year=2026)
    assert req.country_code == "US"
    assert req.year == 2026


# --- API Tests ---


def test_get_supported_countries(client, auth_headers):
    response = client.get("/calendar/supported-countries", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    codes = [c["code"] for c in data]
    assert "US" in codes


def test_enable_country(client, auth_headers, override_get_db, mock_db_session):
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    async def mock_refresh(obj):
        obj.id = HOLIDAY_CAL_ID
        obj.country_code = "US"
        obj.year = 2026

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        "/calendar/holidays/country",
        headers=auth_headers,
        json={"country_code": "US", "year": 2026},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["country_code"] == "US"
    assert data["year"] == 2026


def test_enable_country_duplicate(
    client, auth_headers, override_get_db, mock_db_session
):
    existing = MagicMock(spec=HolidayCalendar)
    existing.id = HOLIDAY_CAL_ID
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = existing
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.post(
        "/calendar/holidays/country",
        headers=auth_headers,
        json={"country_code": "US", "year": 2026},
    )
    assert response.status_code == 409


def test_enable_country_unsupported(
    client, auth_headers, override_get_db, mock_db_session
):
    response = client.post(
        "/calendar/holidays/country",
        headers=auth_headers,
        json={"country_code": "ZZ", "year": 2026},
    )
    assert response.status_code == 400


def test_disable_country(client, auth_headers, override_get_db, mock_db_session):
    cal = MagicMock(spec=HolidayCalendar)
    cal.id = HOLIDAY_CAL_ID
    cal.user_id = TEST_USER_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = cal
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        "/calendar/holidays/country/US?year=2026",
        headers=auth_headers,
    )
    assert response.status_code == 204


def test_create_custom_day(client, auth_headers, override_get_db, mock_db_session):
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    from datetime import UTC, datetime

    async def mock_refresh(obj):
        obj.id = CUSTOM_DAY_ID
        obj.created_at = datetime(2026, 1, 1, tzinfo=UTC)

    mock_db_session.refresh = AsyncMock(side_effect=mock_refresh)

    response = client.post(
        "/calendar/custom-days",
        headers=auth_headers,
        json={"name": "Mom's birthday", "date": "2026-05-15", "recurring": True},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Mom's birthday"
    assert data["recurring"] is True


def test_delete_custom_day(client, auth_headers, override_get_db, mock_db_session):
    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = TEST_USER_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = cd
    mock_db_session.execute = AsyncMock(return_value=result_mock)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = client.delete(
        f"/calendar/custom-days/{CUSTOM_DAY_ID}",
        headers=auth_headers,
    )
    assert response.status_code == 204


def test_delete_custom_day_not_owner(
    client, auth_headers, override_get_db, mock_db_session
):
    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = OTHER_USER_ID

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = cd
    mock_db_session.execute = AsyncMock(return_value=result_mock)

    response = client.delete(
        f"/calendar/custom-days/{CUSTOM_DAY_ID}",
        headers=auth_headers,
    )
    assert response.status_code == 403


def test_get_holidays(client, auth_headers, override_get_db, mock_db_session):
    from datetime import UTC, datetime

    cal = MagicMock(spec=HolidayCalendar)
    cal.id = HOLIDAY_CAL_ID
    cal.user_id = TEST_USER_ID
    cal.country_code = "US"
    cal.year = 2026

    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = TEST_USER_ID
    cd.name = "Birthday"
    cd.date = date(2026, 5, 15)
    cd.recurring = False
    cd.created_at = datetime(2026, 1, 1, tzinfo=UTC)

    result_mock1 = MagicMock()
    result_mock1.scalars.return_value.all.return_value = [cal]

    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [cd]

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get("/calendar/holidays?year=2026", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["holidays"]) > 0
    assert any(h["name"] == "New Year's Day" for h in data["holidays"])
    assert len(data["custom_days"]) == 1
    assert data["custom_days"][0]["name"] == "Birthday"
    assert data["custom_days"][0]["date"] == "2026-05-15"
    assert len(data["enabled_countries"]) == 1


def test_get_holidays_recurring_year_adjustment(
    client, auth_headers, override_get_db, mock_db_session
):
    """Recurring custom days stored in a past year are returned
    with the requested year."""
    from datetime import UTC, datetime

    # Recurring day originally stored with year 2024
    cd = MagicMock(spec=CustomDay)
    cd.id = CUSTOM_DAY_ID
    cd.user_id = TEST_USER_ID
    cd.name = "Mom's Birthday"
    cd.date = date(2024, 3, 15)
    cd.recurring = True
    cd.created_at = datetime(2024, 1, 1, tzinfo=UTC)

    result_mock1 = MagicMock()
    result_mock1.scalars.return_value.all.return_value = []  # no enabled countries

    result_mock2 = MagicMock()
    result_mock2.scalars.return_value.all.return_value = [cd]

    mock_db_session.execute = AsyncMock(side_effect=[result_mock1, result_mock2])

    response = client.get("/calendar/holidays?year=2026", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["custom_days"]) == 1
    # Date should be adjusted to the requested year, not the stored year
    assert data["custom_days"][0]["date"] == "2026-03-15"
    assert data["custom_days"][0]["recurring"] is True
