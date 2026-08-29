"""
WebSocket message protocol definitions.

All messages exchanged between frontend and backend are typed Pydantic models.
This ensures type safety and validation on both sides.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# --- Enums ---


class SessionAction(str, Enum):
    START = "start"
    PAUSE = "pause"
    RESUME = "resume"
    END = "end"


class VisualizationAction(str, Enum):
    NEW = "new"
    UPDATE = "update"
    NONE = "none"


# --- Client -> Server Messages ---


class PingMessage(BaseModel):
    """Heartbeat ping from client."""

    type: Literal["ping"]
    timestamp: float


class ParameterChangeMessage(BaseModel):
    """User interacted with a visualization and changed parameters."""

    type: Literal["parameter_change"]
    visualization_type: str
    parameters: dict


class SessionControlMessage(BaseModel):
    """Client requests a session state change."""

    type: Literal["session_control"]
    action: SessionAction


class TestMessage(BaseModel):
    """Test message to trigger a mock visualization command from the server."""

    type: Literal["test"]
    subject: str = "physics"
    concept: str = "projectile_motion"


# --- Server -> Client Messages ---


class TranscriptSegmentMessage(BaseModel):
    """A segment of transcribed speech."""

    type: Literal["transcript_segment"]
    segment_id: str
    text: str
    is_final: bool
    timestamp: float


class FormulaItem(BaseModel):
    """A single formula with a name and LaTeX representation."""

    name: str
    latex: str


class TheoryBlock(BaseModel):
    """Theory information displayed alongside the visualization."""

    title: str
    explanation: str
    formulas: list[FormulaItem] = Field(default_factory=list)
    key_points: list[str] = Field(default_factory=list)


class VisualizationPayload(BaseModel):
    """The visualization type and its parameters."""

    type: str
    parameters: dict


class VisualizationCommandMessage(BaseModel):
    """
    The core command sent from server to frontend.

    Tells the Visualization Engine which renderer to use,
    with what parameters, and what theory to display.
    """

    type: Literal["visualization_command"]
    command_id: str
    action: VisualizationAction
    subject: str
    concept: str
    visualization: VisualizationPayload
    theory: TheoryBlock
    timestamp: float


class ErrorMessage(BaseModel):
    """An error occurred on the server."""

    type: Literal["error"]
    code: str
    message: str


class ImageCommandMessage(BaseModel):
    """
    Command to display an AI-generated image.

    Sent when the AI planner determines that an illustrative image
    is more appropriate than (or complementary to) an interactive simulation.
    """

    type: Literal["image_command"]
    prompt: str
    image_url: str
    subject: str
    concept: str
    timestamp: float


class PongMessage(BaseModel):
    """Heartbeat pong response."""

    type: Literal["pong"]
    timestamp: float


# Union type for all client messages (used for parsing)
ClientMessage = PingMessage | ParameterChangeMessage | SessionControlMessage | TestMessage

# Union type for all server messages (used for sending)
ServerMessage = (
    TranscriptSegmentMessage
    | VisualizationCommandMessage
    | ImageCommandMessage
    | ErrorMessage
    | PongMessage
)
