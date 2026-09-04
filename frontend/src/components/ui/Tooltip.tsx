/**
 * Tooltip — elegant contextual tooltip, pure CSS hover/focus reveal.
 *
 * No JS state, no re-renders; visibility is handled by group-hover /
 * focus-within. Positions: top (default), bottom, left, right.
 */

import type { ReactNode } from "react";

type Side = "top" | "bottom" | "left" | "right";

const SIDE_CLASSES: Record<Side, { host: string; tip: string }> = {
  top: {
    host: "bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom",
    tip: "top-full left-1/2 -translate-x-1/2 -mt-1",
  },
  bottom: {
    host: "top-full left-1/2 -translate-x-1/2 mt-2 origin-top",
    tip: "bottom-full left-1/2 -translate-x-1/2 -mb-1",
  },
  left: {
    host: "right-full top-1/2 -translate-y-1/2 mr-2 origin-right",
    tip: "left-full top-1/2 -translate-y-1/2 -ml-1",
  },
  right: {
    host: "left-full top-1/2 -translate-y-1/2 ml-2 origin-left",
    tip: "right-full top-1/2 -translate-y-1/2 -mr-1",
  },
};

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: Side;
  /** Render the trigger as a block-level wrapper instead of inline. */
  block?: boolean;
  className?: string;
}

export function Tooltip({ content, children, side = "top", block = false, className = "" }: Props) {
  const s = SIDE_CLASSES[side];
  return (
    <span
      className={`group/tt relative inline-flex ${block ? "flex" : ""} ${className}`}
      tabIndex={0}
    >
      {children}
      {/* Tooltip */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 ${s.host} whitespace-nowrap rounded-lg border border-steel-300 bg-white px-2.5 py-1.5 text-xs font-medium text-dusk-700 opacity-0 shadow-lg shadow-steel-500/15 backdrop-blur-xl transition-all duration-150 ease-out scale-95 translate-y-0.5 group-hover/tt:opacity-100 group-hover/tt:scale-100 group-hover/tt:translate-y-0 group-focus-within/tt:opacity-100 group-focus-within/tt:scale-100 group-focus-within/tt:translate-y-0`}
      >
        {content}
        {/* Arrow */}
        <span
          className={`absolute ${s.tip} h-1.5 w-1.5 rotate-45 border-steel-300 bg-white`}
          style={{
            clipPath:
              side === "top" ? "polygon(0 0, 100% 0, 100% 100%)" :
              side === "bottom" ? "polygon(0 100%, 100% 100%, 50% 0)" :
              side === "left" ? "polygon(0 0, 100% 100%, 0 100%)" :
              "polygon(100% 0, 100% 100%, 0 100%)",
          }}
        />
      </span>
    </span>
  );
}
