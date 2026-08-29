"""
WebSocket message handler.

Routes incoming client messages to the appropriate logic
and produces server responses. Supports:
- ping/pong heartbeats
- test messages (mock visualization commands)
- transcript messages (from speech-to-text pipeline)
- demo_text messages (from demo mode — processed by AI planner)
- parameter_change messages (user interacts with visualization)
- session_control messages (start/pause/resume/end)
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import WebSocket

from app.websocket.manager import ConnectionManager
from app.websocket.protocol import (
    ErrorMessage,
    ParameterChangeMessage,
    PingMessage,
    PongMessage,
    SessionControlMessage,
    TestMessage,
    TheoryBlock,
    VisualizationAction,
    VisualizationCommandMessage,
    VisualizationPayload,
    FormulaItem,
)

logger = logging.getLogger(__name__)


# --- Mock visualization data for testing (backward compat) ---

MOCK_VISUALIZATIONS = {
    "physics.projectile_motion": {
        "visualization": VisualizationPayload(
            type="physics.projectile",
            parameters={"velocity": 20, "angle": 45, "gravity": 9.81},
        ),
        "theory": TheoryBlock(
            title="Projectile Motion",
            explanation=(
                "A projectile is any object thrown into space by some exerting force. "
                "Once launched, the only force acting on it is gravity (ignoring air resistance). "
                "The trajectory forms a parabola."
            ),
            formulas=[
                FormulaItem(
                    name="Range", latex="R = (v^2 \\sin 2\\theta) / g"),
                FormulaItem(name="Max Height",
                            latex="H = (v^2 \\sin^2 \\theta) / (2g)"),
                FormulaItem(name="Time of Flight",
                            latex="T = (2v \\sin \\theta) / g"),
            ],
            key_points=[
                "Horizontal velocity remains constant",
                "Vertical velocity changes due to gravity",
                "Maximum range at 45 degrees",
            ],
        ),
    },
    "physics.wave_motion": {
        "visualization": VisualizationPayload(
            type="physics.wave",
            parameters={"frequency": 2.0, "amplitude": 1.0, "wavelength": 3.0},
        ),
        "theory": TheoryBlock(
            title="Wave Motion",
            explanation=(
                "A wave is a disturbance that transfers energy through space or matter "
                "without permanent displacement of the particles."
            ),
            formulas=[
                FormulaItem(name="Wave Equation", latex="v = f \\lambda"),
                FormulaItem(name="Period", latex="T = 1/f"),
            ],
            key_points=[
                "Transverse waves: displacement perpendicular to propagation",
                "Longitudinal waves: displacement parallel to propagation",
            ],
        ),
    },
    "math.quadratic_function": {
        "visualization": VisualizationPayload(
            type="math.function_graph",
            parameters={"expression": "x^2", "xMin": -
                        10, "xMax": 10, "color": "#3b82f6"},
        ),
        "theory": TheoryBlock(
            title="Quadratic Functions",
            explanation=(
                "A quadratic function has the form f(x) = ax^2 + bx + c. "
                "Its graph is a parabola that opens upward when a > 0 and downward when a < 0."
            ),
            formulas=[
                FormulaItem(name="Standard Form",
                            latex="f(x) = ax^2 + bx + c"),
                FormulaItem(name="Vertex", latex="x = -b / (2a)"),
                FormulaItem(name="Discriminant", latex="\\Delta = b^2 - 4ac"),
            ],
            key_points=[
                "The vertex is the minimum or maximum point",
                "The discriminant determines the number of real roots",
            ],
        ),
    },
}


def _get_mock_command(subject: str, concept: str) -> VisualizationCommandMessage | None:
    """Look up a mock visualization command by subject.concept."""
    key = f"{subject}.{concept}"
    mock = MOCK_VISUALIZATIONS.get(key)
    if not mock:
        return None

    return VisualizationCommandMessage(
        type="visualization_command",
        command_id=str(uuid.uuid4()),
        action=VisualizationAction.NEW,
        subject=subject,
        concept=concept,
        visualization=mock["visualization"],
        theory=mock["theory"],
        timestamp=time.time(),
    )


async def handle_message(
    raw: dict,
    websocket: WebSocket,
    session_id: str,
    conn_manager: ConnectionManager,
    planner=None,
) -> None:
    """
    Parse and route an incoming client message.

    Each message must have a `type` field that determines how it is handled.
    The optional `planner` parameter is the AIPlanner instance from app.state.
    """
    msg_type = raw.get("type")

    if msg_type == "ping":
        msg = PingMessage(**raw)
        await conn_manager.send_json(
            session_id,
            websocket,
            PongMessage(type="pong", timestamp=msg.timestamp).model_dump(),
        )

    elif msg_type == "test":
        msg = TestMessage(**raw)
        command = _get_mock_command(msg.subject, msg.concept)
        if command:
            await conn_manager.send_json(session_id, websocket, command.model_dump())
        else:
            await conn_manager.send_json(
                session_id,
                websocket,
                ErrorMessage(
                    type="error",
                    code="UNKNOWN_VISUALIZATION",
                    message=f"No mock visualization for '{msg.subject}.{msg.concept}'",
                ).model_dump(),
            )

    elif msg_type in ("transcript", "demo_text"):
        # Both transcript (from STT) and demo_text (from demo mode) go through the AI planner
        text = raw.get("text", "").strip()
        if not text:
            return

        # Send transcript back to client for display
        await conn_manager.send_json(session_id, websocket, {
            "type": "transcript_segment",
            "segment_id": str(uuid.uuid4()),
            "text": text,
            "is_final": True,
            "timestamp": time.time(),
        })

        # Process through AI planner if available
        if planner:
            logger.info("Processing transcript: session=%s text='%s'", session_id, text[:80])
            result = await planner.plan(session_id, text)
            if result:
                # planner.plan() returns a single dict or a list of dicts (for "both" mode)
                if isinstance(result, list):
                    for command in result:
                        cmd_type = command.get("type", "unknown")
                        logger.info("Sending %s to frontend (session=%s)", cmd_type, session_id)
                        await conn_manager.send_json(session_id, websocket, command)
                else:
                    cmd_type = result.get("type", "unknown")
                    logger.info("Sending %s to frontend (session=%s)", cmd_type, session_id)
                    await conn_manager.send_json(session_id, websocket, result)
            else:
                logger.info("Planner returned None — no visualization change (session=%s)", session_id)
        else:
            logger.warning(
                "AI planner not available — cannot process transcript")

    elif msg_type == "parameter_change":
        msg = ParameterChangeMessage(**raw)
        logger.info(
            "Parameter change: session=%s type=%s params=%s",
            session_id, msg.visualization_type, msg.parameters,
        )

    elif msg_type == "session_control":
        msg = SessionControlMessage(**raw)
        logger.info("Session control: session=%s action=%s",
                    session_id, msg.action)
        # Reset AI context when starting a new session
        if msg.action.value == "start" and planner:
            planner.reset_context(session_id)

    else:
        await conn_manager.send_json(
            session_id,
            websocket,
            ErrorMessage(
                type="error",
                code="UNKNOWN_MESSAGE_TYPE",
                message=f"Unknown message type: '{msg_type}'",
            ).model_dump(),
        )
