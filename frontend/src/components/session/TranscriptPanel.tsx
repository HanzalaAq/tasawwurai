/**
 * TranscriptPanel — scrollable history of teacher speech segments.
 *
 * Shows finalized transcripts with timestamps, interim styling for
 * in-flight segments, and smooth auto-scroll.
 */

"use client";

import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  id: string;
  text: string;
  is_final: boolean;
  timestamp: number;
}

interface Props {
  entries: TranscriptEntry[];
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TranscriptPanel({ entries }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
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
        <header className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
            Transcript
          </span>
        </header>
        <p className="text-xs italic text-steel-400">
          Server transcript segments will appear here&hellip;
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-steel-200/80 bg-white/70 p-3.5">
      <header className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
          Transcript
        </span>
        <span className="font-mono text-[10px] text-steel-400">
          {entries.length} segment{entries.length !== 1 ? "s" : ""}
        </span>
      </header>

      <div ref={scrollRef} className="max-h-56 space-y-2.5 overflow-y-auto scroll-smooth pr-1">
        {entries.map((entry) => (
          <div key={entry.id} className="transcript-entry flex gap-2.5">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] tabular-nums text-steel-400">
              {formatTime(entry.timestamp)}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm leading-relaxed ${
                  entry.is_final
                    ? "text-dusk-600"
                    : "text-steel-500 italic"
                }`}
              >
                {entry.text}
                {!entry.is_final && (
                  <span className="interim-cursor ml-1 inline-block h-3.5 w-[2px] translate-y-0.5 bg-azure-600" />
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
