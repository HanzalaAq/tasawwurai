"""
AI Visualization Planner.

The core module that transforms teacher transcript into structured
visualization commands. This is the brain of the system.

Architecture:
    Transcript → Context Manager → Prompt Builder → LLM Provider → Validator → Command
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from pydantic import ValidationError

from app.ai.context import LessonContext
from app.ai.provider import LLMProvider, LLMProviderError
from app.ai.registry import VisualizationRegistry
from app.ai.schemas import PlannerResponse, VisualizationCommand

logger = logging.getLogger(__name__)


# --- System Prompt Template ---

SYSTEM_PROMPT = """You are an educational visualization planner.

Your job: analyze what a teacher is saying and decide which interactive
visualization to display, along with the correct parameters and educational theory.

CRITICAL RULES:
1. NEVER generate code. Only produce structured JSON.
2. You may ONLY select visualization types from the catalog below.
3. Parameters must match the schema for the chosen visualization type.
4. Use "action: new" when switching to a different visualization.
5. Use "action: update" when changing parameters of the CURRENT visualization.
6. Use "action: none" when the transcript doesn't describe a new visual concept
   (e.g., the teacher is asking a question, giving context, or making small talk).
7. Be concise in theory explanations — this is displayed live in a classroom.
8. Always include relevant formulas in LaTeX when the subject involves math.
9. Extract specific numeric values the teacher mentions (velocity, angle, etc.).
10. Do not regenerate the entire visualization if only parameters change.

AVAILABLE VISUALIZATION TYPES:
{catalog}
"""

USER_PROMPT_TEMPLATE = """CURRENT LESSON STATE:
{context}

NEW TRANSCRIPT:
"{transcript}"

Analyze the new transcript and decide what visualization to show.
Respond with a JSON object matching the PlannerResponse schema."""


class AIPlanner:
    """
    The AI visualization planner.

    Takes transcript text + lesson context, calls the LLM,
    validates the response, and returns a structured command.
    """

    def __init__(
        self,
        provider: LLMProvider,
        registry: VisualizationRegistry,
    ) -> None:
        self.provider = provider
        self.registry = registry
        self.contexts: dict[str, LessonContext] = {}  # session_id → context

    def get_context(self, session_id: str) -> LessonContext:
        """Get or create a lesson context for a session."""
        if session_id not in self.contexts:
            self.contexts[session_id] = LessonContext()
        return self.contexts[session_id]

    def reset_context(self, session_id: str) -> None:
        """Reset the lesson context for a session."""
        if session_id in self.contexts:
            self.contexts[session_id].reset()

    async def plan(
        self,
        session_id: str,
        transcript: str,
    ) -> dict[str, Any] | None:
        """
        Process a transcript segment and produce a visualization command.

        Returns:
            A validated visualization command dict (ready to send via WebSocket),
            or None if no visualization change is needed.
        """
        context = self.get_context(session_id)

        # Add transcript to context buffer
        context.add_transcript(transcript)

        # Build prompts
        catalog = self.registry.get_catalog_for_prompt()
        system_prompt = SYSTEM_PROMPT.format(catalog=catalog)
        user_prompt = USER_PROMPT_TEMPLATE.format(
            context=context.to_prompt_context(),
            transcript=transcript,
        )

        # Call the LLM
        try:
            raw_response = await self.provider.complete(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=PlannerResponse,
                temperature=0.3,
            )
        except LLMProviderError as e:
            logger.error("LLM provider error in session %s: %s", session_id, e)
            return None

        # Validate with Pydantic
        try:
            response = PlannerResponse(**raw_response)
        except ValidationError as e:
            logger.error("Invalid AI response in session %s: %s", session_id, e)
            return None

        # Check if action is "none"
        if response.command is None or response.command.action == "none":
            logger.info("AI: no visualization change needed (session=%s)", session_id)
            return None

        cmd = response.command

        # Validate the visualization type exists
        if not self.registry.has(cmd.visualization.type):
            logger.warning(
                "AI returned unknown viz type '%s' (session=%s)",
                cmd.visualization.type,
                session_id,
            )
            return None

        # Validate parameters against the manifest
        validated_params = self.registry.validate_command(
            cmd.visualization.type,
            cmd.visualization.parameters,
        )
        if validated_params is None:
            logger.warning(
                "AI returned invalid parameters for '%s' (session=%s)",
                cmd.visualization.type,
                session_id,
            )
            return None

        # Update context
        context.update_visualization(cmd.visualization.type, validated_params)
        context.set_subject_concept(cmd.subject, cmd.concept)

        # Build the final WebSocket message
        return {
            "type": "visualization_command",
            "command_id": str(uuid.uuid4()),
            "action": cmd.action,
            "subject": cmd.subject,
            "concept": cmd.concept,
            "visualization": {
                "type": cmd.visualization.type,
                "parameters": validated_params,
            },
            "theory": {
                "title": cmd.theory.title,
                "explanation": cmd.theory.explanation,
                "formulas": [
                    {"name": f.name, "latex": f.latex}
                    for f in cmd.theory.formulas
                ],
                "key_points": cmd.theory.key_points,
            },
            "timestamp": time.time(),
        }
