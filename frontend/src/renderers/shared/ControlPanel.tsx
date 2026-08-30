/**
 * Shared UI controls for interactive renderers.
 *
 * Reusable building blocks extracted from ProjectileRenderer patterns
 * to avoid duplication across all 9+ simulation renderers.
 */

import type { ReactNode } from "react";

// ── Slider ───────────────────────────────────────────────────────────

export function Slider({
  label, value, min, max, step = 1, unit, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-gray-400">{label}</span>
        <span className="text-blue-400 tabular-nums">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-blue-500"
      />
    </label>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────

export function Toggle({
  label, value, onChange,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px]">
      <input
        type="checkbox" checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded accent-blue-500"
      />
      <span className="text-gray-400">{label}</span>
    </label>
  );
}

// ── Button Group ─────────────────────────────────────────────────────

export function ButtonGroup<T extends string>({
  options, selected, onChange,
}: {
  options: { label: string; value: T }[];
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors
            ${o.value === selected
              ? "bg-blue-600 text-white"
              : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Play Controls ────────────────────────────────────────────────────

export function PlayControls({
  isPlaying, onPlay, onPause, onReset, onStep,
}: {
  isPlaying: boolean;
  onPlay: () => void; onPause: () => void;
  onReset: () => void; onStep?: () => void;
}) {
  return (
    <div className="flex gap-1.5">
      {isPlaying ? (
        <Btn onClick={onPause} primary title="Pause">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </Btn>
      ) : (
        <Btn onClick={onPlay} primary title="Play">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </Btn>
      )}
      {onStep && (
        <Btn onClick={onStep} disabled={isPlaying} title="Step">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4v16l8-8zm10 0h2v16h-2z" />
          </svg>
        </Btn>
      )}
      <Btn onClick={onReset} title="Reset">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
      </Btn>
    </div>
  );
}

// ── Stat Box ─────────────────────────────────────────────────────────

export function Stat({
  label, value, unit, decimals = 1,
}: {
  label: string; value: number | string; unit: string; decimals?: number;
}) {
  const display = typeof value === "number" ? value.toFixed(decimals) : value;
  return (
    <span className="text-[11px] text-gray-500">
      {label}: <span className="text-blue-400 tabular-nums">{display}</span>
      {unit}
    </span>
  );
}

// ── Button ───────────────────────────────────────────────────────────

function Btn({
  children, onClick, disabled, primary, title,
}: {
  children: ReactNode; onClick: () => void;
  disabled?: boolean; primary?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      className={`flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
        ${primary
          ? "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-900"
          : "border border-gray-600/50 text-gray-300 hover:bg-gray-700/60"}
        disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

// ── Number Input ─────────────────────────────────────────────────────

export function NumInput({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-gray-400">{label}</span>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-gray-600/50 bg-gray-800/60 px-2 py-1 text-xs text-gray-200 tabular-nums focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

// ── Text Input ───────────────────────────────────────────────────────

export function TextInput({
  label, value, placeholder, onChange,
}: {
  label: string; value: string; placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-gray-400">{label}</span>
      <input
        type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-600/50 bg-gray-800/60 px-2 py-1 font-mono text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
