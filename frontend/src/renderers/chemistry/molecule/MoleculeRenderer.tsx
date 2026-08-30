/**
 * Molecule Renderer — ball-and-stick molecular models with animated bonds.
 *
 * SVG + Framer Motion for atom positioning and bond formation animations.
 *
 * Features:
 * - Molecule presets: water (H2O), carbon dioxide (CO2), methane (CH4), ammonia (NH3), NaCl
 * - Ball-and-stick representation with colored atom spheres
 * - Bond lines with angle annotations
 * - Bond type indicators (single, double, ionic)
 * - Animated bond formation on molecule switch
 * - Bond angle display
 */

"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface MoleculeParams {
  molecule: string;
  showAngles: boolean;
  showLabels: boolean;
}

interface Atom {
  id: string;
  element: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  label: string;
}

interface Bond {
  from: string;
  to: string;
  type: "single" | "double" | "ionic";
}

interface MoleculeData {
  name: string;
  formula: string;
  atoms: Atom[];
  bonds: Bond[];
  angles: { a: string; center: string; b: string; value: string }[];
  bondType: string;
}

const CX = 400;
const CY = 280;

const MOLECULES: Record<string, MoleculeData> = {
  water: {
    name: "Water",
    formula: "H₂O",
    atoms: [
      { id: "O", element: "O", color: "#ef4444", radius: 28, x: CX, y: CY, label: "O" },
      { id: "H1", element: "H", color: "#f5f5f5", radius: 18, x: CX - 100, y: CY - 80, label: "H" },
      { id: "H2", element: "H", color: "#f5f5f5", radius: 18, x: CX + 100, y: CY - 80, label: "H" },
    ],
    bonds: [
      { from: "O", to: "H1", type: "single" },
      { from: "O", to: "H2", type: "single" },
    ],
    angles: [{ a: "H1", center: "O", b: "H2", value: "104.5°" }],
    bondType: "Covalent",
  },
  co2: {
    name: "Carbon Dioxide",
    formula: "CO₂",
    atoms: [
      { id: "C", element: "C", color: "#374151", radius: 24, x: CX, y: CY, label: "C" },
      { id: "O1", element: "O", color: "#ef4444", radius: 26, x: CX - 130, y: CY, label: "O" },
      { id: "O2", element: "O", color: "#ef4444", radius: 26, x: CX + 130, y: CY, label: "O" },
    ],
    bonds: [
      { from: "C", to: "O1", type: "double" },
      { from: "C", to: "O2", type: "double" },
    ],
    angles: [{ a: "O1", center: "C", b: "O2", value: "180°" }],
    bondType: "Covalent (double)",
  },
  methane: {
    name: "Methane",
    formula: "CH₄",
    atoms: [
      { id: "C", element: "C", color: "#374151", radius: 24, x: CX, y: CY, label: "C" },
      { id: "H1", element: "H", color: "#f5f5f5", radius: 16, x: CX, y: CY - 100, label: "H" },
      { id: "H2", element: "H", color: "#f5f5f5", radius: 16, x: CX + 95, y: CY + 30, label: "H" },
      { id: "H3", element: "H", color: "#f5f5f5", radius: 16, x: CX - 95, y: CY + 30, label: "H" },
      { id: "H4", element: "H", color: "#f5f5f5", radius: 16, x: CX, y: CY + 100, label: "H" },
    ],
    bonds: [
      { from: "C", to: "H1", type: "single" },
      { from: "C", to: "H2", type: "single" },
      { from: "C", to: "H3", type: "single" },
      { from: "C", to: "H4", type: "single" },
    ],
    angles: [{ a: "H1", center: "C", b: "H2", value: "109.5°" }],
    bondType: "Covalent",
  },
  ammonia: {
    name: "Ammonia",
    formula: "NH₃",
    atoms: [
      { id: "N", element: "N", color: "#3b82f6", radius: 24, x: CX, y: CY - 20, label: "N" },
      { id: "H1", element: "H", color: "#f5f5f5", radius: 16, x: CX - 90, y: CY + 70, label: "H" },
      { id: "H2", element: "H", color: "#f5f5f5", radius: 16, x: CX + 90, y: CY + 70, label: "H" },
      { id: "H3", element: "H", color: "#f5f5f5", radius: 16, x: CX, y: CY + 100, label: "H" },
    ],
    bonds: [
      { from: "N", to: "H1", type: "single" },
      { from: "N", to: "H2", type: "single" },
      { from: "N", to: "H3", type: "single" },
    ],
    angles: [{ a: "H1", center: "N", b: "H2", value: "107°" }],
    bondType: "Covalent",
  },
  nacl: {
    name: "Sodium Chloride",
    formula: "NaCl",
    atoms: [
      { id: "Na", element: "Na", color: "#a855f7", radius: 28, x: CX - 80, y: CY, label: "Na⁺" },
      { id: "Cl", element: "Cl", color: "#22c55e", radius: 32, x: CX + 80, y: CY, label: "Cl⁻" },
    ],
    bonds: [
      { from: "Na", to: "Cl", type: "ionic" },
    ],
    angles: [],
    bondType: "Ionic",
  },
};

