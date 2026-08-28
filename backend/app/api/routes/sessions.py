"""Session CRUD endpoints (placeholder for future database integration)."""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("")
async def create_session() -> dict:
    """Create a new teaching session and return its ID."""
    session_id = str(uuid.uuid4())
    return {
        "id": session_id,
        "status": "active",
        "created_at": time.time(),
    }


@router.get("")
async def list_sessions() -> list[dict]:
    """List all sessions (placeholder — returns empty list)."""
    return []


@router.get("/{session_id}")
async def get_session(session_id: str) -> dict:
    """Get session details (placeholder)."""
    return {"id": session_id, "status": "active"}
