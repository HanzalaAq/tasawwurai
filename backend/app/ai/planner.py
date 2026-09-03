"""
AI Visualization Planner.

The core module that transforms teacher transcript into structured
visualization commands. This is the brain of the system.

Architecture:
    Transcript → Context Manager → Prompt Builder → LLM Provider → Validator → Command
"""

from __future__ import annotations

import json
import logging
import time
import uuid
import hashlib
from typing import Any
from urllib.parse import quote

from pydantic import ValidationError

from app.ai.context import LessonContext
from app.ai.provider import LLMProvider, LLMProviderError
from app.ai.registry import VisualizationRegistry
from app.ai.schema_utils import clean_schema
from app.ai.schemas import PlannerResponse, VisualizationCommand

logger = logging.getLogger(__name__)


def build_image_url(prompt: str, width: int = 1024, height: int = 768) -> str:
    """
    Build a Pollinations.ai image URL from a text prompt.

    Uses the 'flux' model for higher quality, enables prompt enhancement,
    and generates a deterministic seed from the prompt so repeated requests
    for the same concept return a cached image.
    """
    encoded = quote(prompt, safe="")
    # Deterministic seed from prompt → same concept reuses cached image
    seed = int(hashlib.md5(prompt.encode()).hexdigest()[:8], 16)
    return (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width={width}&height={height}"
        f"&model=flux"
        f"&seed={seed}"
        f"&nologo=true"
        f"&enhance=true"
    )


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

RENDER MODE RULES:
You must set "render_mode" to one of: "simulation", "image", or "both".

STRONG PREFERENCE FOR SIMULATIONS: an interactive simulation is always clearer
and more accurate than an AI-generated image (AI images often garble labels
and scientific detail). Only choose "image" when NO catalog entry fits the
concept at all. When in doubt, pick the closest simulation from the catalog.

- "simulation": Use when the concept matches a registered interactive visualization
  from the catalog below. Fill in the visualization type and parameters as usual.

- "image": Use when NO registered simulation fits the concept. For example:
  "show me a diagram of a cell", "draw a DNA helix", "illustrate photosynthesis",
  "show the structure of an atom". Write a detailed, specific "image_prompt"
  describing the educational illustration.

  IMAGE PROMPT GUIDELINES (critical for quality):
  - Write 2-4 sentences of vivid, concrete description.
  - Specify the VISUAL STYLE: "scientific textbook illustration", "3D rendered
    cross-section", "colorful infographic", "hand-drawn whiteboard diagram", etc.
  - List the KEY ELEMENTS to include (labeled parts, arrows, callouts).
  - Specify the COLOR PALETTE: "soft pastels on white background", "vibrant
    colors on dark blue", "monochrome with red highlights", etc.
  - Add "educational diagram" or "scientific illustration" as a style anchor.
  - Mention what should be LABELED with text (e.g., "labeled nucleus",
    "arrow pointing to mitochondria with label 'Powerhouse'").
  - End with a quality cue: "highly detailed", "clean and minimal",
    "professional educational quality".

- "both": Use sparingly — only when a simulation is available AND a broad contextual
  scene (e.g., a real-world photograph-like scene) genuinely adds value. Do NOT use
  "both" for the same content the simulation already shows; the image cannot render
  precise labels and will look wrong next to the accurate simulation.

AVAILABLE VISUALIZATION TYPES:
{catalog}
"""

USER_PROMPT_TEMPLATE = """CURRENT LESSON STATE:
{context}

NEW TRANSCRIPT:
"{transcript}"