export default function MoleculeRenderer({
  parameters,
  onUpdate,
}: RendererProps<MoleculeParams>) {
  const molecule = parameters.molecule ?? "water";
  const showAngles = parameters.showAngles ?? true;
  const showLabels = parameters.showLabels ?? true;

  const data = MOLECULES[molecule] || MOLECULES.water;
  const atomMap = useMemo(() => new Map(data.atoms.map((a) => [a.id, a])), [data.atoms]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 p-3">
        <svg viewBox="0 0 800 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Bonds */}
          {data.bonds.map((bond) => {
            const from = atomMap.get(bond.from)!;
            const to = atomMap.get(bond.to)!;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;
            const offset = bond.type === "double" ? 5 : 0;

            return (
              <g key={`${bond.from}-${bond.to}`}>
                <motion.line
                  x1={from.x + nx * offset} y1={from.y + ny * offset}
                  x2={to.x + nx * offset} y2={to.y + ny * offset}
                  stroke={bond.type === "ionic" ? "#fbbf24" : "rgba(255,255,255,0.4)"}
                  strokeWidth={bond.type === "ionic" ? 3 : 4}
                  strokeDasharray={bond.type === "ionic" ? "8 4" : undefined}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                {bond.type === "double" && (
                  <motion.line
                    x1={from.x - nx * offset} y1={from.y - ny * offset}
                    x2={to.x - nx * offset} y2={to.y - ny * offset}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                  />
                )}
                {/* Bond type label */}
                {showLabels && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 12}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.35)"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {bond.type === "double" ? "double bond" : bond.type === "ionic" ? "ionic bond" : "single bond"}
                  </text>
                )}
              </g>
            );
          })}

          {/* Angle arcs */}
          {showAngles && data.angles.map((angle) => {
            const a = atomMap.get(angle.a)!;
            const c = atomMap.get(angle.center)!;
            const b = atomMap.get(angle.b)!;
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            return (
              <g key={`angle-${angle.a}-${angle.b}`}>
                {/* Arc */}
                <path
                  d={`M ${a.x} ${a.y} Q ${c.x} ${c.y}, ${b.x} ${b.y}`}
                  fill="none" stroke="rgba(250,204,21,0.2)" strokeWidth={1} strokeDasharray="4 4"
                />
                {/* Angle value */}
                <text
                  x={midX} y={midY - 15}
                  textAnchor="middle" fill="#facc15"
                  fontSize={11} fontWeight="bold" fontFamily="monospace"
                >
                  {angle.value}
                </text>
              </g>
            );
          })}

          {/* Atoms */}
          {data.atoms.map((atom) => (
            <motion.g key={atom.id}>
              {/* Glow */}
              <motion.circle
                cx={atom.x} cy={atom.y} r={atom.radius * 1.8}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                fill="none"
                style={{ filter: `drop-shadow(0 0 8px ${atom.color}40)` }}
              />
              {/* Atom sphere */}
              <motion.circle
                cx={atom.x} cy={atom.y} r={atom.radius}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                fill={atom.color}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
              />
              {/* Highlight */}
              <motion.circle
                cx={atom.x - atom.radius * 0.25}
                cy={atom.y - atom.radius * 0.25}
                r={atom.radius * 0.35}
                fill="rgba(255,255,255,0.2)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 }}
              />
              {/* Label */}
              {showLabels && (
                <motion.text
                  x={atom.x} y={atom.y + 5}
                  textAnchor="middle" fill="white"
                  fontSize={atom.radius > 20 ? 16 : 12}
                  fontWeight="bold" fontFamily="monospace"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  {atom.label}
                </motion.text>
              )}
            </motion.g>
          ))}

          {/* Title */}
          <text x={CX} y={40} textAnchor="middle" fill="white" fontSize={18} fontWeight="bold" fontFamily="sans-serif">
            {data.name}
          </text>
          <text x={CX} y={62} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={14} fontFamily="monospace">
            {data.formula}
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-white font-semibold">{data.formula}</span>
        <span className="text-gray-400">Atoms: {data.atoms.length}</span>
        <span className="text-gray-400">Bonds: {data.bonds.length}</span>
        <span className="text-indigo-400">{data.bondType}</span>
        {data.angles.length > 0 && (
          <span className="text-yellow-400">Angle: {data.angles[0].value}</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        {Object.keys(MOLECULES).map((key) => (
          <button
            key={key}
            onClick={() => onUpdate?.({ molecule: key })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              molecule === key
                ? "bg-emerald-600/60 text-emerald-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {MOLECULES[key].formula}
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <button
          onClick={() => onUpdate?.({ showAngles: !showAngles })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showAngles ? "bg-yellow-600/60 text-yellow-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Angles
        </button>
        <button
          onClick={() => onUpdate?.({ showLabels: !showLabels })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showLabels ? "bg-emerald-600/60 text-emerald-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Labels
        </button>
      </div>
    </div>
  );
}
