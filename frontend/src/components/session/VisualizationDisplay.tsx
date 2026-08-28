/**
 * VisualizationDisplay — renders the visualization payload.
 *
 * For now, this shows a structured JSON representation.
 * In the future, this will resolve a renderer from the
 * Visualization Engine registry based on visualization.type.
 */

import type { VisualizationPayload } from "@/types";

interface Props {
  visualization: VisualizationPayload;
  subject: string;
  concept: string;
}

export function VisualizationDisplay({ visualization, subject, concept }: Props) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-700 bg-gray-900/80">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-gray-700 px-5 py-3">
        <span className="rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-medium text-blue-300">
          {visualization.type}
        </span>
        <span className="text-sm text-gray-400">
          {subject} / {concept}
        </span>
      </div>

      {/* Canvas area — will be replaced by actual renderers */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-4 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-500/10">
            <svg
              className="h-12 w-12 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
              />
            </svg>
          </div>

          <p className="text-lg font-semibold text-gray-200">
            Visualization Renderer
          </p>
          <p className="text-sm text-gray-400">
            The renderer for <code className="text-blue-300">{visualization.type}</code> will be
            displayed here once the Visualization Engine and renderers are implemented.
          </p>

          {/* Parameter display */}
          <div className="rounded-lg bg-gray-800/80 p-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Parameters
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(visualization.parameters).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{key}:</span>
                  <span className="rounded bg-gray-700 px-2 py-0.5 font-mono text-xs text-emerald-300">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
