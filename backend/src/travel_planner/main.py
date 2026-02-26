import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from travel_planner.config import settings
from travel_planner.db import async_session
from travel_planner.models.gmail import ScanRun, ScanRunStatus
from travel_planner.routers.auth import router as auth_router
from travel_planner.routers.calendar import router as calendar_router
from travel_planner.routers.checklist import router as checklist_router
from travel_planner.routers.geocode import router as geocode_router
from travel_planner.routers.gmail import router as gmail_router
from travel_planner.routers.itinerary import router as itinerary_router
from travel_planner.routers.trips import router as trips_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup/shutdown lifecycle for the FastAPI app."""
    try:
        async with async_session() as db:
            await db.execute(
                update(ScanRun)
                .where(ScanRun.status == ScanRunStatus.running)
                .values(status=ScanRunStatus.failed)
            )
            await db.commit()
    except Exception:
        logger.exception(
            "Failed to clean up orphaned scans on startup — "
            "some scans may be stuck in 'running' state"
        )
    yield


app = FastAPI(title="Travel Planner API", version="0.1.0", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(calendar_router)
app.include_router(checklist_router)
app.include_router(geocode_router)
app.include_router(gmail_router)
app.include_router(itinerary_router)
app.include_router(trips_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
