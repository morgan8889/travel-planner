from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from travel_planner.config import settings
from travel_planner.routers.auth import router as auth_router
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
app.include_router(trips_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
