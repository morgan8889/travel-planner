from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://localhost:5432/travel_planner"
    supabase_url: str = ""  # Required for RS256 JWT verification via JWKS
    supabase_key: str = ""
    supabase_jwt_secret: str = ""  # DEPRECATED: No longer used (kept for reference)
    supabase_service_role_key: str = ""
    app_frontend_url: str = "http://localhost:5173"
    anthropic_api_key: str = ""
    mapbox_access_token: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/gmail/callback"
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
