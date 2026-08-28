"""
LLM provider abstraction.

Defines the interface that all LLM providers must implement.
This allows swapping between OpenAI, Anthropic, local models, etc.
without changing any calling code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.

    Implementations must support structured JSON output.
    """

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """
        Generate a completion with structured output.

        Args:
            system_prompt: The system instruction.
            user_prompt: The user message / context.
            response_schema: Pydantic model defining the expected response shape.
            temperature: Sampling temperature (lower = more deterministic).

        Returns:
            A dict matching the response_schema.

        Raises:
            LLMProviderError: If the provider call fails.
        """
        ...


class LLMProviderError(Exception):
    """Raised when an LLM provider call fails."""

    pass
