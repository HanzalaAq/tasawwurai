"""
Cloudflare Workers AI LLM provider.

Workers AI exposes an OpenAI-compatible chat-completions endpoint, so we
drive it with the standard OpenAI SDK — pointed at the account endpoint
with a Cloudflare API token instead of an OpenAI key.

Endpoint:
    https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from pydantic import BaseModel

from app.ai.provider import LLMProvider, LLMProviderError
from app.ai.schema_utils import clean_schema
from app.config import get_settings

logger = logging.getLogger(__name__)


class CloudflareProvider(LLMProvider):
    """Cloudflare Workers AI provider via its OpenAI-compatible endpoint."""

    _REQUEST_TIMEOUT = 60.0
    # Transient statuses worth retrying (529 = Workers AI overloaded)
    _RETRY_STATUS = (429, 500, 502, 503, 529)
    _MAX_RETRIES = 2
    _RETRY_DELAYS = (2.0, 4.0)

    def __init__(self) -> None:
        self._client = None

    def _get_client(self):
        """Lazy-load the OpenAI-compatible client bound to Workers AI."""
        if self._client is None:
            settings = get_settings()
            if not settings.cloudflare_account_id or not settings.cloudflare_api_token:
                raise LLMProviderError(
                    "Cloudflare Workers AI is not configured "
                    "(TASAWWUR_CLOUDFLARE_ACCOUNT_ID / TASAWWUR_CLOUDFLARE_API_TOKEN)"
                )
            try:
                from openai import AsyncOpenAI
            except ImportError:
                raise LLMProviderError(
                    "openai package not installed. Run: pip install openai"
                )
            base_url = (
                "https://api.cloudflare.com/client/v4/accounts/"
                f"{settings.cloudflare_account_id}/ai/v1"
            )
            self._client = AsyncOpenAI(
                api_key=settings.cloudflare_api_token,
                base_url=base_url,
                timeout=self._REQUEST_TIMEOUT,
            )
        return self._client

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """Call Workers AI chat completions with structured JSON output."""
        client = self._get_client()
        settings = get_settings()
        schema = clean_schema(response_schema.model_json_schema())

        # json_object mode with the schema spelled out in the system prompt.
        # Workers AI's json_schema response_format produces glitchy output
        # with this model family (missing required fields, polluted string
        # values), while json_object + an inline schema validates cleanly.
        messages = [
            {
                "role": "system",
                "content": (
                    f"{system_prompt}\n\n"
                    f"Respond with a single JSON object that validates against "
                    f"this JSON schema:\n{json.dumps(schema)}"
                ),
            },
            {"role": "user", "content": user_prompt},
        ]

        for attempt in range(self._MAX_RETRIES + 1):
            try:
                response = await client.chat.completions.create(
                    model=settings.cloudflare_model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=temperature,
                    max_tokens=2000,
                )

                content = response.choices[0].message.content
                if not content:
                    raise LLMProviderError("Empty response from Cloudflare Workers AI")

                parsed = json.loads(content)
                logger.debug("Cloudflare Workers AI response: %s", parsed)
                return parsed

            except Exception as e:
                status = getattr(e, "status_code", None)
                if status in self._RETRY_STATUS and attempt < self._MAX_RETRIES:
                    delay = self._RETRY_DELAYS[attempt]
                    logger.warning(
                        "Workers AI transient error (HTTP %s) — retrying in %.0fs",
                        status, delay,
                    )
                    await asyncio.sleep(delay)
                    continue

                if isinstance(e, LLMProviderError):
                    raise
                if isinstance(e, json.JSONDecodeError):
                    raise LLMProviderError(
                        f"Failed to parse Workers AI JSON response: {e}"
                    )
                raise LLMProviderError(f"Cloudflare Workers AI request failed: {e}")

        raise LLMProviderError(
            "Cloudflare Workers AI request failed after retries"
        )
