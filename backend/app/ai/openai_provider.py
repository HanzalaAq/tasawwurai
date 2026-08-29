"""
OpenAI LLM provider implementation.

Uses OpenAI's structured output (response_format with json_schema).
This is the default provider but can be swapped via the LLMProvider interface.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel

from app.ai.provider import LLMProvider, LLMProviderError
from app.config import get_settings

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider with structured JSON output."""

    def __init__(self) -> None:
        self._client = None  # Lazy initialization

    def _get_client(self):
        """Lazy-load the OpenAI client (avoids import errors when key isn't set)."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI

                settings = get_settings()
                if not settings.openai_api_key:
                    raise LLMProviderError("OPENAI_API_KEY is not configured")
                self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            except ImportError:
                raise LLMProviderError(
                    "openai package not installed. Run: pip install openai"
                )
        return self._client

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """Call OpenAI with structured JSON output."""
        client = self._get_client()
        settings = get_settings()

        # Build JSON schema from the Pydantic model
        json_schema = response_schema.model_json_schema()

        try:
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": response_schema.__name__,
                        "strict": True,
                        "schema": json_schema,
                    },
                },
                temperature=temperature,
                max_tokens=2000,
            )

            content = response.choices[0].message.content
            if not content:
                raise LLMProviderError("Empty response from OpenAI")

            parsed = json.loads(content)
            logger.debug("OpenAI response: %s", parsed)
            return parsed

        except json.JSONDecodeError as e:
            raise LLMProviderError(f"Failed to parse OpenAI JSON response: {e}")
        except Exception as e:
            if isinstance(e, LLMProviderError):
                raise
            raise LLMProviderError(f"OpenAI API call failed: {e}")


class MockProvider(LLMProvider):
    """
    Mock provider for testing and demo mode.

    Returns predefined visualization commands without calling any LLM.
    Uses word-boundary matching with priority ordering (longer keywords first)
    to avoid false positives like 'atom' matching inside 'automatic'.
    """

    def __init__(self) -> None:
        self._responses: dict[str, dict[str, Any]] = {}
        self._sorted_keywords: list[str] = []

    def register_response(self, trigger_keyword: str, response: dict[str, Any]) -> None:
        """Register a canned response for a trigger keyword."""
        kw = trigger_keyword.lower()
        self._responses[kw] = response
        # Re-sort keywords by length descending (longer = more specific = higher priority)
        self._sorted_keywords = sorted(self._responses.keys(), key=len, reverse=True)

    def _match_keyword(self, text: str) -> dict[str, Any] | None:
        """
        Find the best matching keyword in the text.

        Uses word-boundary-aware matching to avoid substring false positives.
        Longer keywords are checked first for specificity.
        """
        import re
        text_lower = text.lower()
        for keyword in self._sorted_keywords:
            # Use word-boundary matching for single-word keywords
            # For multi-word keywords, use simple substring (they're already specific)
            if " " in keyword:
                if keyword in text_lower:
                    return self._responses[keyword]
            else:
                pattern = rf'\b{re.escape(keyword)}\b'
                if re.search(pattern, text_lower):
                    return self._responses[keyword]
        return None

    def _extract_topic(self, text: str) -> str:
        """
        Extract the core topic from a transcript for dynamic image generation.

        Strips common filler words and returns the meaningful content.
        """
        # Remove common filler words/patterns
        import re
        filler = re.compile(
            r'\b(show me|tell me about|explain|what is|what are|let\'?s talk about|'
            r'can you|i want to|let\'?s|please|the|a |an |is |are |was |were |'
            r'of |in |on |at |to |for |with |about|imagine|describe|draw|'
            r'could you|would you|how does|how do)\b',
            re.IGNORECASE,
        )
        cleaned = filler.sub("", text).strip()
        # Remove punctuation and extra whitespace
        cleaned = re.sub(r'[^\w\s]', '', cleaned).strip()
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned if cleaned else text.strip()

    def _build_dynamic_image_response(self, transcript: str) -> dict[str, Any]:
        """
        Generate a dynamic image response from the raw transcript.

        When no keyword matches, this creates a unique image prompt based
        on what the teacher actually said, so every input produces a
        relevant, high-quality image.
        """
        topic = self._extract_topic(transcript)
        title = topic[:50].title() if topic else "Exploration"

        # Build a rich, specific image prompt from the actual words spoken
        image_prompt = (
            f"Professional educational scientific illustration of {topic}. "
            f"Detailed textbook-quality diagram with labeled components and annotations. "
            f"Clean composition on a light background with vibrant accent colors. "
            f"Show the key relationships and processes of {topic} with arrows, "
            f"callout labels, and cross-section details where appropriate. "
            f"Highly detailed, professional educational illustration quality."
        )

        return {
            "command": {
                "action": "new",
                "subject": "general",
                "concept": topic[:100],
                "visualization": {"type": "placeholder", "parameters": {}},
                "theory": {
                    "title": title,
                    "explanation": (
                        f"Exploring {topic}. "
                        f"This visualization was generated based on what you said: "
                        f'"{transcript.strip()}"'
                    ),
                    "formulas": [],
                    "key_points": [
                        f"Topic: {topic}",
                        "Generated from your speech input",
                    ],
                },
                "render_mode": "image",
                "image_prompt": image_prompt,
            },
            "reasoning": f"Mock: dynamic image from transcript '{topic}'",
        }

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """
        Return a mock response based on keyword matching.

        If no keyword matches, generates a dynamic image from the transcript
        so every input produces a visualization.
        """
        # Extract transcript from the user prompt.
        # The planner formats the prompt as:
        #   CURRENT LESSON STATE: ...
        #   NEW TRANSCRIPT:
        #   "<actual words>"
        #   Analyze the new transcript...
        transcript = ""
        if "NEW TRANSCRIPT:" in user_prompt:
            parts = user_prompt.split("NEW TRANSCRIPT:")
            if len(parts) > 1:
                raw = parts[1].strip()
                # Stop at the next instruction line to avoid capturing template text
                for marker in [
                    "Analyze the new transcript",
                    "Respond with a JSON",
                ]:
                    idx = raw.find(marker)
                    if idx != -1:
                        raw = raw[:idx]
                transcript = raw.strip().strip('"').strip()

        # Try keyword matching first
        matched = self._match_keyword(transcript if transcript else user_prompt)
        if matched:
            return matched

        # No keyword matched — generate a dynamic image from the transcript
        if transcript and len(transcript) > 3:
            return self._build_dynamic_image_response(transcript)

        # Fallback: truly empty/meaningless input
        return {
            "command": None,
            "reasoning": "Mock provider: input too short to generate visualization",
        }
