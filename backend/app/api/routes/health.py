"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Return basic health status."""
    return {"status": "ok", "service": "tasawwur-api"}
