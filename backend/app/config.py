"""Application configuration using Pydantic Settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "TasawwurAI"
    app_version: str = "0.1.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Database (future use)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/tasawwur"

    # AI (future use)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    model_config = {"env_prefix": "TASAWWUR_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
