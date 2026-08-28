"use client";

/**
 * Session page — the main classroom interface.
 *
 * Integrates:
 * - WebSocket connection to the backend
 * - Visualization Engine (renders the active visualization)
 * - Theory Panel (KaTeX-rendered formulas and explanations)
 * - Demo Mode (simulated teacher input)
 * - Transcript Panel (live speech-to-text display)
 * - Test Controls (direct mock command triggering)
 */

import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useVisualization } from "@/hooks/useVisualization";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { TheoryPanel } from "@/components/session/TheoryPanel";
import { VisualizationEngine } from "@/engine/VisualizationEngine";
import { DemoMode } from "@/components/session/DemoMode";
import { TranscriptPanel, type TranscriptEntry } from "@/components/session/TranscriptPanel";
import type { ClientMessage } from "@/types";
import type { VisualizationCommand } from "@/engine/types";
import Link from "next/link";

// Import renderers to register them (side-effect import)
import "@/renderers";

export default function SessionPage() {
  const sessionId = "demo";
  const { status, lastMessage, send } = useWebSocket(sessionId);
  const command = useVisualization(lastMessage);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const isConnected = status === "connected";

  // Track transcript entries from server messages
  useEffect(() => {
    if (lastMessage && (lastMessage as any).type === "transcript_segment") {
      const msg = lastMessage as any;
      setTranscript((prev) => [
        ...prev,
        {
          id: msg.segment_id,
          text: msg.text,
          is_final: msg.is_final,
          timestamp: msg.timestamp,
        },
      ]);
    }
  }, [lastMessage]);

  const handleSend = useCallback(
    (message: ClientMessage) => {
      send(message);
    },
    [send]
  );

  const handleParameterChange = useCallback(
    (vizType: string, partial: Record<string, unknown>) => {
      send({
        type: "parameter_change",
        visualization_type: vizType,
        parameters: partial,
      });
    },
    [send]
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-bold text-white">
            Tasawwur<span className="text-blue-400">AI</span>
          </Link>
          <span className="text-sm text-gray-600">/</span>
          <span className="text-sm text-gray-400">Session: {sessionId}</span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionBadge status={status} />
          {command && (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              {command.visualization.type}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Visualization canvas */}
        <main className="flex-1 p-4">
          {command ? (
            <div className="h-full rounded-xl border border-gray-700/50 bg-gray-900/60 overflow-hidden">
              <VisualizationEngine
                command={command as VisualizationCommand}
                onParameterChange={handleParameterChange}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-gray-800 bg-gray-900/40">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-800/50">
                  <svg className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-400">No Visualization Active</p>
                <p className="text-sm text-gray-600 max-w-sm">
                  Use the <strong className="text-purple-400">Demo Mode</strong> to simulate a teacher
                  explaining a concept, or use <strong className="text-blue-400">Test Controls</strong> to
                  send a visualization command directly.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right: Sidebar */}
        <aside className="flex w-80 flex-col gap-3 overflow-y-auto border-l border-gray-800 p-4">
          {/* Demo mode */}
          <DemoMode onSend={handleSend} disabled={!isConnected} />

          {/* Test controls */}
          <TestControls onSend={handleSend} disabled={!isConnected} />

          {/* Transcript */}
          <TranscriptPanel entries={transcript} />

          {/* Theory panel */}
          {command && <TheoryPanel theory={(command as VisualizationCommand).theory} />}

          {/* Debug panel */}
          {lastMessage && (
            <details className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-600">
                Debug: Raw Message
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto text-xs text-gray-500">
                {JSON.stringify(lastMessage, null, 2)}
              </pre>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}

// --- Inline test controls (simplified from old TestPanel) ---
function TestControls({ onSend, disabled }: { onSend: (m: ClientMessage) => void; disabled: boolean }) {
  const scenarios = [
    { subject: "physics", concept: "projectile_motion", label: "Projectile" },
    { subject: "physics", concept: "wave_motion", label: "Wave" },
    { subject: "math", concept: "quadratic_function", label: "Quadratic" },
  ];

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Quick Test
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {scenarios.map((s) => (
          <button
            key={`${s.subject}.${s.concept}`}
            onClick={() => onSend({ type: "test", subject: s.subject, concept: s.concept })}
            disabled={disabled}
            className="rounded-lg bg-gray-700/40 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600/50 disabled:opacity-40"
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => onSend({ type: "ping", timestamp: Date.now() / 1000 })}
          disabled={disabled}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-700/30 disabled:opacity-40"
        >
          Ping
        </button>
      </div>
    </div>
  );
}
