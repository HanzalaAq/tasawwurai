"""WebSocket endpoint registration."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from app.websocket.handler import handle_message
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    """
    WebSocket endpoint for a teaching session.

    Lifecycle:
    1. Accept connection and register with ConnectionManager
    2. Listen for messages in a loop
    3. Route each message to the handler (with AI planner from app.state)
    4. Clean up on disconnect
    """
    await manager.connect(session_id, websocket)

    # Get the AI planner from app.state (set during lifespan startup)
    planner = getattr(websocket.app.state, "planner", None)

    try:
        while True:
            raw = await websocket.receive_json()
            await handle_message(raw, websocket, session_id, manager, planner=planner)
    except WebSocketDisconnect:
        logger.info("WS client disconnected: session=%s", session_id)
    except Exception as exc:
        logger.error("WS error in session=%s: %s", session_id, exc)
    finally:
        manager.disconnect(session_id, websocket)
