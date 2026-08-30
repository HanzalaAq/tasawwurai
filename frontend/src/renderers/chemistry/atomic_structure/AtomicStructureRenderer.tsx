/**
 * Atomic Structure Renderer — Bohr model with animated electron orbits.
 *
 * SVG + Framer Motion for orbiting electrons and shell transitions.
 *
 * Features:
 * - Nucleus with protons (red) and neutrons (blue)
 * - Electron shells (K, L, M) with animated orbiting electrons
 * - Element presets with correct electron configurations
 * - Shell labels and electron count
 * - Electron transition animation (excitation / de-excitation)
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface AtomParams {
  element: string;
  showLabels: boolean;
}

// Element presets: [protons, neutrons, electrons per shell]
const ELEMENTS: Record<string, { name: string; symbol: string; protons: number; neutrons: number; shells: number[] }> = {
  hydrogen: { name: "Hydrogen", symbol: "H", protons: 1, neutrons: 0, shells: [1] },
  helium: { name: "Helium", symbol: "He", protons: 2, neutrons: 2, shells: [2] },
  carbon: { name: "Carbon", symbol: "C", protons: 6, neutrons: 6, shells: [2, 4] },
  oxygen: { name: "Oxygen", symbol: "O", protons: 8, neutrons: 8, shells: [2, 6] },
  neon: { name: "Neon", symbol: "Ne", protons: 10, neutrons: 10, shells: [2, 8] },
  sodium: { name: "Sodium", symbol: "Na", protons: 11, neutrons: 12, shells: [2, 8, 1] },
  iron: { name: "Iron", symbol: "Fe", protons: 26, neutrons: 30, shells: [2, 8, 14, 2] },
};

const SHELL_NAMES = ["K", "L", "M", "N"];
const SHELL_RADII = [70, 120, 170, 220];
const CX = 300;
const CY = 250;

export default function AtomicStructureRenderer({
  parameters,
  onUpdate,
}: RendererProps<AtomParams>) {
  const element = parameters.element ?? "carbon";
  const showLabels = parameters.showLabels ?? true;
  const el = ELEMENTS[element] || ELEMENTS.carbon;

  // Electron transition state
  const [excited, setExcited] = useState(false);
  const exciteRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleExcite = () => {
    setExcited(true);
    clearTimeout(exciteRef.current);
    exciteRef.current = setTimeout(() => setExcited(false), 2000);
  };

  useEffect(() => () => clearTimeout(exciteRef.current), []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 p-2">
        <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Shell orbits */}
          {el.shells.map((_, i) => (
            <g key={`shell-${i}`}>
              <motion.circle
                cx={CX} cy={CY} r={SHELL_RADII[i]}
                fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1}
                strokeDasharray="4 4"
              />
              {showLabels && (
                <text x={CX + SHELL_RADII[i] + 5} y={CY - 5}
                  fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace">
                  {SHELL_NAMES[i]} ({el.shells[i]}e⁻)
                </text>
              )}
            </g>
          ))}

          {/* Electrons on each shell */}
          {el.shells.map((count, shellIdx) => {
            const radius = SHELL_RADII[shellIdx];
            const speed = 8 + shellIdx * 3; // outer shells orbit slower
            const excitedRadius = excited && shellIdx === el.shells.length - 1
              ? SHELL_RADII[Math.min(shellIdx + 1, SHELL_RADII.length - 1)]
              : radius;

            return Array.from({ length: count }, (_, eIdx) => {
              const baseAngle = (eIdx / count) * Math.PI * 2;
              return (
                <motion.circle
                  key={`e-${shellIdx}-${eIdx}`}
                  r={5}
                  fill="#fbbf24"
                  stroke="#fde68a"
                  strokeWidth={1}
                  animate={{
                    cx: [
                      CX + excitedRadius * Math.cos(baseAngle),
                      CX + excitedRadius * Math.cos(baseAngle + Math.PI),
                      CX + excitedRadius * Math.cos(baseAngle + Math.PI * 2),
                    ],
                    cy: [
                      CY + excitedRadius * Math.sin(baseAngle),
                      CY + excitedRadius * Math.sin(baseAngle + Math.PI),
                      CY + excitedRadius * Math.sin(baseAngle + Math.PI * 2),
                    ],
                  }}
                  transition={{
                    duration: speed,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              );
            });
          })}

          {/* Nucleus */}
          <circle cx={CX} cy={CY} r={25} fill="#1e1b4b" stroke="#4338ca" strokeWidth={2} />

          {/* Protons and neutrons in nucleus */}
          {Array.from({ length: Math.min(el.protons, 8) }, (_, i) => {
            const angle = (i / Math.min(el.protons, 8)) * Math.PI * 2;
            const r = el.protons <= 2 ? 6 : 12;
            return (
              <circle key={`p-${i}`}
                cx={CX + r * Math.cos(angle)}
                cy={CY + r * Math.sin(angle)}
                r={5} fill="#ef4444" stroke="#fca5a5" strokeWidth={0.5}
              />
            );
          })}
          {Array.from({ length: Math.min(el.neutrons, 8) }, (_, i) => {
            const angle = ((i + 0.5) / Math.min(el.neutrons, 8)) * Math.PI * 2;
            const r = el.neutrons <= 2 ? 6 : 14;
            return (
              <circle key={`n-${i}`}
                cx={CX + r * Math.cos(angle)}
                cy={CY + r * Math.sin(angle)}
                r={5} fill="#3b82f6" stroke="#93c5fd" strokeWidth={0.5}
              />
            );
          })}

          {/* Element symbol */}
          <text x={CX} y={CY + 5} textAnchor="middle" fill="white"
            fontSize={18} fontWeight="bold" fontFamily="monospace">
            {el.symbol}
          </text>

          {/* Excitation indicator */}
          {excited && (
            <motion.g>
              <motion.circle
                cx={CX} cy={CY - SHELL_RADII[el.shells.length - 1] - 20}
                r={8} fill="#fbbf24"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              />
              <text x={CX + 15} y={CY - SHELL_RADII[el.shells.length - 1] - 15}
                fill="#fbbf24" fontSize={9} fontFamily="monospace">
                photon absorbed
              </text>
            </motion.g>
          )}

          {/* Legend */}
          <g>
            <circle cx={30} cy={470} r={5} fill="#ef4444" />
            <text x={40} y={474} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Proton (p⁺)</text>
            <circle cx={120} cy={470} r={5} fill="#3b82f6" />
            <text x={130} y={474} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Neutron (n⁰)</text>
            <circle cx={220} cy={470} r={5} fill="#fbbf24" />
            <text x={230} y={474} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Electron (e⁻)</text>
          </g>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-indigo-400">{el.name} ({el.symbol})</span>
        <span className="text-red-400">Protons: {el.protons}</span>
        <span className="text-blue-400">Neutrons: {el.neutrons}</span>
        <span className="text-yellow-400">Electrons: {el.shells.reduce((a, b) => a + b, 0)}</span>
        <span className="text-gray-400">Shells: {el.shells.map((s, i) => `${SHELL_NAMES[i]}:${s}`).join(" ")}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={handleExcite}
          disabled={excited}
          className="rounded-lg bg-yellow-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-500 disabled:opacity-40"
        >
          ⚡ Excite Electron
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <button
          onClick={() => onUpdate?.({ showLabels: !showLabels })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showLabels ? "bg-indigo-600/60 text-indigo-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Labels {showLabels ? "ON" : "OFF"}
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {Object.keys(ELEMENTS).map((key) => (
          <button
            key={key}
            onClick={() => onUpdate?.({ element: key })}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
              element === key
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {ELEMENTS[key].symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
