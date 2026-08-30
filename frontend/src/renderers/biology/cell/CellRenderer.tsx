/**
 * Cell Structure Renderer — interactive animal cell cross-section.
 *
 * SVG + Framer Motion for organelle animations and hover interactions.
 *
 * Features:
 * - Cell membrane boundary with phospholipid pattern
 * - Nucleus with nucleolus and chromatin
 * - Mitochondria (bean-shaped, with cristae)
 * - Endoplasmic Reticulum (rough & smooth)
 * - Golgi apparatus (stacked cisternae)
 * - Ribosomes (small dots along ER)
 * - Click organelle to highlight and show description
 * - Subtle organelle animations (drifting, pulsing)
 */

"use client";

import { useState } from "react";
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
  { id: "nucleus", name: "Nucleus", description: "Contains DNA and controls cell activities. The nucleolus inside produces ribosomes.", color: "#4338ca" },
  { id: "mitochondria", name: "Mitochondria", description: "The powerhouse of the cell. Produces ATP through cellular respiration.", color: "#dc2626" },
  { id: "er_rough", name: "Rough ER", description: "Studded with ribosomes. Synthesizes and processes proteins.", color: "#7c3aed" },
  { id: "er_smooth", name: "Smooth ER", description: "No ribosomes. Synthesizes lipids and detoxifies chemicals.", color: "#a855f7" },
  { id: "golgi", name: "Golgi Apparatus", description: "Packages and ships proteins. The cell's post office.", color: "#ca8a04" },
  { id: "ribosomes", name: "Ribosomes", description: "Tiny protein factories. Read mRNA and build amino acid chains.", color: "#0d9488" },
  { id: "membrane", name: "Cell Membrane", description: "Phospholipid bilayer that controls what enters and exits the cell.", color: "#e11d48" },
  { id: "cytoplasm", name: "Cytoplasm", description: "Jelly-like fluid that fills the cell and holds organelles in place.", color: "#1e293b" },
];

