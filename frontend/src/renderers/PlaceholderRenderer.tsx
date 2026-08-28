/**
 * Generic placeholder renderer for visualization types
 * that don't yet have a production implementation.
 *
 * Shows the visualization type, parameters, and a message
 * indicating the renderer is coming soon.
 */

"use client";

import type { RendererProps } from "@/engine/types";

export default function PlaceholderRenderer({ parameters }: RendererProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-700/30">
          <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-300">Renderer Coming Soon</p>
        <p className="text-sm text-gray-500">
          This visualization type is registered and ready to receive commands.
          The interactive renderer is under development.
        </p>
        <div className="rounded-lg bg-gray-800/60 p-3 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Current Parameters</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(parameters).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{key}:</span>
                <span className="rounded bg-gray-700/60 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
