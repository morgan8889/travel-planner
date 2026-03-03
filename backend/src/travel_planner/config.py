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
    token_encryption_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def check_required(self) -> "Settings":
        missing = []
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if not self.database_url:
            missing.append("DATABASE_URL")
        if not self.token_encryption_key:
            missing.append("TOKEN_ENCRYPTION_KEY")
        if missing:
            raise ValueError(f"Required env vars not set: {', '.join(missing)}")
        return self


settings = Settings()
