/**
 * Pathfinding Renderer — animated grid search visualization.
 *
 * SVG grid with React-state-driven animation (no canvas).
 *
 * Features:
 * - Dijkstra, A* (octile/Manhattan heuristic) and Greedy Best-First
 * - Random mazes with adjustable wall density (always solvable)
 * - Animated visited cells with recency fade, live frontier, final path
 * - Diagonal movement toggle
 * - Visited count and path length stats
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface PathfindingParams {
  algorithm: string;
  wallDensity: number;
  speed: number;
  diagonal: boolean;
}

const COLS = 25;
const ROWS = 15;
const CELL = 26;
const START = 7 * COLS + 0; // (0, 7)
const END = 7 * COLS + (COLS - 1); // (24, 7)

interface Plan {
  visitOrder: number[];
  path: number[] | null;
  ms: number;
}

function heuristic(i: number, diagonal: boolean): number {
  const x = i % COLS;
  const y = Math.floor(i / COLS);
  const dx = Math.abs(x - (COLS - 1));
  const dy = Math.abs(y - 7);
  return diagonal ? Math.max(dx, dy) + 0.41421 * Math.min(dx, dy) : dx + dy;
}

function computePlan(walls: boolean[], algorithm: string, diagonal: boolean): Plan {
  const N = COLS * ROWS;
  const dist = new Float64Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  const visitOrder: number[] = [];
  const open: { i: number; pr: number }[] = [];

  const t0 = performance.now();
  dist[START] = 0;
  open.push({ i: START, pr: algorithm === "greedy" ? heuristic(START, diagonal) : algorithm === "astar" ? heuristic(START, diagonal) : 0 });

  const DIRS: [number, number, number][] = diagonal
    ? [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41421], [1, -1, 1.41421], [-1, 1, 1.41421], [-1, -1, 1.41421]]
    : [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]];

  while (open.length > 0) {
    let mi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].pr < open[mi].pr) mi = k;
    const { i } = open.splice(mi, 1)[0];
    if (done[i]) continue;
    done[i] = 1;
    visitOrder.push(i);
    if (i === END) break;

    const x = i % COLS;
    const y = Math.floor(i / COLS);
    for (const [dx, dy, cost] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const j = ny * COLS + nx;
      if (walls[j] || done[j]) continue;
      const nd = dist[i] + cost;
      if (nd < dist[j]) {
        dist[j] = nd;
        parent[j] = i;
        const pr = algorithm === "greedy" ? heuristic(j, diagonal) : algorithm === "astar" ? nd + heuristic(j, diagonal) : nd;
        open.push({ i: j, pr });
      }
    }
  }
  const ms = performance.now() - t0;

  let path: number[] | null = null;
  if (done[END]) {
    path = [];
    let c = END;
    while (c !== -1) {
      path.push(c);
      c = parent[c];
    }
    path.reverse();
  }
  return { visitOrder, path, ms };
}

function reachable(walls: boolean[]): boolean {
  const seen = new Uint8Array(COLS * ROWS);
  const q = [START];
  seen[START] = 1;
  while (q.length > 0) {
    const i = q.pop()!;
    if (i === END) return true;
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const j = ny * COLS + nx;
      if (!seen[j] && !walls[j]) {
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  return false;
}

function generateMaze(density: number): boolean[] {
  for (let attempt = 0; attempt < 80; attempt++) {
    const walls = new Array(COLS * ROWS).fill(false);
    for (let i = 0; i < walls.length; i++) {
      if (Math.random() < density) walls[i] = true;
    }
    // Clear a neighborhood of start and end
    for (const anchor of [START, END]) {
      const ax = anchor % COLS;
      const ay = Math.floor(anchor / COLS);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ax + dx;
          const ny = ay + dy;
          if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) walls[ny * COLS + nx] = false;
        }
      }
    }
    if (reachable(walls)) return walls;
  }
  return new Array(COLS * ROWS).fill(false);
}

export default function PathfindingRenderer({
  parameters,
  onUpdate,
}: RendererProps<PathfindingParams>) {
  const algorithm = ["dijkstra", "astar", "greedy"].includes(parameters.algorithm as string)
    ? (parameters.algorithm as "dijkstra" | "astar" | "greedy")
    : "astar";
  const wallDensity = parameters.wallDensity ?? 0.25;
  const speed = parameters.speed ?? 5;
  const diagonal = parameters.diagonal ?? true;

  const [mazeVersion, setMazeVersion] = useState(0);
  const walls = useMemo(() => generateMaze(wallDensity), [wallDensity, mazeVersion]);

  const plan = useMemo(() => computePlan(walls, algorithm, diagonal), [walls, algorithm, diagonal]);

  const [playing, setPlaying] = useState(false);
  const [visitedCount, setVisitedCount] = useState(0);
  const [pathCount, setPathCount] = useState(0);
  const visitedRef = useRef(0);
  const pathRevealRef = useRef(0);

  const reset = useCallback(() => {
    setPlaying(false);
    visitedRef.current = 0;
    pathRevealRef.current = 0;
    setVisitedCount(0);
    setPathCount(0);
  }, []);

  // Reset animation when the plan changes
  useEffect(() => {
    reset();
  }, [plan, reset]);

  // Regenerate maze when density changes
  useEffect(() => {
    setMazeVersion((v) => v + 1);
  }, [wallDensity]);

  // Animation ticker
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (visitedRef.current < plan.visitOrder.length) {
        visitedRef.current = Math.min(
          visitedRef.current + Math.max(1, Math.round(plan.visitOrder.length / 50)),
          plan.visitOrder.length
        );
        setVisitedCount(visitedRef.current);
      } else if (pathRevealRef.current < (plan.path?.length ?? 0)) {
        pathRevealRef.current += 1;
        setPathCount(pathRevealRef.current);
      } else {
        setPlaying(false);
      }
    }, Math.max(16, Math.round(1000 / (speed * 6))));
    return () => clearInterval(id);
  }, [playing, plan, speed]);

  // Derived render data
  const visitedIdx = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < visitedCount; i++) map.set(plan.visitOrder[i], i);
    return map;
  }, [plan, visitedCount]);

  const pathSet = useMemo(() => {
    const s = new Set<number>();
    if (plan.path) for (let i = 0; i < pathCount; i++) s.add(plan.path[i]);
    return s;
  }, [plan, pathCount]);

  const frontier = useMemo(() => {
    const s = new Set<number>();
    const DIRS = diagonal
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    visitedIdx.forEach((_, i) => {
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = ny * COLS + nx;
        if (!visitedIdx.has(j) && !walls[j] && j !== START && !pathSet.has(j)) s.add(j);
      }
    });
    return s;
  }, [visitedIdx, walls, diagonal, pathSet]);

  const finished = visitedCount >= plan.visitOrder.length && plan.path !== null;
  const pathLen = plan.path?.length ?? 0;

  const cellFill = (i: number): string => {
    if (i === START) return "#8b5cf6";
    if (i === END) return "#ec4899";
    if (walls[i]) return "#293548";
    if (pathSet.has(i)) return "#f97316";
    const vi = visitedIdx.get(i);
    if (vi !== undefined) {
      const recency = visitedCount > 1 ? vi / (visitedCount - 1) : 1;
      return `rgba(34,197,94,${0.25 + recency * 0.55})`;
    }
    if (frontier.has(i)) return "rgba(34,211,238,0.4)";
    return "rgba(255,255,255,0.04)";
  };

  const ALGO_LABELS: Record<string, string> = {
    dijkstra: "Dijkstra (uniform cost)",
    astar: "A* (cost + heuristic)",
    greedy: "Greedy (heuristic only)",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center p-2">
        <svg
          viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
          className="h-full max-h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {Array.from({ length: COLS * ROWS }, (_, i) => {
            const x = (i % COLS) * CELL;
            const y = Math.floor(i / COLS) * CELL;
            return (
              <rect
                key={i}
                x={x + 0.5}
                y={y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                rx={3}
                fill={cellFill(i)}
                stroke={walls[i] ? "rgba(148,163,184,0.15)" : "rgba(255,255,255,0.02)"}
                style={{ transition: "fill 120ms linear" }}
              />
            );
          })}
          {/* Start / end labels */}
          <text
            x={(START % COLS) * CELL + CELL / 2}
            y={Math.floor(START / COLS) * CELL + CELL / 2 + 4}
            textAnchor="middle" fill="white" fontSize={11} fontWeight="bold"
          >
            S
          </text>
          <text
            x={(END % COLS) * CELL + CELL / 2}
            y={Math.floor(END / COLS) * CELL + CELL / 2 + 4}
            textAnchor="middle" fill="white" fontSize={11} fontWeight="bold"
          >
            E
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-green-400">visited: {visitedCount}</span>
        <span className="text-orange-400">path: {finished || pathCount > 0 ? `${pathLen} cells` : "—"}</span>
        <span className="text-gray-400">compute: {plan.ms.toFixed(2)} ms</span>
        <span className="text-cyan-400">{ALGO_LABELS[algorithm]}</span>
        {finished && pathCount >= pathLen && pathLen > 0 && (
          <span className="font-semibold text-emerald-400">PATH FOUND</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg bg-green-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
        >
          {playing ? "⏸ Pause" : "▶ Run"}
        </button>
        <button
          onClick={reset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>
        <button
          onClick={() => { reset(); setMazeVersion((v) => v + 1); }}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ⚄ New Maze
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {(["dijkstra", "astar", "greedy"] as const).map((a) => (
          <button
            key={a}
            onClick={() => onUpdate?.({ algorithm: a })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              algorithm === a
                ? "bg-green-600/60 text-green-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {a === "astar" ? "A*" : a === "dijkstra" ? "Dijkstra" : "Greedy"}
          </button>
        ))}

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={diagonal}
            onChange={(e) => onUpdate?.({ diagonal: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-green-500"
          />
          diagonals
        </label>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Walls
            <input
              type="range" min={0} max={0.5} step={0.05}
              value={wallDensity}
              onChange={(e) => onUpdate?.({ wallDensity: parseFloat(e.target.value) })}
              className="h-1 w-16 accent-green-500"
            />
            <span className="w-8 text-right text-gray-400">{Math.round(wallDensity * 100)}%</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Speed
            <input
              type="range" min={1} max={20} step={1}
              value={speed}
              onChange={(e) => onUpdate?.({ speed: parseFloat(e.target.value) })}
              className="h-1 w-16 accent-green-500"
            />
            <span className="w-6 text-right text-gray-400">{speed.toFixed(0)}x</span>
          </label>
        </div>
      </div>
    </div>
  );
}
