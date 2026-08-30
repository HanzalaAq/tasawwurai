/**
 * Vector Visualizer — 2D vector operations with animated results.
 *
 * SVG + Framer Motion for smooth vector addition and parallelogram animations.
 *
 * Features:
 * - Two vectors (A, B) with draggable endpoints
 * - Operations: add, subtract, scale, dot product
 * - Parallelogram visualization for addition
 * - Component decomposition (dashed lines)
 * - Magnitude and direction display
 * - Grid background with axis labels
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface VectorParams {
  x: number; y: number;
  bx: number; by: number;
  operation: string;
  showComponents: boolean;
  showMagnitude: boolean;
}

const OPERATIONS = ["add", "subtract", "scale", "dot"];
const GRID_SIZE = 10;
const SCALE = 35; // pixels per unit

function vecMag(x: number, y: number) { return Math.sqrt(x * x + y * y); }
function vecAngle(x: number, y: number) { return (Math.atan2(y, x) * 180) / Math.PI; }

// SVG coordinate helpers (origin at center)
const CX = 400;
const CY = 300;
const toSvg = (v: number, flip = false) => flip ? CY - v * SCALE : CX + v * SCALE;

export default function VectorRenderer({
  parameters,
  onUpdate,
}: RendererProps<VectorParams>) {
  const ax = parameters.x ?? 3;
  const ay = parameters.y ?? 4;
  const bx = parameters.bx ?? 1;
  const by = parameters.by ?? 2;
  const operation = parameters.operation ?? "add";
  const showComponents = parameters.showComponents ?? true;
  const showMagnitude = parameters.showMagnitude ?? true;

  // Compute result vector
  const result = useMemo(() => {
    switch (operation) {
      case "add": return { x: ax + bx, y: ay + by, label: "A + B" };
      case "subtract": return { x: ax - bx, y: ay - by, label: "A - B" };
      case "scale": return { x: ax * 2, y: ay * 2, label: "2A" };
      case "dot": return { x: 0, y: 0, label: `A·B = ${(ax * bx + ay * by).toFixed(1)}` };
      default: return { x: ax + bx, y: ay + by, label: "A + B" };
    }
  }, [ax, ay, bx, by, operation]);

  // Dragging state
  const [dragging, setDragging] = useState<"A" | "B" | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragging || !onUpdate) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const scaleY = 600 / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const vx = Math.round(((mx - CX) / SCALE) * 2) / 2;
      const vy = Math.round(((CY - my) / SCALE) * 2) / 2;
      const clamped = Math.max(-GRID_SIZE / 2, Math.min(GRID_SIZE / 2, vx));
      const clampedY = Math.max(-GRID_SIZE / 2, Math.min(GRID_SIZE / 2, vy));
      if (dragging === "A") onUpdate({ x: clamped, y: clampedY });
      else onUpdate({ bx: clamped, by: clampedY });
    },
    [dragging, onUpdate]
  );

  // Arrowhead marker
  const ArrowHead = ({ id, color }: { id: string; color: string }) => (
    <marker id={id} viewBox="0 0 10 10" refX="10" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        <svg
          viewBox="0 0 800 600"
          className="h-full w-full cursor-crosshair"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
        >
          <defs>
            <ArrowHead id="arrowA" color="#6366f1" />
            <ArrowHead id="arrowB" color="#22d3ee" />
            <ArrowHead id="arrowR" color="#f97316" />
          </defs>

          {/* Grid */}
          {Array.from({ length: GRID_SIZE + 1 }, (_, i) => i - GRID_SIZE / 2).map((v) => (
            <g key={`grid-${v}`}>
              <line x1={toSvg(v)} y1={0} x2={toSvg(v)} y2={600}
                stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <line x1={0} y1={toSvg(v, true)} x2={800} y2={toSvg(v, true)}
                stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            </g>
          ))}

          {/* Axes */}
          <line x1={0} y1={CY} x2={800} y2={CY} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
          <line x1={CX} y1={0} x2={CX} y2={600} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />

          {/* Axis labels */}
          {Array.from({ length: GRID_SIZE + 1 }, (_, i) => i - GRID_SIZE / 2).filter((v) => v !== 0).map((v) => (
            <g key={`label-${v}`}>
              <text x={toSvg(v)} y={CY + 15} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">{v}</text>
              <text x={CX - 12} y={toSvg(v, true) + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">{v}</text>
            </g>
          ))}

          {/* Parallelogram for addition */}
          {operation === "add" && (
            <motion.polygon
              points={`${CX},${CY} ${toSvg(ax)},${toSvg(ay, true)} ${toSvg(ax + bx)},${toSvg(ay + by, true)} ${toSvg(bx)},${toSvg(by, true)}`}
              animate={{
                points: `${CX},${CY} ${toSvg(ax)},${toSvg(ay, true)} ${toSvg(ax + bx)},${toSvg(ay + by, true)} ${toSvg(bx)},${toSvg(by, true)}`,
              }}
              fill="rgba(249,115,22,0.08)"
              stroke="rgba(249,115,22,0.2)"
              strokeWidth={1}
              strokeDasharray="4 4"
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          )}

          {/* Component decomposition lines */}
          {showComponents && (
            <g>
              {/* A components */}
              <motion.line
                animate={{ x1: toSvg(ax), y1: CY, x2: toSvg(ax), y2: toSvg(ay, true) }}
                stroke="rgba(99,102,241,0.3)" strokeWidth={1} strokeDasharray="3 3"
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
              <motion.line
                animate={{ x1: CX, y1: toSvg(ay, true), x2: toSvg(ax), y2: toSvg(ay, true) }}
                stroke="rgba(99,102,241,0.3)" strokeWidth={1} strokeDasharray="3 3"
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
              {/* B components */}
              <motion.line
                animate={{ x1: toSvg(bx), y1: CY, x2: toSvg(bx), y2: toSvg(by, true) }}
                stroke="rgba(34,211,238,0.3)" strokeWidth={1} strokeDasharray="3 3"
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
              <motion.line
                animate={{ x1: CX, y1: toSvg(by, true), x2: toSvg(bx), y2: toSvg(by, true) }}
                stroke="rgba(34,211,238,0.3)" strokeWidth={1} strokeDasharray="3 3"
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </g>
          )}

          {/* Vector A */}
          <motion.line
            animate={{ x1: CX, y1: CY, x2: toSvg(ax), y2: toSvg(ay, true) }}
            stroke="#6366f1" strokeWidth={3} markerEnd="url(#arrowA)"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
          {/* Vector B */}
          <motion.line
            animate={{ x1: CX, y1: CY, x2: toSvg(bx), y2: toSvg(by, true) }}
            stroke="#22d3ee" strokeWidth={3} markerEnd="url(#arrowB)"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />

          {/* Result vector */}
          {operation !== "dot" && (
            <motion.line
              animate={{ x1: CX, y1: CY, x2: toSvg(result.x), y2: toSvg(result.y, true) }}
              stroke="#f97316" strokeWidth={3} markerEnd="url(#arrowR)"
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          )}

          {/* Draggable endpoints */}
          <motion.circle
            animate={{ cx: toSvg(ax), cy: toSvg(ay, true) }}
            r={8} fill="#6366f1" stroke="white" strokeWidth={2}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={() => setDragging("A")}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
          <motion.circle
            animate={{ cx: toSvg(bx), cy: toSvg(by, true) }}
            r={8} fill="#22d3ee" stroke="white" strokeWidth={2}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={() => setDragging("B")}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />

          {/* Vector labels */}
          <motion.text
            animate={{ x: toSvg(ax) + 12, y: toSvg(ay, true) - 8 }}
            fill="#818cf8" fontSize={13} fontWeight="bold" fontFamily="monospace"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >A ({ax}, {ay})</motion.text>
          <motion.text
            animate={{ x: toSvg(bx) + 12, y: toSvg(by, true) - 8 }}
            fill="#67e8f9" fontSize={13} fontWeight="bold" fontFamily="monospace"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >B ({bx}, {by})</motion.text>
          {operation !== "dot" && (
            <motion.text
              animate={{ x: toSvg(result.x) + 12, y: toSvg(result.y, true) + 16 }}
              fill="#fb923c" fontSize={13} fontWeight="bold" fontFamily="monospace"
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            >{result.label} ({result.x.toFixed(1)}, {result.y.toFixed(1)})</motion.text>
          )}
          {operation === "dot" && (
            <text x={CX + 20} y={40} fill="#fb923c" fontSize={16} fontWeight="bold" fontFamily="monospace">
              A · B = {(ax * bx + ay * by).toFixed(1)}
            </text>
          )}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-indigo-400">|A| = {vecMag(ax, ay).toFixed(2)}</span>
        <span className="text-cyan-400">|B| = {vecMag(bx, by).toFixed(2)}</span>
        <span className="text-indigo-400">∠A = {vecAngle(ax, ay).toFixed(1)}°</span>
        <span className="text-cyan-400">∠B = {vecAngle(bx, by).toFixed(1)}°</span>
        {operation !== "dot" && (
          <span className="text-orange-400">|{result.label}| = {vecMag(result.x, result.y).toFixed(2)}</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        {OPERATIONS.map((op) => (
          <button
            key={op}
            onClick={() => onUpdate?.({ operation: op })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
              operation === op
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {op}
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <button
          onClick={() => onUpdate?.({ showComponents: !showComponents })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showComponents ? "bg-emerald-600/60 text-emerald-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Components
        </button>

        <div className="ml-auto text-xs text-gray-500 italic">
          Drag vector endpoints to adjust
        </div>
      </div>
    </div>
  );
}
