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

import { registry } from "./registry";
import GenericGraphRenderer from "@/renderers/GenericGraphRenderer";
import type { VisualizationCommand, RendererProps } from "./types";

interface EngineProps {
  command: VisualizationCommand;
  onParameterChange?: (type: string, partial: Record<string, unknown>) => void;
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
        <div className="flex items-center gap-3 border-b border-gray-700/50 px-5 py-2.5">
          <span className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-semibold text-yellow-300">
            {command.visualization.type} (generic)
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <GenericGraphRenderer parameters={params} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-yellow-600/30 bg-yellow-900/10 p-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
          <span className="text-xl">?</span>
        </div>
        <p className="text-sm font-medium text-yellow-300">No Renderer Found</p>
        <p className="mt-1 text-xs text-yellow-400/60">
          No renderer registered for type: <code>{command.visualization.type}</code>
        </p>
      </div>
    </div>
  );
}

export function VisualizationEngine({ command, onParameterChange }: EngineProps) {
  const { visualization, subject, concept } = command;
  const entry = registry.resolve(visualization.type);

  if (!entry) {
    return <FallbackRenderer command={command} />;
  }

  const { Component } = entry;

  const handleUpdate = (partial: Record<string, unknown>) => {
    onParameterChange?.(visualization.type, partial);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header bar with type badge */}
      <div className="flex items-center gap-3 border-b border-gray-700/50 px-5 py-2.5">
        <span className="rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-semibold text-blue-300">
          {visualization.type}
        </span>
        <span className="text-xs text-gray-500">
          {subject} / {concept}
        </span>
        <span className="ml-auto text-xs text-gray-600">
          {entry.manifest.technology}
        </span>
      </div>

      {/* Renderer area */}
      <div className="flex-1 overflow-hidden">
        <Component parameters={visualization.parameters} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
