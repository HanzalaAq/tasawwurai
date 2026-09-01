/**
 * Cell Structure Renderer — interactive animal/plant cell cross-section.
 *
 * SVG + Framer Motion for organelle animations and interactions.
 *
 * Features:
 * - Animal / plant cell modes (cell wall, chloroplasts, central vacuole)
 * - Clickable organelles with instant descriptions
 * - Cytoplasmic streaming: particles circulating on elliptical lanes
 * - Protein pathway animation: nucleus → rough ER → Golgi → membrane
 * - Guided organelle tour with auto-advance
 * - ATP sparks near mitochondria, budding Golgi vesicles, drifting organelles
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface CellParams {
  showLabels: boolean;
  cellType: string;
}

interface Organelle {
  id: string;
  name: string;
  description: string;
  color: string;
}

const ORGANELLES: Organelle[] = [
  { id: "nucleus", name: "Nucleus", description: "Contains DNA and controls cell activities. mRNA copies of genes leave through nuclear pores, heading to ribosomes.", color: "#4338ca" },
  { id: "mitochondria", name: "Mitochondria", description: "The powerhouse of the cell. Produces ATP through cellular respiration — the energy currency used everywhere else.", color: "#dc2626" },
  { id: "er_rough", name: "Rough ER", description: "Studded with ribosomes. Ribosomes translate mRNA into proteins, which fold inside the ER's channels.", color: "#7c3aed" },
  { id: "er_smooth", name: "Smooth ER", description: "No ribosomes. Synthesizes lipids, stores calcium, and detoxifies chemicals.", color: "#a855f7" },
  { id: "golgi", name: "Golgi Apparatus", description: "Packages and ships proteins. Receives vesicles from the ER, modifies their cargo, and sends new vesicles onward — the cell's post office.", color: "#ca8a04" },
  { id: "ribosomes", name: "Ribosomes", description: "Tiny protein factories. Read mRNA and build amino acid chains (proteins) one codon at a time.", color: "#0d9488" },
  { id: "chloroplast", name: "Chloroplast", description: "Site of photosynthesis (plant cells only). Chlorophyll captures light energy to build sugar from CO₂ and water.", color: "#16a34a" },
  { id: "vacuole", name: "Central Vacuole", description: "Large storage sac (plant cells only). Holds water to keep the cell firm (turgor pressure) and stores nutrients and waste.", color: "#0ea5e9" },
  { id: "cell_wall", name: "Cell Wall", description: "Rigid outer layer of cellulose (plant cells only). Protects the cell and gives it its boxy shape.", color: "#22c55e" },
  { id: "membrane", name: "Cell Membrane", description: "Phospholipid bilayer that controls what enters and exits the cell. Secretory vesicles fuse with it to release proteins outside (exocytosis).", color: "#e11d48" },
  { id: "cytoplasm", name: "Cytoplasm", description: "Jelly-like fluid that fills the cell and holds organelles in place. Cytoplasmic streaming constantly circulates its contents.", color: "#1e293b" },
];

const CX = 300;
const CY = 250;
const RX = 260;
const RY = 210;

// Deterministic ribosome positions along the rough ER
const RIB_POS = [
  { x: 176, y: 186 }, { x: 191, y: 198 }, { x: 206, y: 190 },
  { x: 221, y: 208 }, { x: 236, y: 200 }, { x: 251, y: 216 },
];

// Cytoplasmic streaming: particles circulating on elliptical lanes
const STREAM = Array.from({ length: 14 }, (_, i) => {
  const rx = 95 + ((i * 61) % 130);
  const ry = 75 + ((i * 37) % 115);
  const dir = i % 2 === 0 ? 1 : -1;
  const dur = 13 + (i % 6) * 3.5;
  const size = 1.8 + (i % 3) * 0.7;
  const phase = (i * 1.3) % (Math.PI * 2);
  const pts = Array.from({ length: 9 }, (_, k) => {
    const a = phase + dir * ((k / 8) * Math.PI * 2);
    return { x: CX + rx * Math.cos(a), y: CY + ry * Math.sin(a) };
  });
  return { key: i, dur, size, pts, opacity: 0.15 + (i % 4) * 0.06 };
});

// Protein (secretory) pathway: nucleus → rough ER → Golgi → membrane
const PATH_D = "M 362 232 C 320 200, 285 192, 250 200 C 300 235, 390 245, 458 264 C 495 275, 520 300, 536 330";
const PATH_CX = [362, 320, 250, 300, 458, 520, 536];
const PATH_CY = [232, 205, 200, 240, 264, 300, 330];
const PATH_TIMES = [0, 0.15, 0.32, 0.5, 0.68, 0.85, 1];
const PATH_STEPS = [
  { x: 372, y: 222, n: 1, label: "DNA → mRNA" },
  { x: 250, y: 182, n: 2, label: "Protein made" },
  { x: 465, y: 248, n: 3, label: "Packaged" },
  { x: 536, y: 345, n: 4, label: "Secreted" },
];

const MITO_ANIMAL = [
  { cx: 420, cy: 170, rx: 35, ry: 18, rot: -20 },
  { cx: 180, cy: 350, rx: 30, ry: 15, rot: 25 },
];
const MITO_PLANT = [
  { cx: 430, cy: 160, rx: 32, ry: 16, rot: -15 },
  { cx: 118, cy: 238, rx: 26, ry: 13, rot: 35 },
];

const CHLOROPLASTS = [
  { cx: 140, cy: 140, rot: -20 },
  { cx: 95, cy: 320, rot: 10 },
  { cx: 465, cy: 395, rot: 15 },
];
const GRANA = [
  { dx: -12, dy: -3 }, { dx: -4, dy: 3 }, { dx: 4, dy: -3 }, { dx: 12, dy: 3 },
];

function tourOrder(isPlant: boolean): string[] {
  const base = ["nucleus", "ribosomes", "er_rough", "golgi", "mitochondria", "er_smooth"];
  const plantOnly = isPlant ? ["chloroplast", "vacuole", "cell_wall"] : [];
  return [...base, ...plantOnly, "membrane", "cytoplasm"];
}

export default function CellRenderer({
  parameters,
  onUpdate,
}: RendererProps<CellParams>) {
  const showLabels = parameters.showLabels ?? true;
  const cellType = (parameters.cellType ?? "animal").toLowerCase();
  const isPlant = cellType === "plant";
  const [selected, setSelected] = useState<string | null>(null);
  const [pathway, setPathway] = useState(false);
  const [tour, setTour] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);

  const order = useMemo(() => tourOrder(isPlant), [isPlant]);
  const selectedOrganelle = ORGANELLES.find((o) => o.id === selected);
  const mitos = isPlant ? MITO_PLANT : MITO_ANIMAL;

  // Manual selection stops any running tour
  const select = (id: string) => {
    setTour(false);
    setSelected(selected === id ? null : id);
  };

  // Tour auto-advance
  useEffect(() => {
    if (!tour) return;
    const t = setInterval(() => setTourIdx((i) => i + 1), 4500);
    return () => clearInterval(t);
  }, [tour]);

  // Tour highlights the current organelle
  useEffect(() => {
    if (!tour) return;
    setSelected(order[tourIdx % order.length]);
  }, [tour, tourIdx, order]);

  const startTour = () => {
    setTourIdx(0);
    setSelected(order[0]);
    setTour(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Cell SVG */}
        <div className="flex-1 p-3">
          <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* Cytoplasm background (clickable) */}
            <ellipse
              cx={CX} cy={CY} rx={RX} ry={RY} fill="#1a1f2e"
              onClick={() => select("cytoplasm")}
              className="cursor-pointer"
            />

            {/* Cytoplasmic streaming particles */}
            {STREAM.map((p) => (
              <motion.circle
                key={`stream-${p.key}`}
                r={p.size}
                fill="#94a3b8"
                opacity={p.opacity}
                style={{ pointerEvents: "none" }}
                animate={{ cx: p.pts.map((pt) => pt.x), cy: p.pts.map((pt) => pt.y) }}
                transition={{ duration: p.dur, repeat: Infinity, ease: "linear" }}
              />
            ))}

            {/* Plant cell wall (behind the membrane) */}
            {isPlant && (
              <g>
                <motion.ellipse
                  cx={CX} cy={CY} rx={278} ry={224}
                  fill="none" stroke="#16a34a"
                  animate={{
                    strokeWidth: selected === "cell_wall" ? 8 : 5,
                    strokeOpacity: selected === "cell_wall" ? 1 : 0.65,
                  }}
                  onClick={() => select("cell_wall")}
                  className="cursor-pointer"
                />
                <ellipse cx={CX} cy={CY} rx={271} ry={217} fill="none" stroke="#22c55e" strokeWidth={1} opacity={0.35} pointerEvents="none" />
              </g>
            )}

            {/* Cell Membrane */}
            <motion.ellipse
              cx={CX} cy={CY} rx={RX} ry={RY}
              fill="none" stroke="#e11d48" strokeWidth={6}
              onClick={() => select("membrane")}
              animate={{
                strokeWidth: selected === "membrane" ? 10 : 6,
                strokeOpacity: selected === "membrane" ? 1 : 0.6,
              }}
              className="cursor-pointer"
            />
            {/* Membrane texture dots */}
            {Array.from({ length: 40 }, (_, i) => {
              const angle = (i / 40) * Math.PI * 2;
              const x = CX + RX * Math.cos(angle);
              const y = CY + RY * Math.sin(angle);
              return <circle key={`mem-${i}`} cx={x} cy={y} r={2.5} fill="#fb7185" opacity={0.4} pointerEvents="none" />;
            })}

            {/* Rough ER (wavy lines near nucleus) */}
            <g onClick={() => select("er_rough")} className="cursor-pointer">
              <motion.g animate={{ opacity: selected === "er_rough" ? 1 : pathway ? 0.9 : 0.6 }}>
                {[0, 1, 2, 3].map((i) => (
                  <path
                    key={`rer-${i}`}
                    d={`M ${170 + i * 5} ${180 + i * 20} Q ${200 + i * 5} ${170 + i * 20}, ${230 + i * 5} ${185 + i * 20} Q ${260 + i * 5} ${200 + i * 20}, ${250 + i * 5} ${210 + i * 20}`}
                    fill="none" stroke="#7c3aed" strokeWidth={3}
                  />
                ))}
                {/* Ribosomes on rough ER */}
                {RIB_POS.map((r, i) => (
                  <circle key={`rib-${i}`} cx={r.x} cy={r.y} r={2.5} fill="#0d9488"
                    onClick={(e) => { e.stopPropagation(); select("ribosomes"); }}
                    className="cursor-pointer"
                  />
                ))}
              </motion.g>
            </g>

            {/* Smooth ER */}
            <g onClick={() => select("er_smooth")} className="cursor-pointer">
              <motion.g animate={{ opacity: selected === "er_smooth" ? 1 : pathway ? 0.25 : 0.5 }}>
                {[0, 1, 2].map((i) => (
                  <path
                    key={`ser-${i}`}
                    d={`M ${350} ${320 + i * 18} Q ${380} ${310 + i * 18}, ${410} ${325 + i * 18} Q ${440} ${340 + i * 18}, ${420} ${350 + i * 18}`}
                    fill="none" stroke="#a855f7" strokeWidth={2.5}
                  />
                ))}
              </motion.g>
            </g>

            {/* Central vacuole (plant only) */}
            {isPlant && (
              <motion.ellipse
                cx={245} cy={385} rx={80} ry={55}
                fill="#0ea5e9"
                stroke="#38bdf8"
                strokeDasharray="6 5"
                onClick={() => select("vacuole")}
                className="cursor-pointer"
                animate={{
                  fillOpacity: [0.10, 0.18, 0.10],
                  opacity: pathway ? 0.35 : 1,
                  strokeWidth: selected === "vacuole" ? 2.5 : 1.5,
                }}
                transition={{ fillOpacity: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
              />
            )}

            {/* Nucleus */}
            <g onClick={() => select("nucleus")} className="cursor-pointer">
              <motion.ellipse
                cx={CX} cy={CY} rx={65} ry={55}
                animate={{
                  fill: selected === "nucleus" ? "#3730a3" : "#312e81",
                  strokeWidth: selected === "nucleus" ? 4 : 2.5,
                }}
                stroke="#6366f1"
              />
              {/* Nuclear envelope pores */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const x = CX + 65 * Math.cos(angle);
                const y = CY + 55 * Math.sin(angle);
                return <circle key={`pore-${i}`} cx={x} cy={y} r={2} fill="#818cf8" opacity={0.5} />;
              })}
              {/* Nucleolus */}
              <circle cx={310} cy={245} r={18} fill="#4338ca" stroke="#6366f1" strokeWidth={1} />
              {/* Chromatin */}
              <path d="M 270 240 Q 280 230, 290 240 Q 285 250, 275 245" fill="none" stroke="#a5b4fc" strokeWidth={1.5} opacity={0.5} />
              <path d="M 320 260 Q 330 255, 335 265 Q 325 270, 318 262" fill="none" stroke="#a5b4fc" strokeWidth={1.5} opacity={0.5} />
            </g>

            {/* Mitochondria (2 of them) */}
            {mitos.map((m, idx) => (
              <motion.g
                key={`mito-${idx}`}
                onClick={() => select("mitochondria")}
                className="cursor-pointer"
                animate={{
                  y: [0, -3, 0, 3, 0],
                  rotate: [m.rot, m.rot + 2, m.rot, m.rot - 2, m.rot],
                }}
                transition={{ repeat: Infinity, duration: 6 + idx * 2, ease: "easeInOut" }}
                style={{ transformOrigin: `${m.cx}px ${m.cy}px` }}
              >
                <motion.ellipse
                  cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry}
                  animate={{
                    fill: selected === "mitochondria" ? "#991b1b" : "#7f1d1d",
                    strokeWidth: selected === "mitochondria" ? 3 : 2,
                  }}
                  stroke="#ef4444"
                  transform={`rotate(${m.rot} ${m.cx} ${m.cy})`}
                />
                {/* Cristae (inner folds) */}
                {[-0.5, 0, 0.5].map((offset) => (
                  <line
                    key={offset}
                    x1={m.cx - m.rx * 0.5} y1={m.cy + offset * m.ry * 0.6}
                    x2={m.cx + m.rx * 0.3} y2={m.cy + offset * m.ry * 0.6}
                    stroke="#fca5a5" strokeWidth={1} opacity={0.4}
                    transform={`rotate(${m.rot} ${m.cx} ${m.cy})`}
                  />
                ))}
                {/* ATP sparks */}
                {[0, 1].map((k) => (
                  <motion.circle
                    key={`atp-${idx}-${k}`}
                    cx={m.cx + (k === 0 ? -10 : 12)}
                    cy={m.cy + (k === 0 ? -13 : 11)}
                    r={2}
                    fill="#fde047"
                    animate={{ opacity: [0.15, 0.9, 0.15] }}
                    transition={{ duration: 1.8 + idx * 0.3 + k * 0.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
              </motion.g>
            ))}

            {/* Chloroplasts (plant only) */}
            {isPlant && CHLOROPLASTS.map((c, idx) => (
              <motion.g
                key={`chloro-${idx}`}
                onClick={() => select("chloroplast")}
                className="cursor-pointer"
                animate={{ rotate: [c.rot, c.rot + 3, c.rot], opacity: pathway ? 0.35 : 1 }}
                transition={{ rotate: { duration: 8 + idx * 2, repeat: Infinity, ease: "easeInOut" } }}
                style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}
              >
                <ellipse
                  cx={c.cx} cy={c.cy} rx={26} ry={13}
                  fill={selected === "chloroplast" ? "#166534" : "#14532d"} stroke="#22c55e"
                  strokeWidth={selected === "chloroplast" ? 2.5 : 1.5}
                />
                {/* Grana stacks */}
                {GRANA.map((g, k) => (
                  <circle key={k} cx={c.cx + g.dx} cy={c.cy + g.dy} r={2.5} fill="#4ade80" opacity={0.7} />
                ))}
              </motion.g>
            ))}

            {/* Golgi Apparatus */}
            <g onClick={() => select("golgi")} className="cursor-pointer">
              <motion.g animate={{ opacity: selected === "golgi" ? 1 : pathway ? 0.9 : 0.7 }}>
                {[0, 1, 2, 3].map((i) => (
                  <path
                    key={`golgi-${i}`}
                    d={`M ${430 + i * 3} ${240 + i * 12} Q ${460 + i * 3} ${235 + i * 12}, ${490 + i * 3} ${240 + i * 12}`}
                    fill="none"
                    stroke="#ca8a04"
                    strokeWidth={4 - i * 0.5}
                    strokeLinecap="round"
                  />
                ))}
                {/* Vesicles budding off */}
                <motion.circle
                  cx={495} cy={250} r={5}
                  fill="#eab308"
                  animate={{ cx: [495, 510, 520], cy: [250, 245, 240], opacity: [0.8, 0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeOut" }}
                />
                <motion.circle
                  cx={488} cy={278} r={4}
                  fill="#eab308"
                  animate={{ cx: [488, 505, 516], cy: [278, 290, 300], opacity: [0.8, 0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 3.6, ease: "easeOut", delay: 1.2 }}
                />
              </motion.g>
            </g>

            {/* Protein pathway animation */}
            {pathway && (
              <g style={{ pointerEvents: "none" }}>
                {/* Flowing guide line */}
                <motion.path
                  d={PATH_D}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  strokeDasharray="7 9"
                  opacity={0.55}
                  animate={{ strokeDashoffset: [0, -32] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                />
                {/* Step badges */}
                {PATH_STEPS.map((s) => (
                  <g key={`step-${s.n}`}>
                    <circle cx={s.x} cy={s.y} r={10} fill="#134e4a" stroke="#2dd4bf" strokeWidth={1.5} />
                    <text x={s.x} y={s.y + 3.5} textAnchor="middle" fill="#99f6e4" fontSize={10} fontWeight="bold" fontFamily="sans-serif">{s.n}</text>
                    <text x={s.x} y={s.y - 16} textAnchor="middle" fill="#5eead4" fontSize={8.5} fontFamily="sans-serif">{s.label}</text>
                  </g>
                ))}
                {/* Travelling protein particles */}
                {[0, 1, 2, 3].map((i) => (
                  <motion.circle
                    key={`prot-${i}`}
                    r={4.5}
                    fill="#2dd4bf"
                    stroke="#99f6e4"
                    strokeWidth={1}
                    animate={{
                      cx: PATH_CX,
                      cy: PATH_CY,
                      opacity: [0, 1, 1, 1, 1, 0.9, 0],
                    }}
                    transition={{ duration: 10, times: PATH_TIMES, repeat: Infinity, delay: i * 2.5, ease: "easeInOut" }}
                  />
                ))}
                {/* Exocytosis flash at the membrane */}
                <motion.circle
                  cx={536} cy={330}
                  fill="none" stroke="#5eead4" strokeWidth={1.5}
                  animate={{ r: [4, 18], opacity: [0.8, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
              </g>
            )}

            {/* Labels */}
            {showLabels && (
              <g pointerEvents="none">
                {/* Nucleus */}
                <line x1={CX} y1={195} x2={CX} y2={170} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <text x={CX} y={165} textAnchor="middle" fill="#a5b4fc" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Nucleus</text>

                {/* Mitochondria */}
                <line x1={420} y1={152} x2={420} y2={130} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <text x={420} y={125} textAnchor="middle" fill="#fca5a5" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Mitochondria</text>

                {/* Golgi */}
                <line x1={460} y1={235} x2={460} y2={215} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <text x={460} y={210} textAnchor="middle" fill="#fbbf24" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Golgi</text>

                {/* Rough ER */}
                <text x={155} y={175} fill="#a78bfa" fontSize={9} fontWeight="bold" fontFamily="sans-serif">Rough ER</text>

                {/* Smooth ER */}
                <text x={370} y={315} fill="#c084fc" fontSize={9} fontWeight="bold" fontFamily="sans-serif">Smooth ER</text>

                {/* Membrane */}
                <text x={CX} y={475} textAnchor="middle" fill="#fb7185" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Cell Membrane</text>
              </g>
            )}

            {/* Plant-only labels */}
            {showLabels && isPlant && (
              <g pointerEvents="none">
                <text x={140} y={112} textAnchor="middle" fill="#4ade80" fontSize={9} fontWeight="bold" fontFamily="sans-serif">Chloroplast</text>
                <text x={245} y={388} textAnchor="middle" fill="#7dd3fc" fontSize={9} fontWeight="bold" fontFamily="sans-serif">Vacuole</text>
                <text x={CX} y={494} textAnchor="middle" fill="#4ade80" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Cell Wall</text>
              </g>
            )}
          </svg>
        </div>

        {/* Info Panel */}
        {selectedOrganelle && (
          <div className="flex w-56 flex-col border-l border-gray-700/50 p-4">
            {tour && (
              <div className="mb-2 flex items-center justify-between rounded-md bg-violet-600/20 px-2 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                  Tour {(tourIdx % order.length) + 1}/{order.length}
                </span>
                <button onClick={() => setTour(false)} className="text-[10px] font-medium text-violet-300 hover:text-white">
                  Stop
                </button>
              </div>
            )}
            <div className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedOrganelle.color }} />
              <h4 className="text-sm font-bold text-white">{selectedOrganelle.name}</h4>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">{selectedOrganelle.description}</p>
            <button
              onClick={() => { setTour(false); setSelected(null); }}
              className="mt-3 rounded-lg bg-gray-700/50 px-2 py-1 text-xs text-gray-400 hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => onUpdate?.({ showLabels: !showLabels })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showLabels ? "bg-rose-600/60 text-rose-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Labels {showLabels ? "ON" : "OFF"}
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {/* Cell type toggle */}
        <div className="flex overflow-hidden rounded-lg">
          <button
            onClick={() => onUpdate?.({ cellType: "animal" })}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isPlant ? "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50" : "bg-emerald-600/60 text-emerald-200"
            }`}
          >
            Animal
          </button>
          <button
            onClick={() => onUpdate?.({ cellType: "plant" })}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isPlant ? "bg-emerald-600/60 text-emerald-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            Plant
          </button>
        </div>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <button
          onClick={() => setPathway(!pathway)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            pathway ? "bg-teal-600/60 text-teal-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Protein Pathway {pathway ? "ON" : "OFF"}
        </button>

        <button
          onClick={() => (tour ? setTour(false) : startTour())}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            tour ? "bg-violet-600/60 text-violet-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          {tour ? "Stop Tour" : "Guided Tour"}
        </button>

        <span className="text-xs text-gray-600">Click any organelle to learn about it</span>
      </div>
    </div>
  );
}
