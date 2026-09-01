/**
 * Atomic Structure Renderer — Bohr model with animated electron orbits.
 *
 * SVG + Framer Motion for orbiting electrons and shell transitions.
 *
 * Features:
 * - 24 element presets with correct shell configurations (K–P shells)
 * - Nucleus with protons (red) and neutrons (blue), scaled to element
 * - Electron shells with animated orbiting electrons + speed control
 * - Electron excitation: photon absorbed → electron jumps outward,
 *   then falls back and emits a photon (E = hf) that flies away
 * - Element picker (dropdown + quick buttons) and shell labels
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
  lithium: { name: "Lithium", symbol: "Li", protons: 3, neutrons: 4, shells: [2, 1] },
  beryllium: { name: "Beryllium", symbol: "Be", protons: 4, neutrons: 5, shells: [2, 2] },
  boron: { name: "Boron", symbol: "B", protons: 5, neutrons: 6, shells: [2, 3] },
  carbon: { name: "Carbon", symbol: "C", protons: 6, neutrons: 6, shells: [2, 4] },
  nitrogen: { name: "Nitrogen", symbol: "N", protons: 7, neutrons: 7, shells: [2, 5] },
  oxygen: { name: "Oxygen", symbol: "O", protons: 8, neutrons: 8, shells: [2, 6] },
  fluorine: { name: "Fluorine", symbol: "F", protons: 9, neutrons: 10, shells: [2, 7] },
  neon: { name: "Neon", symbol: "Ne", protons: 10, neutrons: 10, shells: [2, 8] },
  sodium: { name: "Sodium", symbol: "Na", protons: 11, neutrons: 12, shells: [2, 8, 1] },
  magnesium: { name: "Magnesium", symbol: "Mg", protons: 12, neutrons: 12, shells: [2, 8, 2] },
  aluminum: { name: "Aluminum", symbol: "Al", protons: 13, neutrons: 14, shells: [2, 8, 3] },
  silicon: { name: "Silicon", symbol: "Si", protons: 14, neutrons: 14, shells: [2, 8, 4] },
  phosphorus: { name: "Phosphorus", symbol: "P", protons: 15, neutrons: 16, shells: [2, 8, 5] },
  sulfur: { name: "Sulfur", symbol: "S", protons: 16, neutrons: 16, shells: [2, 8, 6] },
  chlorine: { name: "Chlorine", symbol: "Cl", protons: 17, neutrons: 18, shells: [2, 8, 7] },
  argon: { name: "Argon", symbol: "Ar", protons: 18, neutrons: 22, shells: [2, 8, 8] },
  potassium: { name: "Potassium", symbol: "K", protons: 19, neutrons: 20, shells: [2, 8, 8, 1] },
  calcium: { name: "Calcium", symbol: "Ca", protons: 20, neutrons: 20, shells: [2, 8, 8, 2] },
  iron: { name: "Iron", symbol: "Fe", protons: 26, neutrons: 30, shells: [2, 8, 14, 2] },
  copper: { name: "Copper", symbol: "Cu", protons: 29, neutrons: 35, shells: [2, 8, 18, 1] },
  zinc: { name: "Zinc", symbol: "Zn", protons: 30, neutrons: 35, shells: [2, 8, 18, 2] },
  silver: { name: "Silver", symbol: "Ag", protons: 47, neutrons: 61, shells: [2, 8, 18, 18, 1] },
  gold: { name: "Gold", symbol: "Au", protons: 79, neutrons: 118, shells: [2, 8, 18, 32, 18, 1] },
};

// Spelling variants accepted from speech/text input
const ALIASES: Record<string, string> = {
  aluminium: "aluminum",
  sulphur: "sulfur",
};

const QUICK_ELEMENTS = ["hydrogen", "helium", "carbon", "nitrogen", "oxygen", "neon", "sodium", "iron"];
const SHELL_NAMES = ["K", "L", "M", "N", "O", "P"];
// Orbit radii per shell count (index = shell)
const SHELL_RADII: Record<number, number[]> = {
  1: [85],
  2: [62, 150],
  3: [55, 118, 185],
  4: [52, 108, 165, 222],
  5: [50, 95, 140, 182, 224],
  6: [48, 84, 120, 156, 190, 224],
};
const SPEEDS = [0.5, 1, 2, 3];
const CX = 300;
const CY = 245;

interface Photon {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export default function AtomicStructureRenderer({
  parameters,
  onUpdate,
}: RendererProps<AtomParams>) {
  const rawElement = (parameters.element ?? "carbon").toLowerCase();
  const element = ELEMENTS[rawElement] ? rawElement : (ALIASES[rawElement] ?? "carbon");
  const showLabels = parameters.showLabels ?? true;
  const el = ELEMENTS[element];

  const [excited, setExcited] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [photons, setPhotons] = useState<Photon[]>([]);
  const exciteRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const photonId = useRef(0);

  const shellCount = el.shells.length;
  const radii = SHELL_RADII[Math.min(shellCount, 6)];
  const outerR = radii[radii.length - 1];
  const excitedR = Math.min(outerR + 28, 238);

  // Reset transitions when the element changes
  useEffect(() => {
    clearTimeout(exciteRef.current);
    setExcited(false);
    setPhotons([]);
  }, [element]);

  useEffect(() => () => clearTimeout(exciteRef.current), []);

  const handleExcite = () => {
    if (excited) return;
    setExcited(true);
    clearTimeout(exciteRef.current);
    exciteRef.current = setTimeout(() => {
      setExcited(false);
      // De-excitation: the electron falls back and a photon is emitted
      const angle = (photonId.current * 2.4 + 0.7) % (Math.PI * 2);
      setPhotons((ps) => [
        ...ps.slice(-4),
        {
          id: photonId.current++,
          x: CX + excitedR * Math.cos(angle),
          y: CY + excitedR * Math.sin(angle),
          dx: Math.cos(angle),
          dy: Math.sin(angle),
        },
      ]);
    }, 2600);
  };

  // Nucleus scales with nucleon count; pack up to 12 protons / 12 neutrons
  const nucleusR = 20 + Math.min(15, Math.round(Math.sqrt(el.protons) * 1.5));
  const pShown = Math.min(el.protons, 12);
  const nShown = Math.min(el.neutrons, 12);
  const nucleonRing = (count: number, radius: number, phase: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = ((i + phase) / count) * Math.PI * 2;
      return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
    });
  const packNucleons = (count: number, phase: number) => {
    if (count <= 0) return [];
    if (count === 1) return [{ x: CX, y: CY }];
    const inner = Math.min(4, Math.ceil(count / 2));
    const outer = count - inner;
    return [...nucleonRing(inner, nucleusR * 0.32, phase), ...(outer > 0 ? nucleonRing(outer, nucleusR * 0.68, phase) : [])];
  };
  const protons = packNucleons(pShown, 0);
  const neutrons = packNucleons(nShown, 0.35);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 p-2">
        <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Shell orbits */}
          {el.shells.map((_, i) => (
            <g key={`shell-${i}`}>
              <motion.circle
                cx={CX} cy={CY} r={radii[i]}
                fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1}
                strokeDasharray="4 4"
              />
              {showLabels && (
                <text x={CX + radii[i] + 5} y={CY - 5}
                  fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="monospace">
                  {SHELL_NAMES[i]} ({el.shells[i]}e⁻)
                </text>
              )}
            </g>
          ))}

          {/* Excited (virtual) orbit */}
          {excited && (
            <circle cx={CX} cy={CY} r={excitedR}
              fill="none" stroke="rgba(251,191,36,0.35)" strokeWidth={1} strokeDasharray="2 6" />
          )}

          {/* Electrons on each shell */}
          {el.shells.map((count, shellIdx) => {
            const baseR = radii[shellIdx];
            const r = excited && shellIdx === shellCount - 1 ? excitedR : baseR;
            const duration = (8 + shellIdx * 3) / speed; // outer shells orbit slower
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
                      CX + r * Math.cos(baseAngle),
                      CX + r * Math.cos(baseAngle + Math.PI),
                      CX + r * Math.cos(baseAngle + Math.PI * 2),
                    ],
                    cy: [
                      CY + r * Math.sin(baseAngle),
                      CY + r * Math.sin(baseAngle + Math.PI),
                      CY + r * Math.sin(baseAngle + Math.PI * 2),
                    ],
                  }}
                  transition={{
                    duration,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              );
            });
          })}

          {/* Emitted photons flying away from the atom */}
          {photons.map((p) => (
            <motion.g key={`ph-${p.id}`}>
              <motion.circle
                r={4}
                fill="#fde047"
                initial={{ cx: p.x, cy: p.y, opacity: 1 }}
                animate={{ cx: p.x + p.dx * 280, cy: p.y + p.dy * 280, opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                onAnimationComplete={() => setPhotons((ps) => ps.filter((q) => q.id !== p.id))}
              />
              <motion.circle
                r={4}
                fill="none" stroke="#fde047" strokeWidth={1.2}
                initial={{ cx: p.x, cy: p.y, opacity: 0.9, r: 4 }}
                animate={{ cx: p.x + p.dx * 280, cy: p.y + p.dy * 280, opacity: 0, r: 15 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <motion.text
                x={p.x + 10} y={p.y - 8}
                fill="#fde047" fontSize={9} fontFamily="monospace"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 1.5 }}
              >
                photon E=hf
              </motion.text>
            </motion.g>
          ))}

          {/* Nucleus */}
          <circle cx={CX} cy={CY} r={nucleusR} fill="#1e1b4b" stroke="#4338ca" strokeWidth={2} />

          {/* Protons and neutrons in nucleus */}
          {protons.map((p, i) => (
            <circle key={`p-${i}`} cx={p.x} cy={p.y} r={4.5}
              fill="#ef4444" stroke="#fca5a5" strokeWidth={0.5} />
          ))}
          {neutrons.map((p, i) => (
            <circle key={`n-${i}`} cx={p.x} cy={p.y} r={4.5}
              fill="#3b82f6" stroke="#93c5fd" strokeWidth={0.5} />
          ))}

          {/* Element symbol */}
          <text x={CX} y={CY + 5} textAnchor="middle" fill="white"
            fontSize={18} fontWeight="bold" fontFamily="monospace">
            {el.symbol}
          </text>

          {/* Excitation indicator */}
          {excited && (
            <motion.g>
              <motion.circle
                cx={CX} cy={CY - outerR - 22}
                fill="#fbbf24"
                animate={{ opacity: [1, 0.3, 1], r: [7, 10, 7] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              />
              <text x={CX + 14} y={CY - outerR - 18}
                fill="#fbbf24" fontSize={9} fontFamily="monospace">
                photon absorbed — electron excited
              </text>
            </motion.g>
          )}

          {/* Legend */}
          <g>
            <circle cx={30} cy={486} r={5} fill="#ef4444" />
            <text x={40} y={490} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Proton (p⁺)</text>
            <circle cx={120} cy={486} r={5} fill="#3b82f6" />
            <text x={130} y={490} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Neutron (n⁰)</text>
            <circle cx={220} cy={486} r={5} fill="#fbbf24" />
            <text x={230} y={490} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Electron (e⁻)</text>
            <circle cx={320} cy={486} r={5} fill="#fde047" />
            <text x={330} y={490} fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="sans-serif">Photon</text>
          </g>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-indigo-400">{el.name} ({el.symbol})</span>
        <span className="text-red-400">Protons: {el.protons}</span>
        <span className="text-blue-400">Neutrons: {el.neutrons}</span>
        <span className="text-yellow-400">Electrons: {el.shells.reduce((a, b) => a + b, 0)}</span>
        <span className="text-emerald-400">Valence: {el.shells[shellCount - 1]}</span>
        <span className="text-gray-400">Shells: {el.shells.map((s, i) => `${SHELL_NAMES[i]}:${s}`).join(" ")}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={handleExcite}
          disabled={excited}
          className="rounded-lg bg-yellow-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-500 disabled:opacity-40"
        >
          {excited ? "Electron excited…" : "⚡ Excite Electron"}
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {/* Speed control */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                speed === s ? "bg-yellow-600/60 text-yellow-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

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

        {/* Quick element buttons */}
        {QUICK_ELEMENTS.map((key) => (
          <button
            key={key}
            onClick={() => onUpdate?.({ element: key })}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
              element === key
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {ELEMENTS[key].symbol}
          </button>
        ))}

        {/* Full element picker */}
        <select
          value={element}
          onChange={(e) => onUpdate?.({ element: e.target.value })}
          className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200"
          aria-label="Select element"
        >
          {Object.keys(ELEMENTS).map((key) => (
            <option key={key} value={key}>{ELEMENTS[key].name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
