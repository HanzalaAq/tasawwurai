"""
AI Visualization Planner schemas.

Pydantic models that define the structure of visualization commands
produced by the AI. These are validated before being sent to the frontend.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FormulaItem(BaseModel):
    """A named mathematical formula in LaTeX."""

    name: str = Field(..., min_length=1, max_length=100)
    latex: str = Field(..., min_length=1, max_length=500)


class KeyPoint(BaseModel):
    """A single educational key point or observation."""

    text: str = Field(..., min_length=1, max_length=300)


class TheoryBlock(BaseModel):
    """Educational theory content to display alongside the visualization."""

    title: str = Field(..., min_length=1, max_length=200)
    explanation: str = Field(..., min_length=1, max_length=1000)
    formulas: list[FormulaItem] = Field(default_factory=list, max_length=20)
    key_points: list[str] = Field(default_factory=list, max_length=15)
    definitions: list[dict[str, str]] = Field(
        default_factory=list,
        max_length=10,
        description="List of {term, definition} pairs",
    )


class VisualizationPayload(BaseModel):
    """Which visualization to render and with what parameters."""

    type: str = Field(..., min_length=1, description="Renderer type, e.g. physics.projectile")
    parameters: dict = Field(default_factory=dict)


class VisualizationCommand(BaseModel):
    """
    The validated output from the AI planner.

    This is the single source of truth for what gets sent to the frontend.
    """

    action: Literal["new", "update", "none"] = Field(
        ...,
        description=(
            "'new' = switch to a different visualization type, "
            "'update' = modify parameters of current visualization, "
            "'none' = no visualization change needed"
        ),
    )
    subject: str = Field(..., min_length=1, max_length=50)
    concept: str = Field(..., min_length=1, max_length=100)
    visualization: VisualizationPayload
    theory: TheoryBlock
    render_mode: Literal["simulation", "image", "both"] = Field(
        default="simulation",
        description=(
            "'simulation' = use a registered interactive visualization, "
            "'image' = generate an AI image using the image_prompt, "
            "'both' = show simulation and image simultaneously"
        ),
    )
    image_prompt: str = Field(
        default="",
        description=(
            "Detailed prompt for AI image generation. "
            "Required when render_mode is 'image' or 'both'. "
            "Describe the educational illustration clearly and specifically."
        ),
    )

    @field_validator("action")
    @classmethod
    def validate_action_with_visualization(cls, v: str, info) -> str:
        """Ensure 'none' actions still carry a valid visualization."""
        # 'none' is valid — means don't change anything
        return v


class PlannerResponse(BaseModel):
    """Top-level response from the AI planner, wraps the command."""

    command: VisualizationCommand | None = Field(
        default=None,
        description="Null when the AI determines no action is needed",
    )
    reasoning: str = Field(
        default="",
        description="Brief explanation of the AI's decision (for debugging)",
    )
