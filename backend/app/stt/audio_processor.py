"""
Audio processing utilities.

Handles audio chunk buffering and determines when enough audio
has accumulated to send to the STT provider.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AudioBuffer:
    """
    Buffers incoming audio chunks and determines when to flush
    to the STT provider.
    """

    chunks: list[bytes] = field(default_factory=list)
    total_bytes: int = 0
    sample_rate: int = 16000
    target_duration_seconds: float = 3.0  # Flush after this much audio
    last_flush_time: float = field(default_factory=time.time)

    @property
    def target_bytes(self) -> int:
        """Target buffer size in bytes (16-bit mono PCM)."""
        # 2 bytes per sample, sample_rate samples per second
        return int(self.target_duration_seconds * self.sample_rate * 2)

    def add_chunk(self, audio_data: bytes) -> bool:
        """
        Add an audio chunk to the buffer.

        Returns True if the buffer should be flushed (enough audio accumulated).
        """
        self.chunks.append(audio_data)
        self.total_bytes += len(audio_data)
        return self.total_bytes >= self.target_bytes

    def flush(self) -> bytes:
        """Flush the buffer and return all accumulated audio data."""
        if not self.chunks:
            return b""
        combined = b"".join(self.chunks)
        self.chunks = []
        self.total_bytes = 0
        self.last_flush_time = time.time()
        return combined

    def time_since_last_flush(self) -> float:
        """Seconds since the last flush."""
        return time.time() - self.last_flush_time
