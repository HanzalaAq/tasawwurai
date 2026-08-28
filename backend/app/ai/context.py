"""
Lesson context manager.

Maintains a sliding window of lesson state so the AI planner
always has relevant context without exceeding token limits.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class LessonContext:
    """
    Tracks the state of an ongoing teaching session.

    This context is passed to the AI planner on each invocation
    so it can make informed decisions about visualization updates.
    """

    # Current visualization state
    current_viz_type: str | None = None
    current_parameters: dict = field(default_factory=dict)

    # Transcript buffer (last N segments)
    transcript_buffer: list[str] = field(default_factory=list)
    max_transcript_segments: int = 8

    # Session summary (condensed description of what has been taught)
    session_summary: str = ""

    # Topic tracking
    current_subject: str = ""
    current_concept: str = ""
    concepts_covered: list[str] = field(default_factory=list)

    # Timing
    session_start_time: float = field(default_factory=time.time)
    last_update_time: float = field(default_factory=time.time)

    def add_transcript(self, text: str) -> None:
        """Add a transcript segment to the buffer."""
        self.transcript_buffer.append(text)
        # Keep only the last N segments
        if len(self.transcript_buffer) > self.max_transcript_segments:
            self.transcript_buffer = self.transcript_buffer[-self.max_transcript_segments:]
        self.last_update_time = time.time()

    def update_visualization(self, viz_type: str, parameters: dict) -> None:
        """Update the current visualization state."""
        if self.current_viz_type != viz_type:
            # Track concept change
            if self.current_concept:
                self.concepts_covered.append(self.current_concept)
        self.current_viz_type = viz_type
        self.current_parameters = parameters
        self.last_update_time = time.time()

    def set_subject_concept(self, subject: str, concept: str) -> None:
        """Update current subject and concept."""
        self.current_subject = subject
        self.current_concept = concept

    def get_elapsed_seconds(self) -> float:
        """Get session elapsed time in seconds."""
        return time.time() - self.session_start_time

    def get_elapsed_description(self) -> str:
        """Get a human-readable elapsed time string."""
        elapsed = self.get_elapsed_seconds()
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        if minutes > 0:
            return f"{minutes}m {seconds}s"
        return f"{seconds}s"

    def to_prompt_context(self) -> str:
        """
        Build a context string for the AI planner prompt.

        This is a concise summary of the current lesson state.
        """
        parts = []

        # Session timing
        parts.append(f"Session duration: {self.get_elapsed_description()}")

        # Subject/topic
        if self.current_subject:
            parts.append(f"Subject: {self.current_subject}")
        if self.current_concept:
            parts.append(f"Current concept: {self.current_concept}")

        # Concepts covered
        if self.concepts_covered:
            parts.append(f"Concepts already covered: {', '.join(self.concepts_covered)}")

        # Session summary
        if self.session_summary:
            parts.append(f"Summary so far: {self.session_summary}")

        # Current visualization
        if self.current_viz_type:
            parts.append(f"Current visualization: {self.current_viz_type}")
            if self.current_parameters:
                param_str = ", ".join(f"{k}={v}" for k, v in self.current_parameters.items())
                parts.append(f"Current parameters: {param_str}")
        else:
            parts.append("No visualization is currently active.")

        # Recent transcript
        if self.transcript_buffer:
            recent = " ".join(self.transcript_buffer[-5:])
            parts.append(f"Recent transcript: \"{recent}\"")

        return "\n".join(parts)

    def reset(self) -> None:
        """Reset the context for a new session."""
        self.current_viz_type = None
        self.current_parameters = {}
        self.transcript_buffer = []
        self.session_summary = ""
        self.current_subject = ""
        self.current_concept = ""
        self.concepts_covered = []
        self.session_start_time = time.time()
        self.last_update_time = time.time()
