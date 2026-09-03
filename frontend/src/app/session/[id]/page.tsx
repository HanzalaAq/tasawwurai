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

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useVisualization } from "@/hooks/useVisualization";
import { useImageDisplay } from "@/hooks/useImageDisplay";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { TheoryPanel } from "@/components/session/TheoryPanel";
import { VisualizationEngine } from "@/engine/VisualizationEngine";
import { DemoMode } from "@/components/session/DemoMode";
import { VoiceInput } from "@/components/session/VoiceInput";
import { LiveTranscription } from "@/components/session/LiveTranscription";
import { ImageDisplay } from "@/components/session/ImageDisplay";
import { TranscriptPanel, type TranscriptEntry } from "@/components/session/TranscriptPanel";
import type { ClientMessage } from "@/types";
import type { VisualizationCommand } from "@/engine/types";
import Link from "next/link";

// Import renderers to register them (side-effect import)
import "@/renderers";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id ?? "demo";
  const { status, lastMessage, send } = useWebSocket(sessionId);
  const command = useVisualization(lastMessage);
  const imageCommand = useImageDisplay(lastMessage);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  // Local rolling transcript from voice input (for the sidebar feed)
  const [voiceEntries, setVoiceEntries] = useState<{ id: number; text: string }[]>([]);
  const voiceIdRef = useRef(0);

  // Dismiss state for panels — reset when a new visualization arrives
  const [simDismissed, setSimDismissed] = useState(false);
  const [imgDismissed, setImgDismissed] = useState(false);
  const [theoryDismissed, setTheoryDismissed] = useState(false);
  const [transcriptDismissed, setTranscriptDismissed] = useState(false);
  const prevCommandIdRef = useRef<string>("");

  const isConnected = status === "connected";

  // Reset dismiss states when a new visualization command arrives
  useEffect(() => {
    if (command && (command as VisualizationCommand).command_id !== prevCommandIdRef.current) {
      prevCommandIdRef.current = (command as VisualizationCommand).command_id;
      setSimDismissed(false);
      setImgDismissed(false);
      setTheoryDismissed(false);
    }
  }, [command]);

  // Called when VoiceInput produces a final transcript
  const handleFinalTranscript = useCallback((text: string) => {
    voiceIdRef.current += 1;
    setVoiceEntries((prev) => {
      const next = [...prev, { id: voiceIdRef.current, text }];
      return next.length > 8 ? next.slice(-8) : next;
    });
  }, []);

  // Track transcript entries from server messages.
  // When a non-final (interim) entry arrives, replace the last interim.
  // When a final entry arrives, replace the last interim or append.
  useEffect(() => {
    if (lastMessage && (lastMessage as any).type === "transcript_segment") {
      const msg = lastMessage as any;
      const entry: TranscriptEntry = {
        id: msg.segment_id,
        text: msg.text,
        is_final: msg.is_final,
        timestamp: msg.timestamp,
      };

      setTranscript((prev) => {
        // If the last entry is non-final (interim), replace it
        if (prev.length > 0 && !prev[prev.length - 1].is_final) {
          return [...prev.slice(0, -1), entry];
        }
        // Otherwise append
        return [...prev, entry];
      });
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
        <main className="relative flex-1 p-4">
          {command && imageCommand && !simDismissed && !imgDismissed ? (
            /* Split view: simulation + image */
            <div className="flex h-full gap-3">
              <div className="flex-1 rounded-xl border border-gray-700/50 bg-gray-900/60 overflow-hidden">
                <VisualizationEngine
                  command={command as VisualizationCommand}
                  onParameterChange={handleParameterChange}
                  onDismiss={() => setSimDismissed(true)}
                />
              </div>
              <div className="flex-1 rounded-xl border border-gray-700/50 bg-gray-900/60 overflow-hidden">
                <ImageDisplay command={imageCommand} onDismiss={() => setImgDismissed(true)} />
              </div>
            </div>
          ) : command && !simDismissed ? (
            /* Simulation only */
            <div className="h-full rounded-xl border border-gray-700/50 bg-gray-900/60 overflow-hidden">
              <VisualizationEngine
                command={command as VisualizationCommand}
                onParameterChange={handleParameterChange}
                onDismiss={() => setSimDismissed(true)}
              />
            </div>
          ) : imageCommand && !imgDismissed ? (
            /* Image only */
            <div className="h-full rounded-xl border border-gray-700/50 bg-gray-900/60 overflow-hidden">
              <ImageDisplay command={imageCommand} onDismiss={() => setImgDismissed(true)} />
            </div>
          ) : (
            /* Empty state */
            <div className="flex h-full items-center justify-center rounded-xl border border-gray-800 bg-gray-900/40">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-800/50">
                  <svg className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-400">Ready to Learn</p>
                <p className="text-sm text-gray-600 max-w-sm">
                  Press the <strong className="text-blue-400">mic button</strong> below and start speaking.
                  AI will generate visualizations in real time.
                </p>
              </div>
            </div>
          )}

          {/* Floating voice input bar — always at the bottom of the main area */}
          <VoiceInput
            onSend={handleSend}
            disabled={!isConnected}
            onFinalTranscript={handleFinalTranscript}
          />
        </main>

        {/* Right: Sidebar */}
        <aside className="flex w-80 flex-col gap-3 overflow-y-auto border-l border-gray-800 p-4">
          {/* Live transcript feed */}
          {!transcriptDismissed && (
            <LiveTranscription entries={voiceEntries} onDismiss={() => setTranscriptDismissed(true)} />
          )}

          {/* Demo mode (fallback) */}
          <DemoMode onSend={handleSend} disabled={!isConnected} />

          {/* Test controls */}
          <TestControls onSend={handleSend} disabled={!isConnected} />

          {/* Transcript */}
          <TranscriptPanel entries={transcript} />

          {/* Theory panel */}
          {command && !theoryDismissed && (
            <TheoryPanel
              theory={(command as VisualizationCommand).theory}
              onDismiss={() => setTheoryDismissed(true)}
            />
          )}

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
    { subject: "physics", concept: "free_fall", label: "Free Fall" },
    { subject: "physics", concept: "pendulum", label: "Pendulum" },
    { subject: "physics", concept: "simple_harmonic_motion", label: "Spring" },
    { subject: "physics", concept: "momentum_collisions", label: "Collision" },
    { subject: "physics", concept: "ray_optics", label: "Lens" },
    { subject: "math", concept: "quadratic_function", label: "Quadratic" },
    { subject: "math", concept: "derivative", label: "Derivative" },
    { subject: "math", concept: "vector", label: "Vector" },
    { subject: "math", concept: "unit_circle", label: "Unit Circle" },
    { subject: "math", concept: "integration", label: "Riemann" },
    { subject: "computer_science", concept: "sorting_algorithm", label: "Sorting" },
    { subject: "computer_science", concept: "binary_tree", label: "Tree" },
    { subject: "computer_science", concept: "bfs_dfs", label: "BFS/DFS" },
    { subject: "computer_science", concept: "pathfinding", label: "Pathfinding" },
    { subject: "computer_science", concept: "recursion", label: "Hanoi" },
    { subject: "biology", concept: "dna_replication", label: "DNA" },
    { subject: "biology", concept: "cell_structure", label: "Cell" },
    { subject: "biology", concept: "mendelian_genetics", label: "Punnett" },
    { subject: "biology", concept: "enzyme_kinetics", label: "Enzyme" },
    { subject: "chemistry", concept: "atomic_structure", label: "Atom" },
    { subject: "chemistry", concept: "molecule", label: "Molecule" },
    { subject: "chemistry", concept: "acid_base_titration", label: "Titration" },
  ];
// ... existing code ...

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
