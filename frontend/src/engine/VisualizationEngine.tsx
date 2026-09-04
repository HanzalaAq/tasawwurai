/**
 * Visualization Engine — the main React component.
 *
 * Receives a VisualizationCommand, resolves the correct renderer from the
 * registry, and renders it. Completely independent of the AI or backend.
 *
 * Architecture:
 *   VisualizationCommand → Registry.resolve(type) → Renderer Component
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { registry } from "./registry";
import GenericGraphRenderer from "@/renderers/GenericGraphRenderer";
import type { VisualizationCommand, RendererProps } from "./types";
import { subjectTheme, conceptLabel } from "@/lib/subjectTheme";

interface EngineProps {
  command: VisualizationCommand;
  onParameterChange?: (type: string, partial: Record<string, unknown>) => void;
  onDismiss?: () => void;
}

/**
 * Fallback renderer shown when no renderer is registered for a type.
 * Attempts GenericGraphRenderer first, then shows "No Renderer Found".
 */
function FallbackRenderer({ command }: { command: VisualizationCommand }) {
  // If the visualization has data-like parameters, try the generic graph
  const params = command.visualization.parameters;
  const hasData = params && (params.data || params.chartType || params.expression);

  if (hasData) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-steel-200/80 px-4 py-2.5">
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/30">
            {command.visualization.type} · generic
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <GenericGraphRenderer parameters={params} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-amber-700">No renderer for this scene yet</p>
        <p className="mt-1 text-xs leading-relaxed text-steel-500">
          The planner chose <code className="rounded bg-steel-500/10 px-1.5 py-0.5 font-mono text-[10px] text-steel-600">{command.visualization.type}</code>, which has no registered visual module.
        </p>
      </div>
    </div>
  );
}

export function VisualizationEngine({ command, onParameterChange, onDismiss }: EngineProps) {
  const { visualization, subject, concept } = command;
  const entry = registry.resolve(visualization.type);
  const theme = subjectTheme(subject);
  const displayName = entry?.manifest.name || conceptLabel(concept) || visualization.type;

  // Local parameter overrides — merge backend params with user interactions.
  // This is essential: renderers call onUpdate() when the user drags a slider
  // or clicks a button. Without local state, the slider value comes from
  // command.visualization.parameters which only updates when the backend sends
  // a new visualization_command (which doesn't happen for parameter changes).
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const prevCommandIdRef = useRef(command.command_id);

  // Reset overrides whenever a NEW command arrives (different command_id or type)
  useEffect(() => {
    if (command.command_id !== prevCommandIdRef.current) {
      setOverrides({});
      prevCommandIdRef.current = command.command_id;
    }
  }, [command.command_id]);

  // Merge backend parameters with local overrides
  const mergedParams = { ...visualization.parameters, ...overrides };

  if (!entry) {
    return <FallbackRenderer command={command} />;
  }

  const { Component } = entry;

  const handleUpdate = (partial: Record<string, unknown>) => {
    // Immediately update local state so the UI responds instantly
    setOverrides((prev) => ({ ...prev, ...partial }));
    // Also notify the backend (for logging / multi-user sync)
    onParameterChange?.(visualization.type, partial);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header bar — subject-themed identity strip */}
      <div className="flex shrink-0 items-center gap-3 border-b border-steel-200/80 px-4 py-2.5">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
          title={theme.label}
        >
          {theme.monogram}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-dusk-800">
            {displayName}
          </p>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-steel-400">
            {visualization.type}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto rounded-md p-1.5 text-steel-400 transition-colors hover:bg-steel-500/10 hover:text-dusk-700"
            title="Close simulation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Renderer area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Component parameters={mergedParams} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
