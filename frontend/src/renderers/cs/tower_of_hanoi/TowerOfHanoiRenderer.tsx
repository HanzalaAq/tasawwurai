/**
 * Tower of Hanoi Renderer — recursive puzzle animation.
 *
 * SVG + Framer Motion for smooth disk movement between pegs.
 *
 * Features:
 * - Classic recursive solution generated for any disk count (1–8)
 * - Spring-animated disk moves between the three pegs
 * - Step-through mode for teaching the recursion step by step
 * - Move counter vs optimal 2^n − 1 readout
 * - Adjustable speed and disk count
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface HanoiParams {
  disks: number;
  speed: number;
}

// Recursive solution: move n disks from peg a to peg c using b
function hanoiMoves(n: number, from = 0, to = 2, aux = 1): [number, number][] {
  if (n === 0) return [];
  return [
    ...hanoiMoves(n - 1, from, aux, to),
    [from, to],
    ...hanoiMoves(n - 1, aux, to, from),
  ];
}

const VW = 800;
const VH = 420;
const PEG_X = [VW * 0.185, VW * 0.5, VW * 0.815];
const BASE_Y = 360;

export default function TowerOfHanoiRenderer({
  parameters,
  onUpdate,
}: RendererProps<HanoiParams>) {
  const disks = Math.max(1, Math.min(8, Math.round(parameters.disks ?? 4)));
  const speed = parameters.speed ?? 1;

  const moves = useMemo(() => hanoiMoves(disks), [disks]);
  const totalMoves = moves.length;

  // pegs[peg] = array of disk sizes, bottom → top
  const [pegs, setPegs] = useState<number[][]>(() => [
    Array.from({ length: disks }, (_, i) => disks - i),
    [],
    [],
  ]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset when disk count changes
  useEffect(() => {
    setPegs([Array.from({ length: disks }, (_, i) => disks - i), [], []]);
    setStepIdx(0);
    setPlaying(false);
  }, [disks]);

  const applyMove = useCallback(() => {
    setStepIdx((idx) => {
      if (idx >= moves.length) {
        setPlaying(false);
        return idx;
      }
      const [from, to] = moves[idx];
      setPegs((prev) => {
        const next = prev.map((p) => [...p]);
        const disk = next[from].pop();
        if (disk !== undefined) next[to].push(disk);
        return next;
      });
      return idx + 1;
    });
  }, [moves]);

  // Auto-play ticker
  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= moves.length) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(applyMove, Math.max(240, 1100 / speed));
    return () => clearTimeout(timerRef.current);
  }, [playing, stepIdx, moves.length, applyMove, speed]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setPegs([Array.from({ length: disks }, (_, i) => disks - i), [], []]);
    setStepIdx(0);
  }, [disks]);

  const diskH = 24;
  const diskW = (size: number) => 34 + (size - 1) * (140 / Math.max(disks - 1, 1));
  const diskColor = (size: number) => {
    const hue = 265 - (size - 1) * (185 / Math.max(disks - 1, 1));
    return `hsl(${hue}, 70%, 55%)`;
  };

  // Flatten disks with computed positions for rendering
  const rendered: { size: number; peg: number; level: number }[] = [];
  pegs.forEach((stack, peg) => {
    stack.forEach((size, level) => rendered.push({ size, peg, level }));
  });

  const solved = stepIdx >= totalMoves && totalMoves > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center p-2">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="h-full max-h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Base platform */}
          <rect x={40} y={BASE_Y} width={VW - 80} height={10} rx={4} fill="rgba(255,255,255,0.18)" />
          {/* Pegs */}
          {PEG_X.map((x, i) => (
            <rect
              key={i}
              x={x - 5}
              y={BASE_Y - disks * diskH - 36}
              width={10}
              height={disks * diskH + 36}
              rx={4}
              fill="rgba(255,255,255,0.22)"
            />
          ))}
          {/* Peg labels */}
          {["A (source)", "B (auxiliary)", "C (target)"].map((label, i) => (
            <text
              key={label}
              x={PEG_X[i]}
              y={BASE_Y + 32}
              textAnchor="middle"
              fill="rgba(255,255,255,0.4)"
              fontSize={12}
              fontFamily="monospace"
            >
              {label}
            </text>
          ))}
          {/* Disks */}
          {rendered.map((d) => {
            const w = diskW(d.size);
            const x = PEG_X[d.peg] - w / 2;
            const y = BASE_Y - (d.level + 1) * diskH;
            return (
              <motion.rect
                key={d.size}
                x={x}
                y={y}
                width={w}
                height={diskH - 3}
                rx={7}
                fill={diskColor(d.size)}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1}
                initial={false}
                animate={{ x, y }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              />
            );
          })}
          {/* Move label */}
          {playing && stepIdx < moves.length && (
            <text
              x={VW / 2}
              y={30}
              textAnchor="middle"
              fill="#a78bfa"
              fontSize={13}
              fontFamily="monospace"
            >
              move {stepIdx + 1}/{totalMoves}: {String.fromCharCode(65 + moves[stepIdx][0])} → {String.fromCharCode(65 + moves[stepIdx][1])}
            </text>
          )}
          {solved && (
            <text
              x={VW / 2}
              y={30}
              textAnchor="middle"
              fill="#4ade80"
              fontSize={15}
              fontWeight="bold"
              fontFamily="monospace"
            >
              SOLVED in {totalMoves} moves
            </text>
          )}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-purple-400">disks: {disks}</span>
        <span className="text-orange-400">moves: {stepIdx}/{totalMoves}</span>
        <span className="text-gray-400">optimal: 2^{disks} − 1 = {Math.pow(2, disks) - 1}</span>
        {solved && <span className="font-semibold text-green-400">COMPLETE</span>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={solved}
          className="rounded-lg bg-purple-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => { setPlaying(false); applyMove(); }}
          disabled={playing || solved}
          className="rounded-lg bg-purple-600/40 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/50 disabled:opacity-40"
        >
          ⏭ Step
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Disks
          <input
            type="range" min={1} max={8} step={1}
            value={disks}
            onChange={(e) => onUpdate?.({ disks: parseInt(e.target.value, 10) })}
            className="h-1 w-20 accent-purple-500"
          />
          <span className="w-4 text-right text-gray-400">{disks}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Speed
          <input
            type="range" min={0.5} max={5} step={0.5}
            value={speed}
            onChange={(e) => onUpdate?.({ speed: parseFloat(e.target.value) })}
            className="h-1 w-20 accent-purple-500"
          />
          <span className="w-7 text-right text-gray-400">{speed.toFixed(1)}x</span>
        </label>
        <span className="ml-auto text-[10px] text-gray-600">
          hanoi(n) = hanoi(n−1) → move → hanoi(n−1)
        </span>
      </div>
    </div>
  );
}
