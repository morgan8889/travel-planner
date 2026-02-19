from uuid import UUID

import holidays as holidays_lib
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.db import get_db
from travel_planner.models.calendar import CustomDay, HolidayCalendar
from travel_planner.schemas.calendar import (
    CustomDayCreate,
    CustomDayResponse,
    EnableCountryRequest,
    HolidayCalendarResponse,
    HolidayEntry,
    HolidaysResponse,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Map of supported country codes to holidays classes
SUPPORTED_COUNTRIES = {
    "US": holidays_lib.US,
    "UK": holidays_lib.UK,
    "CA": holidays_lib.CA,
    "AU": holidays_lib.AU,
    "DE": holidays_lib.DE,
    "FR": holidays_lib.FR,
    "JP": holidays_lib.JP,
    "MX": holidays_lib.MX,
    "BR": holidays_lib.BR,
    "IN": holidays_lib.IN,
}


def get_holidays_for_country(country_code: str, year: int) -> list[HolidayEntry]:
    """Generate holiday entries for a country and year."""
    cls = SUPPORTED_COUNTRIES.get(country_code)
    if cls is None:
        return []
    country_holidays = cls(years=year)
    return [
        HolidayEntry(date=d, name=name, country_code=country_code)
        for d, name in sorted(country_holidays.items())
    ]


@router.get("/holidays", response_model=HolidaysResponse)
async def get_holidays(
    year: int,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Get holidays and custom days for a year."""
    # Get enabled country calendars
    result = await db.execute(
        select(HolidayCalendar)
        .where(HolidayCalendar.user_id == user_id)
        .where(HolidayCalendar.year == year)
    )
    enabled = result.scalars().all()

    # Compute holidays from enabled countries
    all_holidays: list[HolidayEntry] = []
    for cal in enabled:
        all_holidays.extend(get_holidays_for_country(cal.country_code, year))
    all_holidays.sort(key=lambda h: h.date)

    # Get custom days (non-recurring for this year + recurring from any year)
    result = await db.execute(select(CustomDay).where(CustomDay.user_id == user_id))
    all_custom = result.scalars().all()
    custom_days = []
    for cd in all_custom:
        if cd.recurring or cd.date.year == year:
            custom_days.append(cd)

    enabled_responses = [HolidayCalendarResponse.model_validate(e) for e in enabled]
    custom_responses = [CustomDayResponse.model_validate(cd) for cd in custom_days]

    return HolidaysResponse(
        holidays=all_holidays,
        custom_days=custom_responses,
        enabled_countries=enabled_responses,
    )


@router.get("/supported-countries")
async def list_supported_countries() -> list[dict[str, str]]:
    """List supported country codes for holiday calendars."""
    return [{"code": code, "name": code} for code in sorted(SUPPORTED_COUNTRIES.keys())]


@router.post(
    "/holidays/country",
    response_model=HolidayCalendarResponse,
    status_code=201,
)
async def enable_country(
    data: EnableCountryRequest,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Enable a country's holiday calendar for a year."""
    if data.country_code not in SUPPORTED_COUNTRIES:
        raise HTTPException(
            status_code=400, detail=f"Unsupported country: {data.country_code}"
        )

    # Check for duplicate
    result = await db.execute(
        select(HolidayCalendar)
        .where(HolidayCalendar.user_id == user_id)
        .where(HolidayCalendar.country_code == data.country_code)
        .where(HolidayCalendar.year == data.year)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="Country already enabled for this year"
        )

    cal = HolidayCalendar(
        user_id=user_id,
        country_code=data.country_code,
        year=data.year,
    )
    db.add(cal)
    await db.commit()
    await db.refresh(cal)

    return HolidayCalendarResponse.model_validate(cal)


@router.delete("/holidays/country/{country_code}", status_code=204)
async def disable_country(
    country_code: str,
    year: int,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Disable a country's holiday calendar for a year."""
    result = await db.execute(
        select(HolidayCalendar)
        .where(HolidayCalendar.user_id == user_id)
        .where(HolidayCalendar.country_code == country_code)
        .where(HolidayCalendar.year == year)
    )
    cal = result.scalar_one_or_none()
    if cal is None:
        raise HTTPException(status_code=404, detail="Country calendar not found")

    await db.delete(cal)
    await db.commit()
    return Response(status_code=204)


@router.post("/custom-days", response_model=CustomDayResponse, status_code=201)
async def create_custom_day(
    data: CustomDayCreate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Add a custom day (birthday, company event, etc.)."""
    custom_day = CustomDay(
        user_id=user_id,
        name=data.name,
        date=data.date,
        recurring=data.recurring,
    )
    db.add(custom_day)
    await db.commit()
    await db.refresh(custom_day)

    return CustomDayResponse.model_validate(custom_day)


@router.delete("/custom-days/{custom_day_id}", status_code=204)
async def delete_custom_day(
    custom_day_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom day."""
    result = await db.execute(select(CustomDay).where(CustomDay.id == custom_day_id))
    cd = result.scalar_one_or_none()
    if cd is None:
        raise HTTPException(status_code=404, detail="Custom day not found")
    if cd.user_id != user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this custom day"
        )

    await db.delete(cd)
    await db.commit()
    return Response(status_code=204)
