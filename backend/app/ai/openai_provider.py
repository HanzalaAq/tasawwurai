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
    """

    def __init__(self) -> None:
        self._responses: dict[str, dict[str, Any]] = {}

    def register_response(self, trigger_keyword: str, response: dict[str, Any]) -> None:
        """Register a canned response for a trigger keyword."""
        self._responses[trigger_keyword.lower()] = response

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """Return a mock response based on keyword matching."""
        user_lower = user_prompt.lower()
        for keyword, response in self._responses.items():
            if keyword in user_lower:
                return response

        # Default: return a minimal valid response
        return {
            "command": None,
            "reasoning": "Mock provider: no matching keyword found",
        }
