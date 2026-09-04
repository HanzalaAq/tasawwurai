/**
 * AmbientBackground — the app's environmental depth layer.
 *
 * A fixed, GPU-friendly composition evoking a clear morning after
 * the storm:
 *   - soft sky-tinted ambient washes (azure / steel / mist)
 *   - a masked technical grid
 *   - slowly drifting morning clouds
 *   - rising motes — dust in the morning light (CSS keyframes)
 *   - a film-grain noise overlay
 *
 * Everything is pointer-transparent and aria-hidden.
 * Reduced-motion users get a static gradient (handled in globals.css).
 */

"use client";

import { useMemo } from "react";

/** Deterministic pseudo-random so SSR/CSR markup matches. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOTE_COUNT = 14;

export function AmbientBackground() {
  // Motes: precomputed positions/durations, rendered once per mount.
  const motes = useMemo(() => {
    const rand = mulberry32(42);
    return Array.from({ length: MOTE_COUNT }, () => {
      const size = 1.5 + rand() * 2.5;
      return {
        left: `${(rand() * 96 + 2).toFixed(2)}%`,
        size: `${size.toFixed(1)}px`,
        duration: `${(14 + rand() * 18).toFixed(1)}s`,
        delay: `${(-rand() * 28).toFixed(1)}s`,
        opacity: (0.12 + rand() * 0.22).toFixed(2),
        drift: `${((rand() - 0.5) * 6).toFixed(2)}vw`,
      };
    });
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash */}
      <div className="ambient-wash absolute inset-0" />

      {/* Technical grid, faded toward the edges */}
      <div className="bg-grid grid-fade absolute inset-0" />

      {/* Drifting morning clouds */}
      <div className="cloud-blob cloud-day-a h-[46vmax] w-[46vmax] -top-[14vmax] -left-[10vmax]" />
      <div className="cloud-blob cloud-day-b h-[40vmax] w-[40vmax] top-[-8vmax] -right-[12vmax]" />
      <div className="cloud-blob cloud-day-c h-[38vmax] w-[38vmax] -bottom-[16vmax] left-[28vmax]" />

      {/* Rising motes */}
      {motes.map((m, i) => (
        <span
          key={i}
          className="particle"
          style={
            {
              left: m.left,
              width: m.size,
              height: m.size,
              animationDuration: m.duration,
              animationDelay: m.delay,
              "--p-opacity": m.opacity,
              "--p-drift": m.drift,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Film grain */}
      <div className="noise-overlay absolute inset-0 opacity-[0.03] mix-blend-overlay" />

      {/* Soft steel vignette to focus the center workspace */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_40%,transparent_58%,rgba(106,137,167,0.10)_100%)]" />
    </div>
  );
}
