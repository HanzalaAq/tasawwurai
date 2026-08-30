/**
 * BFS/DFS Graph Traversal Renderer — animated graph traversal visualization.
 *
 * SVG + Framer Motion for smooth node color transitions and traversal waves.
 *
 * Features:
 * - Predefined graph with labeled nodes
 * - BFS and DFS traversal modes
 * - Visit order numbers displayed on nodes
 * - Queue/stack state display showing the data structure in action
 * - Animated edge highlighting as traversal progresses
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface BFSDSParams {
  algorithm: string;
  startNode: string;
  speed: number;
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

// Predefined graph layout
const GRAPH_NODES: GraphNode[] = [
  { id: "A", x: 400, y: 50 },
  { id: "B", x: 200, y: 150 },
  { id: "C", x: 600, y: 150 },
  { id: "D", x: 100, y: 270 },
  { id: "E", x: 300, y: 270 },
  { id: "F", x: 500, y: 270 },
  { id: "G", x: 700, y: 270 },
  { id: "H", x: 200, y: 390 },
  { id: "I", x: 400, y: 390 },
  { id: "J", x: 600, y: 390 },
];

const GRAPH_EDGES: GraphEdge[] = [
  { from: "A", to: "B" }, { from: "A", to: "C" },
  { from: "B", to: "D" }, { from: "B", to: "E" },
  { from: "C", to: "F" }, { from: "C", to: "G" },
  { from: "D", to: "H" }, { from: "E", to: "I" },
  { from: "F", to: "I" }, { from: "G", to: "J" },
  { from: "E", to: "F" },
];

// Adjacency list
function buildAdj(): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  GRAPH_NODES.forEach((n) => adj.set(n.id, []));
  GRAPH_EDGES.forEach((e) => {
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  });
  // Sort for deterministic order
  adj.forEach((v) => v.sort());
  return adj;
}

const adj = buildAdj();

function bfsTraversal(start: string): { order: string[]; structures: string[][] } {
  const visited = new Set<string>();
  const queue: string[] = [start];
  const order: string[] = [];
  const structures: string[][] = [["[ " + start + " ]"]];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    order.push(node);
    const neighbors = adj.get(node) || [];
    for (const nb of neighbors) {
      if (!visited.has(nb) && !queue.includes(nb)) queue.push(nb);
    }
    structures.push([...queue]);
  }
  return { order, structures };
}

function dfsTraversal(start: string): { order: string[]; structures: string[][] } {
  const visited = new Set<string>();
  const stack: string[] = [start];
  const order: string[] = [];
  const structures: string[][] = [["[ " + start + " ]"]];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    order.push(node);
    const neighbors = (adj.get(node) || []).slice().reverse();
    for (const nb of neighbors) {
      if (!visited.has(nb)) stack.push(nb);
    }
    structures.push([...stack]);
  }
  return { order, structures };
}

const NODE_RADIUS = 22;

export default function BFSDFSRenderer({
  parameters,
  onUpdate,
}: RendererProps<BFSDSParams>) {
  const algorithm = parameters.algorithm ?? "bfs";
  const startNode = parameters.startNode ?? "A";
  const speed = parameters.speed ?? 1.0;

  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [dataStructure, setDataStructure] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Compute traversal
  const { order, structures } = algorithm === "dfs"
    ? dfsTraversal(startNode)
    : bfsTraversal(startNode);

  // Reset when algorithm or start changes
  useEffect(() => {
    setVisitedIds([]);
    setCurrentId(null);
    setDataStructure(structures[0] || []);
    setStepIdx(0);
    setPlaying(false);
    clearTimeout(timerRef.current);
  }, [algorithm, startNode]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= order.length) {
      setPlaying(false);
      setCurrentId(null);
      return;
    }
    const delay = Math.max(100, 800 / speed);
    timerRef.current = setTimeout(() => {
      const next = stepIdx + 1;
      setVisitedIds(order.slice(0, next));
      setCurrentId(order[stepIdx]);
      setDataStructure(structures[next] || []);
      setStepIdx(next);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [playing, stepIdx, order, structures, speed]);

  const handleStart = () => {
    setVisitedIds([]);
    setCurrentId(null);
    setStepIdx(0);
    setPlaying(true);
  };

  const handleReset = () => {
    setPlaying(false);
    setVisitedIds([]);
    setCurrentId(null);
    setStepIdx(0);
    setDataStructure(structures[0] || []);
  };

  const nodeMap = new Map(GRAPH_NODES.map((n) => [n.id, n]));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Graph SVG */}
        <div className="flex-1 p-2">
          <svg viewBox="0 0 800 450" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* Edges */}
            {GRAPH_EDGES.map((edge) => {
              const from = nodeMap.get(edge.from)!;
              const to = nodeMap.get(edge.to)!;
              const bothVisited = visitedIds.includes(edge.from) && visitedIds.includes(edge.to);
              return (
                <motion.line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  animate={{
                    stroke: bothVisited ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.12)",
                    strokeWidth: bothVisited ? 3 : 1.5,
                  }}
                  transition={{ duration: 0.3 }}
                />
              );
            })}

            {/* Nodes */}
            {GRAPH_NODES.map((node) => {
              const isVisited = visitedIds.includes(node.id);
              const isCurrent = currentId === node.id;
              const visitIdx = visitedIds.indexOf(node.id);
              return (
                <motion.g key={node.id}>
                  <motion.circle
                    cx={node.x} cy={node.y} r={NODE_RADIUS}
                    animate={{
                      fill: isCurrent ? "#f97316" : isVisited ? "#22c55e" : "#6366f1",
                      scale: isCurrent ? 1.15 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    stroke={isCurrent ? "#fb923c" : isVisited ? "#4ade80" : "rgba(255,255,255,0.1)"}
                    strokeWidth={isCurrent ? 3 : 1}
                  />
                  <text
                    x={node.x} y={node.y + 5}
                    textAnchor="middle" fill="white"
                    fontSize={14} fontWeight="bold" fontFamily="monospace"
                  >
                    {node.id}
                  </text>
                  {visitIdx >= 0 && (
                    <motion.text
                      x={node.x} y={node.y - NODE_RADIUS - 6}
                      textAnchor="middle" fill="#facc15"
                      fontSize={10} fontWeight="bold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      #{visitIdx + 1}
                    </motion.text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Data Structure Panel */}
        <div className="flex w-48 flex-col border-l border-gray-700/50 p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            {algorithm === "bfs" ? "Queue (FIFO)" : "Stack (LIFO)"}
          </h4>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {dataStructure.map((item, i) => (
              <motion.div
                key={`${item}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded bg-gray-700/50 px-2 py-1 font-mono text-xs text-emerald-300"
              >
                {item}
              </motion.div>
            ))}
            {dataStructure.length === 0 && (
              <p className="text-xs text-gray-600 italic">Empty</p>
            )}
          </div>
          <div className="mt-2 border-t border-gray-700/30 pt-2">
            <p className="text-xs text-gray-500">Visited:</p>
            <p className="font-mono text-xs text-emerald-400">
              {visitedIds.join(" → ") || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="capitalize text-indigo-400">{algorithm.toUpperCase()}</span>
        <span className="text-gray-400">Start: {startNode}</span>
        <span className="text-cyan-400">Visited: {visitedIds.length}/{GRAPH_NODES.length}</span>
        {visitedIds.length === order.length && (
          <span className="text-emerald-400 font-semibold">COMPLETE</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={handleStart}
          disabled={playing}
          className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          ▶ Traverse
        </button>
        <button onClick={handleReset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {["bfs", "dfs"].map((alg) => (
          <button
            key={alg}
            onClick={() => onUpdate?.({ algorithm: alg })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium uppercase transition-colors ${
              algorithm === alg
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {alg}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Speed
            <input
              type="range" min={0.1} max={5} step={0.1}
              value={speed}
              onChange={(e) => onUpdate?.({ speed: parseFloat(e.target.value) })}
              className="h-1 w-20 accent-indigo-500"
            />
            <span className="w-6 text-right text-gray-400">{speed.toFixed(1)}x</span>
          </label>
        </div>
      </div>
    </div>
  );
}
