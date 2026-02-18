from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from travel_planner.config import settings
from travel_planner.routers.auth import router as auth_router
from travel_planner.routers.calendar import router as calendar_router
from travel_planner.routers.checklist import router as checklist_router
from travel_planner.routers.geocode import router as geocode_router
from travel_planner.routers.itinerary import router as itinerary_router
from travel_planner.routers.trips import router as trips_router

app = FastAPI(title="Travel Planner API", version="0.1.0")

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
app.include_router(itinerary_router)
app.include_router(trips_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
