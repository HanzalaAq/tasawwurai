"""
Speech-to-text provider abstraction.

Defines the interface for STT providers so Whisper can be
replaced with another provider later.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TranscriptResult:
    """Result from a speech-to-text transcription."""

    text: str
    is_final: bool
    confidence: float = 0.0
    language: str = "en"


class STTProvider(ABC):
    """Abstract base class for speech-to-text providers."""

    @abstractmethod
    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> TranscriptResult:
        """
        Transcribe audio data to text.

        Args:
            audio_data: Raw audio bytes (PCM 16-bit mono).
            sample_rate: Audio sample rate in Hz.

        Returns:
            A TranscriptResult with the transcribed text.
        """
        ...


class STTProviderError(Exception):
    """Raised when an STT provider call fails."""

    pass
