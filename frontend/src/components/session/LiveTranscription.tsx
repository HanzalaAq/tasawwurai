/**
 * LiveTranscription — rolling transcript feed from voice input.
 *
 * Displays finalized speech-to-text sentences as they arrive from the
 * centralized VoiceInput component. Pure display — no speech logic.
 *
 * Features:
 *   - Animated slide-in for new entries
 *   - Progressive opacity (newer entries more prominent)
 *   - Auto-scroll to latest entry
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
    return (
      <section className="rounded-xl border border-steel-200/80 bg-white/70 p-3.5">
        <header className="mb-2.5 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
            Voice feed
          </span>
        </header>
        <p className="text-xs italic text-steel-400">
          Spoken sentences will stream here…
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-steel-200/80 bg-white/70 p-3.5">
      <header className="mb-2.5 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-azure-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-azure-500" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
          Voice feed
        </span>
        <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 font-mono text-[10px] text-steel-500 ring-1 ring-steel-300">
          {entries.length}
        </span>
      </header>

      <div
        ref={scrollRef}
        className="max-h-48 space-y-1.5 overflow-y-auto scroll-smooth pr-1"
      >
        {visible.map((entry, idx) => (
          <p
            key={entry.id}
            className="transcript-entry border-l-2 border-azure-500/40 pl-2.5 text-xs leading-relaxed text-steel-600"
            style={{ opacity: 0.45 + (idx / visible.length) * 0.55 }}
          >
            {entry.text}
          </p>
        ))}
      </div>
    </section>
  );
}
