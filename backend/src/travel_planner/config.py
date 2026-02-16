from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://localhost:5432/travel_planner"
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_jwt_secret: str = ""
    anthropic_api_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