Analyze the new transcript and decide what visualization to show.
Respond with a JSON object matching the PlannerResponse schema:
{response_schema}"""


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
        fallback_provider: LLMProvider | None = None,
    ) -> None:
        self.provider = provider
        self.fallback_provider = fallback_provider
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

    async def _repair_response(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        error: ValidationError,
    ) -> PlannerResponse | None:
        """
        Retry a malformed LLM response once, feeding the validation error
        back so the model can correct its own JSON.
        """
        repair_prompt = (
            f"{user_prompt}\n\n"
            f"Your previous JSON response was invalid:\n{error}\n"
            f"Return the corrected JSON object only."
        )
        try:
            raw = await self.provider.complete(
                system_prompt=system_prompt,
                user_prompt=repair_prompt,
                response_schema=PlannerResponse,
                temperature=temperature,
            )
            return PlannerResponse(**raw)
        except (LLMProviderError, ValidationError) as e:
            logger.warning("Repair pass failed: %s", e)
            return None

    async def plan(
        self,
        session_id: str,
        transcript: str,
        temperature: float = 0.3,
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
        # Inline the response schema: not every endpoint enforces
        # response_format/json_schema, so the prompt is the reliable channel
        schema_text = json.dumps(
            clean_schema(PlannerResponse.model_json_schema()),
            separators=(",", ":"),
        )
        user_prompt = USER_PROMPT_TEMPLATE.format(
            context=context.to_prompt_context(),
            transcript=transcript,
            response_schema=schema_text,
        )

        # Call the LLM
        try:
            raw_response = await self.provider.complete(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=PlannerResponse,
                temperature=temperature,
            )
        except LLMProviderError as e:
            logger.error("LLM provider error in session %s: %s", session_id, e)
            # Try fallback provider (MockProvider) so the user still gets visuals
            if self.fallback_provider:
                logger.info("Falling back to MockProvider for session %s", session_id)
                try:
                    raw_response = await self.fallback_provider.complete(
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        response_schema=PlannerResponse,
                        temperature=temperature,
                    )
                except LLMProviderError as fb_err:
                    logger.error("Fallback provider also failed: %s", fb_err)
                    return None
            else:
                return None

        # Fast path: "action": "none" needs no further validation — LLMs
        # often return a minimal command object for small talk that would
        # otherwise fail the strict Pydantic check and waste a repair call
        raw_cmd = (
            raw_response.get("command")
            if isinstance(raw_response, dict) else None
        )
        if isinstance(raw_cmd, dict) and raw_cmd.get("action") == "none":
            logger.info("AI: no visualization change needed (session=%s)", session_id)
            return None

        # Validate with Pydantic
        try:
            response = PlannerResponse(**raw_response)
        except ValidationError as e:
            logger.warning("Invalid AI response in session %s: %s", session_id, e)
            # One repair pass before giving up
            response = await self._repair_response(
                system_prompt, user_prompt, temperature, e
            )
            if response is None:
                logger.error("Repair pass failed in session %s", session_id)
                return None

        # Check if action is "none"
        if response.command is None or response.command.action == "none":
            logger.info("AI: no visualization change needed (session=%s)", session_id)
            return None

        cmd = response.command
        render_mode = cmd.render_mode

        # --- Keep image prompts clean ---
        # The image_prompt is already a complete, specific description written
        # by the LLM (or the mock catalog). Appending the raw transcript only
        # dilutes it with filler words and confuses the image model, so we
        # leave it untouched. Length is capped to stay within URL limits.
        if cmd.image_prompt and len(cmd.image_prompt) > 800:
            cmd.image_prompt = cmd.image_prompt[:800]

        # --- IMAGE mode: skip simulation validation, return image command ---
        if render_mode == "image":
            if not cmd.image_prompt:
                logger.warning(
                    "AI: render_mode='image' but no image_prompt provided (session=%s)",
                    session_id,
                )
                return None

            context.update_visualization("image", {"prompt": cmd.image_prompt})
            context.set_subject_concept(cmd.subject, cmd.concept)

            return {
                "type": "image_command",
                "prompt": cmd.image_prompt,
                "image_url": build_image_url(cmd.image_prompt),
                "subject": cmd.subject,
                "concept": cmd.concept,
                "timestamp": time.time(),
            }

        # --- SIMULATION or BOTH mode: validate simulation ---
        # Validate the visualization type exists
        if not self.registry.has(cmd.visualization.type):
            # If type is unknown but we have an image_prompt, fall back to image
            if cmd.image_prompt:
                logger.info(
                    "AI: simulation type '%s' unknown, falling back to image (session=%s)",
                    cmd.visualization.type,
                    session_id,
                )
                context.update_visualization("image", {"prompt": cmd.image_prompt})
                context.set_subject_concept(cmd.subject, cmd.concept)
                return {
                    "type": "image_command",
                    "prompt": cmd.image_prompt,
                    "image_url": build_image_url(cmd.image_prompt),
                    "subject": cmd.subject,
                    "concept": cmd.concept,
                    "timestamp": time.time(),
                }
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

        # Build the simulation command
        sim_command = {
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

        # --- BOTH mode: return simulation + image as a list ---
        if render_mode == "both" and cmd.image_prompt:
            image_command = {
                "type": "image_command",
                "prompt": cmd.image_prompt,
                "image_url": build_image_url(cmd.image_prompt),
                "subject": cmd.subject,
                "concept": cmd.concept,
                "timestamp": time.time(),
            }
            return [sim_command, image_command]

        # --- SIMULATION mode: return just the simulation ---
        return sim_command
