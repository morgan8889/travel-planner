import httpx
from fastapi import APIRouter, Query

from travel_planner.auth import CurrentUserId
from travel_planner.config import settings
from travel_planner.schemas.geocode import GeocodeSuggestion

router = APIRouter(prefix="/api/geocode", tags=["geocode"])

MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"


@router.get("/search", response_model=list[GeocodeSuggestion])
async def search(
    _user_id: CurrentUserId,
    q: str = Query(..., min_length=1),
    limit: int = Query(default=5, ge=1, le=10),
) -> list[GeocodeSuggestion]:
    """Proxy to Mapbox Geocoding API. Returns empty list when token is not configured."""
    if not settings.mapbox_access_token:
        return []

    url = MAPBOX_GEOCODING_URL.format(query=q)
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params={
                "access_token": settings.mapbox_access_token,
                "limit": limit,
                "types": "place,locality,neighborhood,address,poi",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        data = response.json()

    suggestions: list[GeocodeSuggestion] = []
    for feature in data.get("features", []):
        coords = feature.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue
        place_types = feature.get("place_type", [])
        context_parts = [
            c.get("text", "") for c in feature.get("context", []) if c.get("text")
        ]
        suggestions.append(
            GeocodeSuggestion(
                place_name=feature.get("place_name", ""),
                latitude=coords[1],
                longitude=coords[0],
                place_type=place_types[0] if place_types else "place",
                context=", ".join(context_parts) if context_parts else None,
            )
        )
    return suggestions
