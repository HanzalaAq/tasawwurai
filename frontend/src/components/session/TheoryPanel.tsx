/**
 * TheoryPanel — renders educational theory alongside a visualization.
 *
 * Displays: title, explanation, formulas (KaTeX), key points, definitions.
 * Subject-agnostic — works for physics, math, chemistry, biology, CS, etc.
 */

"use client";

import type { TheoryBlock } from "@/engine/types";
import { Math } from "@/components/Math";

interface Props {
  theory: TheoryBlock;
  onDismiss?: () => void;
}

export function TheoryPanel({ theory, onDismiss }: Props) {
  return (
    <div className="relative space-y-4 overflow-y-auto rounded-xl border border-gray-700/50 bg-gray-800/40 p-5">
      {/* Close button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-700/40 hover:text-gray-300"
          title="Close theory"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {/* Title */}
      <h2 className="text-lg font-bold text-white">{theory.title}</h2>

      {/* Explanation */}
      <p className="text-sm leading-relaxed text-gray-300">{theory.explanation}</p>

      {/* Formulas */}
      {theory.formulas.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Formulas
          </h3>
          <div className="space-y-2">
            {theory.formulas.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-900/50 px-3 py-2">
                <span className="mt-0.5 shrink-0 text-xs font-medium text-blue-400">{f.name}</span>
                <Math latex={f.latex} className="text-emerald-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {theory.key_points.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Key Points
          </h3>
          <ul className="space-y-1.5">
            {theory.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
