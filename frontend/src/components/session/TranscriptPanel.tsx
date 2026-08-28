/**
 * TranscriptPanel — displays live transcript of teacher speech.
 *
 * Shows both the streaming transcript and a scrollable history.
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

export function TranscriptPanel({ entries }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Transcript
        </h3>
        <p className="text-sm text-gray-600 italic">
          Teacher speech will appear here...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Transcript
      </h3>
      <div ref={scrollRef} className="max-h-48 space-y-2 overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="text-sm">
            <span className={entry.is_final ? "text-gray-200" : "text-gray-400 italic"}>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
