"""
Central API router.

Mounts all sub-routers into a single application router.
"""

from fastapi import APIRouter

from app.api.routes import health, sessions, ws

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(sessions.router)
api_router.include_router(ws.router)
