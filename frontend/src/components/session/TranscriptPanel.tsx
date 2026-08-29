/**
 * TranscriptPanel — displays a scrollable history of teacher speech.
 *
 * Shows finalized transcripts with timestamps and smooth auto-scroll.
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
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Transcript
        </h3>
        <p className="text-xs text-gray-600 italic">
          Teacher speech will appear here&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Transcript
        </h3>
        <span className="text-[10px] text-gray-600">{entries.length} segment{entries.length !== 1 ? "s" : ""}</span>
      </div>
      <div ref={scrollRef} className="max-h-56 space-y-2.5 overflow-y-auto scroll-smooth pr-1">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="transcript-entry group flex gap-2"
            style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
          >
            <span className="mt-1 shrink-0 text-[10px] tabular-nums text-gray-600">
              {formatTime(entry.timestamp)}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm leading-relaxed ${
                  entry.is_final
                    ? "text-gray-200"
                    : "text-gray-400 italic"
                }`}
              >
                {entry.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
