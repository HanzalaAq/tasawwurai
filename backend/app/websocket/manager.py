"""
WebSocket connection manager.

Handles connection lifecycle, tracks active connections per session,
and provides broadcast/send utilities.
"""

from __future__ import annotations

import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by session ID."""

    def __init__(self) -> None:
        # session_id -> list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        """Accept a WebSocket and register it under a session."""
        await websocket.accept()
        self._connections[session_id].append(websocket)
        logger.info("WS connected: session=%s (total=%d)", session_id, len(self._connections[session_id]))

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        """Remove a WebSocket from a session."""
        conns = self._connections[session_id]
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            del self._connections[session_id]
        logger.info("WS disconnected: session=%s (remaining=%d)", session_id, len(self._connections.get(session_id, [])))

    async def send_json(self, session_id: str, websocket: WebSocket, data: dict) -> None:
        """Send a JSON message to a specific connection."""
        try:
            await websocket.send_json(data)
        except Exception:
            logger.warning("Failed to send to WS in session=%s", session_id)
            self.disconnect(session_id, websocket)

    async def broadcast(self, session_id: str, data: dict) -> None:
        """Send a JSON message to all connections in a session."""
        stale: list[WebSocket] = []
        for ws in self._connections.get(session_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(session_id, ws)

    def active_count(self, session_id: str) -> int:
        """Return the number of active connections for a session."""
        return len(self._connections.get(session_id, []))


# Singleton instance used across the application
manager = ConnectionManager()
