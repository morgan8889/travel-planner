from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from travel_planner.auth import CurrentUserId
from travel_planner.db import get_db
from travel_planner.models.calendar import AnnualPlan, CalendarBlock
from travel_planner.models.trip import Trip, TripMember
from travel_planner.schemas.calendar import (
    AnnualPlanCreate,
    AnnualPlanResponse,
    CalendarBlockCreate,
    CalendarBlockResponse,
    CalendarBlockUpdate,
    CalendarYearResponse,
    TripSummaryForCalendar,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.post("/plans", response_model=AnnualPlanResponse, status_code=201)
async def create_annual_plan(
    plan_data: AnnualPlanCreate,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Create an annual plan for a year. One plan per user per year."""
    result = await db.execute(
        select(AnnualPlan)
        .where(AnnualPlan.user_id == user_id)
        .where(AnnualPlan.year == plan_data.year)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Annual plan already exists for this year")

    plan = AnnualPlan(
        user_id=user_id,
        year=plan_data.year,
        notes=plan_data.notes,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    return AnnualPlanResponse.model_validate(plan)


@router.get("/plans/{year}", response_model=CalendarYearResponse)
async def get_annual_plan(
    year: int,
    db: AsyncSession = Depends(get_db),
    user_id: CurrentUserId = None,
):
    """Get annual plan with blocks and trips for a given year."""
    result = await db.execute(
        select(AnnualPlan)
        .where(AnnualPlan.user_id == user_id)
        .where(AnnualPlan.year == year)
    )
    plan = result.scalar_one_or_none()

    blocks = []
    if plan:
        blocks_result = await db.execute(
            select(CalendarBlock)
            .where(CalendarBlock.annual_plan_id == plan.id)
            .order_by(CalendarBlock.start_date)
        )
        blocks = blocks_result.scalars().all()

    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    trips_result = await db.execute(
        select(Trip)
        .join(TripMember)
        .where(TripMember.user_id == user_id)
        .where(Trip.start_date <= year_end)
        .where(Trip.end_date >= year_start)
        .order_by(Trip.start_date)
    )
    trips = trips_result.scalars().all()

    return CalendarYearResponse(
        plan=AnnualPlanResponse.model_validate(plan) if plan else None,
        blocks=[CalendarBlockResponse.model_validate(b) for b in blocks],
        trips=[TripSummaryForCalendar.model_validate(t) for t in trips],
    )
