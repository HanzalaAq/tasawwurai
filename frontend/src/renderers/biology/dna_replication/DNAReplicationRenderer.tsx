/**
 * DNA Replication Renderer — animated double helix with replication fork.
 *
 * SVG + Framer Motion for smooth unwinding and base pair separation.
 *
 * Features:
 * - Double helix rendered as sinusoidal backbone strands
 * - Base pairs (A-T, G-C) with correct complementary coloring
 * - Hydrogen bonds as dashed lines between base pairs
 * - Replication fork animation: strands separate and new strands synthesize
 * - 5' to 3' directionality arrows
 * - Base pair labels
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface DNAParams {
  basePairs: number;
  animating: boolean;
  showLabels: boolean;
}

// Base pair sequences (randomized)
const BASES = ["A", "T", "G", "C"] as const;
const COMPLEMENT: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
const COLORS: Record<string, string> = { A: "#ef4444", T: "#3b82f6", G: "#22c55e", C: "#eab308" };

function generateSequence(count: number): string[] {
  return Array.from({ length: count }, () => BASES[Math.floor(Math.random() * 4)]);
}

export default function DNAReplicationRenderer({
  parameters,
  onUpdate,
}: RendererProps<DNAParams>) {
  const basePairCount = parameters.basePairs ?? 12;
  const animating = parameters.animating ?? true;
  const showLabels = parameters.showLabels ?? true;

  const [sequence] = useState(() => generateSequence(basePairCount));
  const [forkPos, setForkPos] = useState(0); // 0 = no fork, basePairCount = fully replicated
  const [playing, setPlaying] = useState(animating);
  const animRef = useRef(0);
  const forkRef = useRef(0);

  // Animation
  useEffect(() => {
    if (!playing) return;
    let last = 0;
    const step = (ts: number) => {
      if (!last) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      forkRef.current = Math.min(forkRef.current + dt * 2, basePairCount);
      setForkPos(forkRef.current);
      if (forkRef.current >= basePairCount) {
        setPlaying(false);
        return;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, basePairCount]);

  const handleReset = () => {
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    forkRef.current = 0;
    setForkPos(0);
  };

  // Layout constants
  const svgW = 800;
  const svgH = 500;
  const cx = svgW / 2;
  const startY = 40;
  const spacing = (svgH - 80) / basePairCount;
  const helixAmplitude = 80;
  const helixFreq = (2 * Math.PI) / 6;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 p-2">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Helix backbone paths */}
          {(() => {
            const leftPath: string[] = [];
            const rightPath: string[] = [];
            for (let i = 0; i <= basePairCount; i++) {
              const y = startY + i * spacing;
              const phase = i * helixFreq;
              const xL = cx - helixAmplitude * Math.sin(phase);
              const xR = cx + helixAmplitude * Math.sin(phase);
              leftPath.push(`${i === 0 ? "M" : "L"} ${xL} ${y}`);
              rightPath.push(`${i === 0 ? "M" : "L"} ${xR} ${y}`);
            }
            return (
              <g>
                <path d={leftPath.join(" ")} fill="none" stroke="#818cf8" strokeWidth={3} opacity={0.6} />
                <path d={rightPath.join(" ")} fill="none" stroke="#c084fc" strokeWidth={3} opacity={0.6} />
              </g>
            );
          })()}

          {/* Base pairs */}
          {sequence.map((base, i) => {
            const y = startY + i * spacing;
            const phase = i * helixFreq;
            const xL = cx - helixAmplitude * Math.sin(phase);
            const xR = cx + helixAmplitude * Math.sin(phase);
            const comp = COMPLEMENT[base];
            const isSeparated = i < forkPos;
            const sepAmount = isSeparated ? Math.min((forkPos - i) * 8, 40) : 0;

            return (
              <g key={i}>
                {/* Hydrogen bond (dashed) */}
                {!isSeparated && (
                  <line
                    x1={xL} y1={y} x2={xR} y2={y}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}

                {/* Left base */}
                <motion.circle
                  cx={xL - sepAmount} cy={y} r={10}
                  fill={COLORS[base]}
                  animate={{ cx: xL - sepAmount }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  opacity={0.9}
                />
                {showLabels && (
                  <text x={xL - sepAmount} y={y + 4} textAnchor="middle"
                    fill="white" fontSize={9} fontWeight="bold" fontFamily="monospace">
                    {base}
                  </text>
                )}

                {/* Right base (complement) */}
                <motion.circle
                  cx={xR + sepAmount} cy={y} r={10}
                  fill={COLORS[comp]}
                  animate={{ cx: xR + sepAmount }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  opacity={0.9}
                />
                {showLabels && (
                  <text x={xR + sepAmount} y={y + 4} textAnchor="middle"
                    fill="white" fontSize={9} fontWeight="bold" fontFamily="monospace">
                    {comp}
                  </text>
                )}

                {/* New strands (synthesized during replication) */}
                {isSeparated && (
                  <g>
                    {/* New right complement for left strand */}
                    <motion.circle
                      cx={xL - sepAmount + 25} cy={y} r={7}
                      fill={COLORS[comp]}
                      opacity={0.5}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                    <line
                      x1={xL - sepAmount + 10} y1={y}
                      x2={xL - sepAmount + 18} y2={y}
                      stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="2 2"
                    />
                    {/* New left complement for right strand */}
                    <motion.circle
                      cx={xR + sepAmount - 25} cy={y} r={7}
                      fill={COLORS[base]}
                      opacity={0.5}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                    <line
                      x1={xR + sepAmount - 10} y1={y}
                      x2={xR + sepAmount - 18} y2={y}
                      stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="2 2"
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Replication fork indicator */}
          {forkPos > 0 && forkPos < basePairCount && (
            <motion.g>
              <motion.line
                x1={cx - 120} y1={startY + forkPos * spacing}
                x2={cx + 120} y2={startY + forkPos * spacing}
                stroke="#facc15"
                strokeWidth={2}
                strokeDasharray="6 4"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <text
                x={cx + 130} y={startY + forkPos * spacing + 4}
                fill="#facc15" fontSize={10} fontWeight="bold" fontFamily="monospace"
              >
                Fork
              </text>
            </motion.g>
          )}

          {/* Direction arrows */}
          <text x={cx - helixAmplitude - 35} y={startY + 10} fill="#818cf8" fontSize={10} fontFamily="monospace">
            {"5'"}
          </text>
          <text x={cx - helixAmplitude - 35} y={startY + basePairCount * spacing + 5} fill="#818cf8" fontSize={10} fontFamily="monospace">
            {"3'"}
          </text>
          <text x={cx + helixAmplitude + 20} y={startY + 10} fill="#c084fc" fontSize={10} fontFamily="monospace">
            {"3'"}
          </text>
          <text x={cx + helixAmplitude + 20} y={startY + basePairCount * spacing + 5} fill="#c084fc" fontSize={10} fontFamily="monospace">
            {"5'"}
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-purple-400">Base Pairs: {basePairCount}</span>
        <span className="text-yellow-400">Replicated: {Math.floor(forkPos)}/{basePairCount}</span>
        <span className="text-gray-500">
          Sequence: {sequence.slice(0, 8).join("")}{sequence.length > 8 ? "..." : ""}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => { if (forkPos >= basePairCount) handleReset(); setPlaying(!playing); }}
          className="rounded-lg bg-purple-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
        >
          {playing ? "⏸ Pause" : forkPos >= basePairCount ? "↺ Replay" : "▶ Play"}
        </button>
        <button onClick={handleReset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <button
          onClick={() => onUpdate?.({ showLabels: !showLabels })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showLabels ? "bg-purple-600/60 text-purple-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Labels {showLabels ? "ON" : "OFF"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Pairs
            <input
              type="range" min={6} max={20} step={1}
              value={basePairCount}
              onChange={(e) => onUpdate?.({ basePairs: parseInt(e.target.value) })}
              className="h-1 w-16 accent-purple-500"
            />
            <span className="w-4 text-right text-gray-400">{basePairCount}</span>
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 border-t border-gray-800 bg-gray-950/30 px-4 py-1.5">
        {["A", "T", "G", "C"].map((b) => (
          <span key={b} className="flex items-center gap-1 text-xs">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[b] }} />
            <span className="text-gray-500">{b === "A" ? "Adenine" : b === "T" ? "Thymine" : b === "G" ? "Guanine" : "Cytosine"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
