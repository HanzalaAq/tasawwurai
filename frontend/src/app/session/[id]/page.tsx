"use client";

/**
 * Session page — the AI visualization observatory workspace.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ Command bar: logo · session · AI status · sys │
 *   ├───────────────────────────────────┬──────────┤
 *   │                                   │ Sidebar  │
 *   │   Visualization canvas (hero)     │  tabs:   │
 *   │   + floating voice input          │  Feed    │
 *   │                                   │  Theory  │
 *   │                                   │  Lab     │
 *   └───────────────────────────────────┴──────────┘
 *
 * Preserves the full WebSocket contract: transcript, demo_text, test,
 * parameter_change, ping messages; transcript_segment,
 * visualization_command, image_command, error, pong responses.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useVisualization } from "@/hooks/useVisualization";
import { useImageDisplay } from "@/hooks/useImageDisplay";
import { useAiStatus } from "@/hooks/useAiStatus";
import { useToast } from "@/components/ui/Toast";
import { StatusChip } from "@/components/ui/StatusChip";
import { Tooltip } from "@/components/ui/Tooltip";
import { AiProcessing } from "@/components/ui/AiProcessing";
import { Logo } from "@/components/Logo";
import { TheoryPanel } from "@/components/session/TheoryPanel";
import { VisualizationEngine } from "@/engine/VisualizationEngine";
import { DemoMode } from "@/components/session/DemoMode";
import { VoiceInput } from "@/components/session/VoiceInput";
import { LiveTranscription } from "@/components/session/LiveTranscription";
import { ImageDisplay } from "@/components/session/ImageDisplay";
import { ConceptLab } from "@/components/session/ConceptLab";
import { TranscriptPanel, type TranscriptEntry } from "@/components/session/TranscriptPanel";
import type { ClientMessage } from "@/types";
import type { VisualizationCommand } from "@/engine/types";
import Link from "next/link";

// Import renderers to register them (side-effect import)
import "@/renderers";

type SidebarTab = "feed" | "theory" | "lab";

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "theory", label: "Theory" },
  { id: "lab", label: "Lab" },
];

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id ?? "demo";
  const { status, lastMessage, send } = useWebSocket(sessionId);
  const command = useVisualization(lastMessage);
  const imageCommand = useImageDisplay(lastMessage);
  const toast = useToast();

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  // Local rolling transcript from voice input (for the sidebar feed)
  const [voiceEntries, setVoiceEntries] = useState<{ id: number; text: string }[]>([]);
  const voiceIdRef = useRef(0);

  const { phase: aiPhase, markSent } = useAiStatus(lastMessage);

  // Dismiss state for panels — reset when a new visualization arrives
  const [imgDismissed, setImgDismissed] = useState(false);
  const prevCommandIdRef = useRef<string>("");

  // Workspace modes
  const [immersive, setImmersive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [activeTab, setActiveTab] = useState<SidebarTab>("feed");
  const [showDebug, setShowDebug] = useState(false);

  const isConnected = status === "connected";

  // ── AI status → header chip ───────────────────────────────────
  const aiChip =
    aiPhase === "thinking" ? "analyzing" : aiPhase === "complete" ? "complete" : aiPhase === "error" ? "error" : "neutral";
  const aiLabel =
    aiPhase === "thinking" ? "ANALYZING" : aiPhase === "complete" ? "SCENE READY" : aiPhase === "error" ? "AI ERROR" : "AI READY";

  // Welcome + connection feedback
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      if (status === "connected") {
        toast.success({ title: "Connected to TasawwurAI", message: "Real-time channel established." });
        // Fresh session start — let the backend reset its lesson context
        send({ type: "session_control", action: "start" });
      } else if (status === "error" || status === "disconnected") {
        if (prevStatusRef.current === "connected") {
          toast.error({ title: "Connection interrupted", message: "Reconnecting automatically…" });
        }
      }
      prevStatusRef.current = status;
    }
  }, [status, toast, send]);

  // Reset dismiss states when a new visualization command arrives
  useEffect(() => {
    if (command && (command as VisualizationCommand).command_id !== prevCommandIdRef.current) {
      prevCommandIdRef.current = (command as VisualizationCommand).command_id;
      setImgDismissed(false);
      setActiveTab((t) => (t === "theory" ? "theory" : t));
    }
  }, [command]);

  // Announce fresh scenes
  const announcedRef = useRef("");
  useEffect(() => {
    if (command) {
      const id = (command as VisualizationCommand).command_id;
      if (announcedRef.current !== id) {
        announcedRef.current = id;
        toast.ai({
          title: `${(command as VisualizationCommand).theory.title} rendered`,
          message: "Interactive scene is live on the canvas.",
        });
      }
    }
  }, [command, toast]);

  // Surface backend error messages as elegant toasts
  useEffect(() => {
    if (lastMessage && (lastMessage as any).type === "error") {
      const msg = lastMessage as any;
      toast.error({ title: "The AI planner reported an issue", message: msg.message ?? "Unknown error" });
    }
  }, [lastMessage, toast]);

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
      if (message.type === "transcript" || message.type === "demo_text" || message.type === "test") {
        markSent();
      }
      send(message);
    },
    [send, markSent]
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

  // ── Immersive mode helpers ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImmersive(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasSim = !!command;
  const hasImage = !!imageCommand && !imgDismissed;
  const showAiProcessing = aiPhase === "thinking" && !command;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ══ Command bar ═════════════════════════════════════════ */}
      <header className="glass-panel hairline-top z-40 flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-85" aria-label="Back to home">
            <Logo size={30} />
          </Link>
          <span className="hidden text-steel-300 sm:block">/</span>
          <Tooltip content={`Session ${sessionId}`} side="bottom">
            <span className="hidden max-w-[180px] truncate rounded-md bg-white/70 px-2.5 py-1 font-mono text-[11px] text-steel-600 ring-1 ring-steel-300 sm:block">
              {sessionId}
            </span>
          </Tooltip>
        </div>

        {/* Center: AI status — always answers "what is it doing now" */}
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={aiChip + aiLabel}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.25 }}
            >
              <StatusChip variant={aiChip as any} label={aiLabel} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection */}
          <StatusChip
            size="xs"
            variant={
              status === "connected" ? "connected" :
              status === "connecting" ? "connecting" :
              status === "error" ? "error" : "disconnected"
            }
          />

          {/* Sidebar toggle (mobile) */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-2 text-steel-500 ring-1 ring-steel-300 transition-colors hover:bg-steel-500/10 hover:text-dusk-700 lg:hidden"
            aria-label={sidebarOpen ? "Close panel" : "Open panel"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Immersive toggle */}
          <Tooltip content={immersive ? "Exit focus mode (Esc)" : "Enter focus mode"} side="left">
            <button
              onClick={() => setImmersive((v) => !v)}
              className={`rounded-lg p-2 ring-1 transition-all ${
                immersive
                  ? "bg-azure-500/15 text-azure-700 ring-azure-500/40"
                  : "text-steel-500 ring-steel-300 hover:bg-steel-500/10 hover:text-dusk-700"
              }`}
              aria-label={immersive ? "Exit immersive mode" : "Enter immersive mode"}
            >
              {immersive ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* ══ Workspace ═══════════════════════════════════════════ */}
      <div className="relative flex min-h-0 flex-1">
        {/* ── Main canvas area ── */}
        <main className="relative min-w-0 flex-1 p-3 sm:p-4">
          <AnimatePresence mode="wait">
            {showAiProcessing ? (
              /* AI composing — first scene */
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-panel hairline-top h-full overflow-hidden rounded-2xl"
              >
                <AiProcessing />
              </motion.div>
            ) : hasSim && hasImage ? (
              /* Split view: simulation + image */
              <motion.div
                key="split"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full gap-3"
              >
                <div className="glass-panel hairline-top min-w-0 flex-1 overflow-hidden rounded-2xl">
                  <VisualizationEngine
                    command={command as VisualizationCommand}
                    onParameterChange={handleParameterChange}
                  />
                </div>
                <div className="glass-panel hairline-top hidden min-w-0 flex-1 overflow-hidden rounded-2xl md:block">
                  <ImageDisplay command={imageCommand!} onDismiss={() => setImgDismissed(true)} />
                </div>
              </motion.div>
            ) : hasSim ? (
              /* Simulation only */
              <motion.div
                key={`sim-${(command as VisualizationCommand).command_id}`}
                initial={{ opacity: 0, y: 10, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="glass-panel hairline-top h-full overflow-hidden rounded-2xl"
              >
                <VisualizationEngine
                  command={command as VisualizationCommand}
                  onParameterChange={handleParameterChange}
                />
              </motion.div>
            ) : hasImage ? (
              /* Image only */
              <motion.div
                key="img"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="glass-panel hairline-top h-full overflow-hidden rounded-2xl"
              >
                <ImageDisplay command={imageCommand!} onDismiss={() => setImgDismissed(true)} />
              </motion.div>
            ) : (
              /* Empty state — intentional, not vacant */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-panel hairline-top flex h-full flex-col items-center justify-center gap-6 rounded-2xl px-6 text-center"
              >
                {/* Orbital emblem */}
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-azure-500/20" />
                  <span className="orbit-slow absolute inset-0 rounded-full border border-dashed border-azure-500/35" />
                  <span className="orbit-rev absolute inset-4 rounded-full border border-steel-500/30" />
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-azure-500/10 ring-1 ring-azure-600/30">
                    <svg className="h-6 w-6 text-azure-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  </span>
                  <span className="absolute -z-10 h-24 w-24 rounded-full bg-azure-400/20 blur-2xl" />
                </div>

                <div className="max-w-md space-y-2">
                  <h2 className="font-display text-xl font-semibold text-dusk-800">
                    Waiting for your lesson
                  </h2>
                  <p className="text-sm leading-relaxed text-steel-600">
                    Press the <span className="font-medium text-azure-700">mic</span> and start teaching —
                    TasawwurAI will transcribe, understand, and compose interactive
                    scenes in real time.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-steel-500">
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-steel-300">physics</span>
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-steel-300">math</span>
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-steel-300">cs</span>
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-steel-300">biology</span>
                  <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-steel-300">chemistry</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI re-composing overlay (existing scene visible underneath) */}
          <AnimatePresence>
            {aiPhase === "thinking" && command && (
              <motion.div
                key="reprocessing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2"
              >
                <div className="glass-panel flex items-center gap-3 rounded-full px-4 py-2">
                  <AiProcessing compact />
                  <span className="text-xs text-steel-600">updating scene…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating voice input — bottom center of the canvas area */}
          {!immersive && (
            <VoiceInput
              onSend={handleSend}
              disabled={!isConnected}
              onFinalTranscript={handleFinalTranscript}
            />
          )}
        </main>

        {/* ── Sidebar ── */}
        {!immersive && (
          <>
            {/* Mobile scrim */}
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  key="scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                  className="absolute inset-0 z-20 bg-dusk-900/35 backdrop-blur-sm lg:hidden"
                />
              )}
            </AnimatePresence>

            <aside
              className={`glass-panel absolute inset-y-0 right-0 z-30 flex w-80 max-w-[88vw] flex-col border-y-0 border-r-0 transition-transform duration-300 lg:relative lg:z-auto lg:translate-x-0 lg:rounded-l-2xl ${
                sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
              }`}
            >
              {/* Tabs */}
              <div className="flex shrink-0 items-center gap-1 border-b border-steel-200/70 p-2">
                {SIDEBAR_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`relative flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      activeTab === t.id ? "text-azure-700" : "text-steel-500 hover:text-dusk-600"
                    }`}
                  >
                    {t.label}
                    {activeTab === t.id && (
                      <motion.span
                        layoutId="sidebar-tab"
                        className="absolute inset-0 -z-10 rounded-lg bg-azure-500/12 ring-1 ring-azure-500/25"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                  </button>
                ))}
                {/* Mobile close */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-2 text-steel-500 hover:bg-steel-500/10 hover:text-dusk-700 lg:hidden"
                  aria-label="Close panel"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tab panels */}
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {activeTab === "feed" && (
                  <div className="space-y-3">
                    <LiveTranscription entries={voiceEntries} />
                    <TranscriptPanel entries={transcript} />
                  </div>
                )}

                {activeTab === "theory" && (
                  <div className="space-y-3">
                    {command ? (
                      <TheoryPanel theory={(command as VisualizationCommand).theory} />
                    ) : (
                      <EmptyTab
                        icon={
                          <svg className="h-6 w-6 text-steel-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                          </svg>
                        }
                        title="Theory unlocks with the first scene"
                        body="Every visualization arrives with formulas, key points and a concise explanation."
                      />
                    )}
                  </div>
                )}

                {activeTab === "lab" && (
                  <div className="space-y-3">
                    <DemoMode onSend={handleSend} disabled={!isConnected} />
                    <ConceptLab onSend={handleSend} disabled={!isConnected} />
                  </div>
                )}
              </div>

              {/* Footer: debug toggle */}
              <div className="shrink-0 border-t border-steel-200/70 p-2">
                <button
                  onClick={() => setShowDebug((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-steel-400 transition-colors hover:bg-steel-500/10 hover:text-steel-600"
                >
                  <span>Signal Inspector</span>
                  <span>{showDebug ? "▲" : "▼"}</span>
                </button>
                {showDebug && (
                  <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-mist-200/80 p-2">
                    <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-steel-500">
                      {lastMessage ? JSON.stringify(lastMessage, null, 2) : "// waiting for server messages…"}
                    </pre>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

// ── Empty tab placeholder ────────────────────────────────────────

function EmptyTab({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-steel-300 px-4 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 ring-1 ring-steel-200">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-dusk-700">{title}</p>
        <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-steel-500">{body}</p>
      </div>
    </div>
  );
}
