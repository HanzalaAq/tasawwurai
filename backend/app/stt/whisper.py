"""
Whisper STT provider implementation.

Supports both OpenAI's Whisper API and local whisper models.
"""

from __future__ import annotations

import io
import logging
import wave

from app.stt.provider import STTProvider, STTProviderError, TranscriptResult

logger = logging.getLogger(__name__)


class WhisperProvider(STTProvider):
    """OpenAI Whisper API provider."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=self._api_key)
            except ImportError:
                raise STTProviderError("openai package not installed")
        return self._client

    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> TranscriptResult:
        """Transcribe audio using OpenAI Whisper API."""
        client = self._get_client()

        # Convert raw PCM bytes to WAV in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data)
        wav_buffer.seek(0)
        wav_buffer.name = "audio.wav"

        try:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=wav_buffer,
                response_format="json",
            )
            return TranscriptResult(
                text=response.text.strip(),
                is_final=True,
                confidence=1.0,
            )
        except Exception as e:
            raise STTProviderError(f"Whisper API call failed: {e}")


class MockSTTProvider(STTProvider):
    """Mock STT provider for testing without microphone."""

    def __init__(self) -> None:
        self._responses: list[str] = []

    def queue_response(self, text: str) -> None:
        """Queue a text response to return on next transcribe call."""
        self._responses.append(text)

    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> TranscriptResult:
        if self._responses:
            text = self._responses.pop(0)
            return TranscriptResult(text=text, is_final=True, confidence=1.0)
        return TranscriptResult(text="", is_final=True, confidence=0.0)