export default function CellRenderer({
  parameters,
  onUpdate,
}: RendererProps<CellParams>) {
  const showLabels = parameters.showLabels ?? true;
  const [selected, setSelected] = useState<string | null>(null);

  const selectedOrganelle = ORGANELLES.find((o) => o.id === selected);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Cell SVG */}
        <div className="flex-1 p-3">
          <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* Cytoplasm background */}
            <ellipse cx={300} cy={250} rx={260} ry={210} fill="#1a1f2e" />

            {/* Cell Membrane */}
            <motion.ellipse
              cx={300} cy={250} rx={260} ry={210}
              fill="none" stroke="#e11d48" strokeWidth={6}
              onClick={() => setSelected(selected === "membrane" ? null : "membrane")}
              animate={{
                strokeWidth: selected === "membrane" ? 10 : 6,
                strokeOpacity: selected === "membrane" ? 1 : 0.6,
              }}
              className="cursor-pointer"
            />
            {/* Membrane texture dots */}
            {Array.from({ length: 40 }, (_, i) => {
              const angle = (i / 40) * Math.PI * 2;
              const x = 300 + 260 * Math.cos(angle);
              const y = 250 + 210 * Math.sin(angle);
              return <circle key={`mem-${i}`} cx={x} cy={y} r={2.5} fill="#fb7185" opacity={0.4} />;
            })}

            {/* Rough ER (wavy lines near nucleus) */}
            <g
              onClick={() => setSelected(selected === "er_rough" ? null : "er_rough")}
              className="cursor-pointer"
            >
              <motion.g animate={{ opacity: selected === "er_rough" ? 1 : 0.6 }}>
                {[0, 1, 2, 3].map((i) => (
                  <path
                    key={`rer-${i}`}
                    d={`M ${170 + i * 5} ${180 + i * 20} Q ${200 + i * 5} ${170 + i * 20}, ${230 + i * 5} ${185 + i * 20} Q ${260 + i * 5} ${200 + i * 20}, ${250 + i * 5} ${210 + i * 20}`}
                    fill="none" stroke="#7c3aed" strokeWidth={3}
                  />
                ))}
                {/* Ribosomes on rough ER */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <circle key={`rib-${i}`}
                    cx={175 + i * 15 + Math.random() * 5}
                    cy={183 + i * 12 + Math.random() * 5}
                    r={2.5} fill="#0d9488"
                    onClick={(e) => { e.stopPropagation(); setSelected(selected === "ribosomes" ? null : "ribosomes"); }}
                  />
                ))}
              </motion.g>
            </g>

            {/* Smooth ER */}
            <g
              onClick={() => setSelected(selected === "er_smooth" ? null : "er_smooth")}
              className="cursor-pointer"
            >
              <motion.g animate={{ opacity: selected === "er_smooth" ? 1 : 0.5 }}>
                {[0, 1, 2].map((i) => (
                  <path
                    key={`ser-${i}`}
                    d={`M ${350} ${320 + i * 18} Q ${380} ${310 + i * 18}, ${410} ${325 + i * 18} Q ${440} ${340 + i * 18}, ${420} ${350 + i * 18}`}
                    fill="none" stroke="#a855f7" strokeWidth={2.5}
                  />
                ))}
              </motion.g>
            </g>

            {/* Nucleus */}
            <g
              onClick={() => setSelected(selected === "nucleus" ? null : "nucleus")}
              className="cursor-pointer"
            >
              <motion.ellipse
                cx={300} cy={250} rx={65} ry={55}
                animate={{
                  fill: selected === "nucleus" ? "#3730a3" : "#312e81",
                  strokeWidth: selected === "nucleus" ? 4 : 2.5,
                }}
                stroke="#6366f1"
              />
              {/* Nuclear envelope pores */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const x = 300 + 65 * Math.cos(angle);
                const y = 250 + 55 * Math.sin(angle);
                return <circle key={`pore-${i}`} cx={x} cy={y} r={2} fill="#818cf8" opacity={0.5} />;
              })}
              {/* Nucleolus */}
              <circle cx={310} cy={245} r={18} fill="#4338ca" stroke="#6366f1" strokeWidth={1} />
              {/* Chromatin */}
              <path d="M 270 240 Q 280 230, 290 240 Q 285 250, 275 245" fill="none" stroke="#a5b4fc" strokeWidth={1.5} opacity={0.5} />
              <path d="M 320 260 Q 330 255, 335 265 Q 325 270, 318 262" fill="none" stroke="#a5b4fc" strokeWidth={1.5} opacity={0.5} />
            </g>

            {/* Mitochondria (2 of them) */}
            {[
              { cx: 420, cy: 170, rx: 35, ry: 18, rot: -20 },
              { cx: 180, cy: 350, rx: 30, ry: 15, rot: 25 },
            ].map((m, idx) => (
              <motion.g
                key={`mito-${idx}`}
                onClick={() => setSelected(selected === "mitochondria" ? null : "mitochondria")}
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
              </motion.g>
            ))}

            {/* Golgi Apparatus */}
            <g
              onClick={() => setSelected(selected === "golgi" ? null : "golgi")}
              className="cursor-pointer"
            >
              <motion.g animate={{ opacity: selected === "golgi" ? 1 : 0.7 }}>
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
              </motion.g>
            </g>

            {/* Labels */}
            {showLabels && (
              <g>
                {/* Nucleus */}
                <line x1={300} y1={195} x2={300} y2={170} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <text x={300} y={165} textAnchor="middle" fill="#a5b4fc" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Nucleus</text>

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
                <text x={300} y={475} textAnchor="middle" fill="#fb7185" fontSize={10} fontWeight="bold" fontFamily="sans-serif">Cell Membrane</text>
              </g>
            )}
          </svg>
        </div>

        {/* Info Panel */}
        {selectedOrganelle && (
          <div className="flex w-56 flex-col border-l border-gray-700/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedOrganelle.color }} />
              <h4 className="text-sm font-bold text-white">{selectedOrganelle.name}</h4>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">{selectedOrganelle.description}</p>
            <button
              onClick={() => setSelected(null)}
              className="mt-3 rounded-lg bg-gray-700/50 px-2 py-1 text-xs text-gray-400 hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => onUpdate?.({ showLabels: !showLabels })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showLabels ? "bg-rose-600/60 text-rose-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Labels {showLabels ? "ON" : "OFF"}
        </button>
        <span className="text-xs text-gray-600">Click any organelle to learn about it</span>
      </div>
    </div>
  );
}
