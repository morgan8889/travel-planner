from pydantic import BaseModel


class GeocodeSuggestion(BaseModel):
    place_name: str
    latitude: float
    longitude: float
    place_type: str
    context: str | None
