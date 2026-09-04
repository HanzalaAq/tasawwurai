/**
 * AiProcessing — the AI "at work" experience.
 *
 * Shown between the moment teacher speech is sent and the moment a
 * visualization command arrives. Communicates a staged processing
 * narrative ("Listening" → "Parsing" → "Matching concept" →
 * "Composing visualization") over an animated neural lattice.
 *
 * Purely presentational; the stage advances on a timer.
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export const AI_STAGES = [
  "Parsing speech",
  "Identifying concept",
  "Selecting visualization",
  "Composing scene",
] as const;

export const AI_STAGE_HINTS = [
  "Transcribing the teacher's words",
  "Matching against the concept catalog",
  "Choosing the best interactive model",
  "Setting parameters & theory",
] as const;

const STAGE_MS = 900;

interface Props {
  /** Override the heading. */
  title?: string;
  /** Compact variant for inline use inside the canvas area. */
  compact?: boolean;
}

export function AiProcessing({ title = "AI is composing your visualization", compact = false }: Props) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s + 1) % AI_STAGES.length);
    }, STAGE_MS);
    return () => clearInterval(t);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5" aria-live="polite">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-azure-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-azure-500" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-azure-700">
          {AI_STAGES[stage]}…
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6" aria-live="polite">
      {/* Neural lattice */}
      <div className="relative h-40 w-40">
        {/* Rotating rings */}
        <motion.div
          className="absolute inset-0 rounded-full border border-azure-500/25"
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-azure-500 shadow-[0_0_10px_2px_rgba(136,189,242,0.7)]" />
        </motion.div>
        <motion.div
          className="absolute inset-5 rounded-full border border-steel-500/25"
          animate={{ rotate: -360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        >
          <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-steel-500 shadow-[0_0_8px_2px_rgba(106,137,167,0.55)]" />
        </motion.div>

        {/* Core */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-azure-500/10 ring-1 ring-azure-600/30 backdrop-blur-sm">
            <svg className="h-7 w-7 text-azure-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
            <span className="absolute inset-0 -z-10 rounded-2xl bg-azure-400/25 blur-xl" />
          </span>
        </motion.div>

        {/* Ambient halo */}
        <motion.span
          className="absolute inset-0 -z-10 rounded-full bg-azure-300/25 blur-2xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Narrative */}
      <div className="max-w-sm text-center">
        <p className="font-display text-base font-medium text-dusk-800">{title}</p>
        <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="true">
          {AI_STAGES.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === stage ? "w-8 bg-azure-600" : i < stage ? "w-3 bg-azure-500/50" : "w-3 bg-steel-300"
              }`}
            />
          ))}
        </div>
        <AnimateStageText stage={stage} />
      </div>
    </div>
  );
}

function AnimateStageText({ stage }: { stage: number }) {
  return (
    <motion.p
      key={stage}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-azure-700"
    >
      {AI_STAGES[stage]}
      <span className="ml-1 animate-pulse">…</span>
    </motion.p>
  );
}
