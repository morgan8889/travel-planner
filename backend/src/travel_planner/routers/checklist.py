from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from travel_planner.auth import CurrentUserId
from travel_planner.db import get_db
from travel_planner.deps import verify_trip_member
from travel_planner.models.checklist import Checklist, ChecklistItem, ChecklistItemUser
from travel_planner.schemas.checklist import (
    ChecklistCreate,
    ChecklistItemCreate,
    ChecklistItemResponse,
    ChecklistResponse,
)

router = APIRouter(prefix="/checklist", tags=["checklist"])


@router.post(
    "/trips/{trip_id}/checklists", response_model=ChecklistResponse, status_code=201
)
async def create_checklist(
    trip_id: UUID,
    checklist_data: ChecklistCreate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Create a new checklist for a trip"""
    await verify_trip_member(trip_id, db, user_id)

    checklist = Checklist(trip_id=trip_id, title=checklist_data.title)
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)

    return ChecklistResponse.model_validate(
        {
            "id": checklist.id,
            "trip_id": checklist.trip_id,
            "title": checklist.title,
            "items": [],
        }
    )


@router.get("/trips/{trip_id}/checklists", response_model=list[ChecklistResponse])
async def list_checklists(
    trip_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """List all checklists for a trip with items and user check status"""
    await verify_trip_member(trip_id, db, user_id)

    # Fetch checklists with items and user checks eagerly loaded
    result = await db.execute(
        select(Checklist)
        .options(selectinload(Checklist.items).selectinload(ChecklistItem.user_checks))
        .where(Checklist.trip_id == trip_id)
    )
    checklists = result.scalars().all()

    # Transform to response model with checked status
    response_data = []
    for checklist in checklists:
        items = []
        for item in checklist.items:
            # Find user's check status
            user_check = next(
                (uc for uc in item.user_checks if uc.user_id == user_id), None
            )
            checked = user_check.checked if user_check else False

            items.append(
                ChecklistItemResponse.model_validate(
                    {
                        "id": item.id,
                        "checklist_id": item.checklist_id,
                        "text": item.text,
                        "sort_order": item.sort_order,
                        "checked": checked,
                    }
                )
            )

        response_data.append(
            ChecklistResponse.model_validate(
                {
                    "id": checklist.id,
                    "trip_id": checklist.trip_id,
                    "title": checklist.title,
                    "items": items,
                }
            )
        )

    return response_data


@router.post(
    "/checklists/{checklist_id}/items",
    response_model=ChecklistItemResponse,
    status_code=201,
)
async def add_checklist_item(
    checklist_id: UUID,
    item_data: ChecklistItemCreate,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Add an item to a checklist with auto-incremented sort_order"""
    # Get the checklist
    result = await db.execute(select(Checklist).where(Checklist.id == checklist_id))
    checklist = result.scalar_one_or_none()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    # Verify user is a member of the trip
    await verify_trip_member(checklist.trip_id, db, user_id)

    # Get max sort_order for this checklist
    result = await db.execute(
        select(func.max(ChecklistItem.sort_order)).where(
            ChecklistItem.checklist_id == checklist_id
        )
    )
    max_sort_order = result.scalar()
    next_sort_order = (max_sort_order + 1) if max_sort_order is not None else 0

    item = ChecklistItem(
        checklist_id=checklist_id,
        text=item_data.text,
        sort_order=next_sort_order,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return ChecklistItemResponse.model_validate(
        {
            "id": item.id,
            "checklist_id": item.checklist_id,
            "text": item.text,
            "sort_order": item.sort_order,
            "checked": False,  # New items are unchecked
        }
    )


@router.post("/items/{item_id}/toggle", response_model=ChecklistItemResponse)
async def toggle_item_check(
    item_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Toggle the checked status of an item for the current user"""
    # Get the item with its checklist
    result = await db.execute(
        select(ChecklistItem)
        .options(selectinload(ChecklistItem.checklist))
        .where(ChecklistItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    # Verify user is a member of the trip
    await verify_trip_member(item.checklist.trip_id, db, user_id)

    # Get or create ChecklistItemUser record
    result = await db.execute(
        select(ChecklistItemUser)
        .where(ChecklistItemUser.item_id == item_id)
        .where(ChecklistItemUser.user_id == user_id)
    )
    user_check = result.scalar_one_or_none()

    if user_check:
        # Toggle existing record
        user_check.checked = not user_check.checked
    else:
        # Create new record (checked=True)
        user_check = ChecklistItemUser(item_id=item_id, user_id=user_id, checked=True)
        db.add(user_check)

    await db.commit()
    await db.refresh(user_check)

    return ChecklistItemResponse.model_validate(
        {
            "id": item.id,
            "checklist_id": item.checklist_id,
            "text": item.text,
            "sort_order": item.sort_order,
            "checked": user_check.checked,
        }
    )


@router.delete("/items/{item_id}", status_code=204)
async def delete_checklist_item(
    item_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single checklist item."""
    result = await db.execute(
        select(ChecklistItem)
        .options(selectinload(ChecklistItem.checklist))
        .where(ChecklistItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    await verify_trip_member(item.checklist.trip_id, db, user_id)
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)


@router.delete("/trips/{trip_id}/checklists/{checklist_id}", status_code=204)
async def delete_checklist(
    trip_id: UUID,
    checklist_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete a checklist and all its items."""
    await verify_trip_member(trip_id, db, user_id)

    result = await db.execute(select(Checklist).where(Checklist.id == checklist_id))
    checklist = result.scalar_one_or_none()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    await db.delete(checklist)
    await db.commit()
    return Response(status_code=204)
