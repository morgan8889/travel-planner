from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://localhost:5432/travel_planner"
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_role_key: str | None = None
    app_frontend_url: str = "http://localhost:5173"
    anthropic_api_key: str = ""
    mapbox_access_token: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/gmail/callback"
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def check_required(self) -> "Settings":
        if not self.supabase_url:
            raise ValueError("supabase_url is required (set SUPABASE_URL env var)")
        return self


settings = Settings()
