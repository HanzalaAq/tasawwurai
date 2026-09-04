/**
 * StatusChip — the app's unified status indicator language.
 *
 * One component for every system state:
 *   LIVE · PROCESSING · ANALYZING · COMPLETE · ERROR · OFFLINE
 *   CONNECTED · CONNECTING · DISCONNECTED
 *
 * Each variant carries a semantic hue and an optional pulsing dot.
 * Two tones: "light" (default — on light surfaces) and "dark"
 * (on the storm hero / dark viewports) so contrast always holds.
 */

import type { ReactNode } from "react";

export type ChipVariant =
  | "live"
  | "processing"
  | "analyzing"
  | "complete"
  | "error"
  | "offline"
  | "connected"
  | "connecting"
  | "disconnected"
  | "neutral";

type Hue = "emerald" | "azure" | "steel" | "rose" | "amber" | "slate";

const VARIANTS: Record<ChipVariant, { label: string; hue: Hue; pulse: boolean }> = {
  live: { label: "LIVE", hue: "emerald", pulse: true },
  processing: { label: "PROCESSING", hue: "azure", pulse: true },
  analyzing: { label: "ANALYZING", hue: "steel", pulse: true },
  complete: { label: "COMPLETE", hue: "emerald", pulse: false },
  error: { label: "ERROR", hue: "rose", pulse: false },
  offline: { label: "OFFLINE", hue: "slate", pulse: false },
  connected: { label: "CONNECTED", hue: "emerald", pulse: false },
  connecting: { label: "CONNECTING", hue: "amber", pulse: true },
  disconnected: { label: "DISCONNECTED", hue: "slate", pulse: false },
  neutral: { label: "IDLE", hue: "slate", pulse: false },
};

interface ChipStyle {
  dot: string;
  text: string;
  bg: string;
  ring: string;
}

const TONE_LIGHT: Record<Hue, ChipStyle> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-500/10", ring: "ring-emerald-600/20" },
  azure: { dot: "bg-azure-500", text: "text-azure-800", bg: "bg-azure-500/12", ring: "ring-azure-600/25" },
  steel: { dot: "bg-steel-500", text: "text-steel-700", bg: "bg-steel-500/10", ring: "ring-steel-500/25" },
  rose: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-500/10", ring: "ring-rose-600/20" },
  amber: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-500/10", ring: "ring-amber-600/25" },
  slate: { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-500/10", ring: "ring-slate-400/25" },
};

const TONE_DARK: Record<Hue, ChipStyle> = {
  emerald: { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-400/10", ring: "ring-emerald-300/25" },
  azure: { dot: "bg-azure-400", text: "text-azure-200", bg: "bg-azure-300/10", ring: "ring-azure-300/25" },
  steel: { dot: "bg-steel-400", text: "text-steel-200", bg: "bg-steel-400/10", ring: "ring-steel-300/25" },
  rose: { dot: "bg-rose-400", text: "text-rose-300", bg: "bg-rose-400/10", ring: "ring-rose-300/25" },
  amber: { dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-400/10", ring: "ring-amber-300/25" },
  slate: { dot: "bg-slate-400", text: "text-mist-300", bg: "bg-white/5", ring: "ring-white/15" },
};

interface Props {
  variant: ChipVariant;
  /** Override the default label. */
  label?: ReactNode;
  size?: "xs" | "sm";
  /** "light" chips sit on light surfaces; "dark" on the storm hero. */
  tone?: "light" | "dark";
  className?: string;
}

export function StatusChip({ variant, label, size = "sm", tone = "light", className = "" }: Props) {
  const v = VARIANTS[variant];
  const s = (tone === "dark" ? TONE_DARK : TONE_LIGHT)[v.hue];
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium uppercase tracking-wider ring-1 ${s.bg} ${s.ring} ${s.text} ${pad} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {v.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      {label ?? v.label}
    </span>
  );
}
