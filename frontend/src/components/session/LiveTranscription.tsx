/**
 * LiveTranscription — rolling transcript feed.
 *
 * Displays finalized speech-to-text sentences as they arrive from the
 * centralized VoiceInput component. This is a pure display component
 * with no speech recognition logic of its own.
 *
 * Features:
 *   - Animated slide-in for new entries
 *   - Progressive opacity (newer entries more prominent)
 *   - Auto-scroll to latest entry
 *   - Entry count badge
 *
 * Props:
 *   entries — array of transcript entries to display
 */

"use client";

import { useEffect, useRef } from "react";

interface TranscriptEntry {
  id: number;
  text: string;
}

interface Props {
  entries: TranscriptEntry[];
}

const MAX_DISPLAY = 6;

export function LiveTranscription({ entries }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-MAX_DISPLAY);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-300">Transcript</h3>
        <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[11px] text-gray-500">
          {entries.length}
        </span>
      </div>

      <div ref={scrollRef} className="px-4 pb-4 space-y-1.5 max-h-48 overflow-y-auto scroll-smooth">
        {visible.map((entry, idx) => (
          <p
            key={entry.id}
            className="transcript-entry text-xs leading-relaxed text-gray-400"
            style={{ opacity: 0.4 + (idx / visible.length) * 0.6 }}
          >
            {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
}
