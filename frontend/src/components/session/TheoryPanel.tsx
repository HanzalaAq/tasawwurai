/**
 * TheoryPanel — the intelligence panel beside every visualization.
 *
 * Displays: title, explanation, formulas (KaTeX), key points.
 * Subject-agnostic — works for physics, math, chemistry, biology, CS.
 */

"use client";

import { motion } from "framer-motion";
import type { TheoryBlock } from "@/engine/types";
import { Math } from "@/components/Math";

interface Props {
  theory: TheoryBlock;
}

export function TheoryPanel({ theory }: Props) {
  return (
    <section className="space-y-5" aria-label="Lesson theory">
      {/* Title */}
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-azure-700/80">
          AI Insight
        </p>
        <h2 className="font-display text-lg font-semibold leading-snug text-dusk-800">
          {theory.title}
        </h2>
      </header>

      {/* Explanation */}
      <p className="text-sm leading-relaxed text-steel-600">{theory.explanation}</p>

      {/* Formulas */}
      {theory.formulas.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-steel-500">
            Formulas
          </h3>
          <div className="space-y-2">
            {theory.formulas.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.3 }}
                className="flex items-start justify-between gap-3 rounded-lg border border-steel-200/80 bg-mist-200/70 px-3 py-2.5 transition-colors hover:border-azure-500/40"
              >
                <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-wider text-steel-500">
                  {f.name}
                </span>
                <Math latex={f.latex} className="text-azure-800" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {theory.key_points.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-steel-500">
            Key Points
          </h3>
          <ul className="space-y-2">
            {theory.key_points.map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-dusk-600"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-azure-500 to-steel-500 shadow-[0_0_6px_rgba(136,189,242,0.5)]" />
                {point}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
