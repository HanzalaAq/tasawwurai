/**
 * Math rendering component using KaTeX.
 *
 * Renders LaTeX formulas both inline and in display mode.
 * Used throughout the TheoryPanel and individual renderers.
 */

"use client";

import { useMemo } from "react";
import katex from "katex";

interface MathProps {
  latex: string;
  display?: boolean;
  className?: string;
}

export function Math({ latex, display = false, className = "" }: MathProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: true,
      });
    } catch {
      return `<span class="text-red-400">Formula error</span>`;
    }
  }, [latex, display]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
