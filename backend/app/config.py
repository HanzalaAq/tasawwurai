"""Application configuration using Pydantic Settings."""

from functools import lru_cache

from pydantic import field_validator
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

    # AI
    openai_api_key: str = ""  # Set via .env: TASAWWUR_OPENAI_API_KEY=sk-...
    openai_model: str = "gpt-4o-mini"

    model_config = {"env_prefix": "TASAWWUR_", "env_file": ".env"}

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def _clear_placeholder_keys(cls, v: str) -> str:
        """Treat placeholder/demo values as empty so MockProvider is used."""
        if not v or not isinstance(v, str):
            return ""
        placeholders = ("your-key", "your-actual", "sk-your", "sk-xxx", "CHANGE_ME")
        if any(p in v.lower() for p in placeholders):
            return ""
        return v


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
