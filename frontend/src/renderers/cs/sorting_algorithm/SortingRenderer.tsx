/**
 * Sorting Algorithm Renderer — animated bar-chart sort visualization.
 *
 * SVG + Framer Motion for smooth bar height transitions and swap animations.
 *
 * Features:
 * - Color-coded states: comparing (orange), swapping (red), sorted (green), default (blue)
 * - Multiple algorithms: Bubble, Selection, Insertion, Merge, Quick
 * - Speed control slider
 * - Step counter (comparisons & swaps)
 * - Play/Pause/Step/Reset controls
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface SortingParams {
  algorithm: string;
  arraySize: number;
  speed: number;
}

type BarState = "default" | "comparing" | "swapping" | "sorted";

interface Bar {
  value: number;
  id: number; // stable id for Framer Motion key
  state: BarState;
}

const COLORS: Record<BarState, string> = {
  default: "#6366f1",
  comparing: "#f97316",
  swapping: "#ef4444",
  sorted: "#22c55e",
};

const ALGORITHMS = ["bubble", "selection", "insertion", "merge", "quick"];

let nextId = 0;

function generateArray(size: number): Bar[] {
  return Array.from({ length: size }, () => ({
    value: Math.floor(Math.random() * 90) + 10,
    id: nextId++,
    state: "default" as BarState,
  }));
}

// ── Sorting Step Generators ──
// Each yields an array of "steps" — each step is a snapshot of the array state.

type SortStep = { bars: Bar[]; comparisons: number; swaps: number };

function bubbleSort(input: number[]): SortStep[] {
  const arr = input.map((v, i) => ({ value: v, id: i, state: "default" as BarState }));
  const steps: SortStep[] = [{ bars: arr.map((b) => ({ ...b })), comparisons: 0, swaps: 0 }];
  let comps = 0, swps = 0;
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      arr[j].state = "comparing"; arr[j + 1].state = "comparing";
      comps++;
      steps.push({ bars: arr.map((b) => ({ ...b, state: b.state })), comparisons: comps, swaps: swps });
      if (arr[j].value > arr[j + 1].value) {
        arr[j].state = "swapping"; arr[j + 1].state = "swapping";
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swps++;
        steps.push({ bars: arr.map((b) => ({ ...b, state: b.state })), comparisons: comps, swaps: swps });
      }
      arr[j].state = "default"; arr[j + 1].state = "default";
    }
    arr[n - i - 1].state = "sorted";
    steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  }
  arr[0].state = "sorted";
  steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  return steps;
}

function selectionSort(input: number[]): SortStep[] {
  const arr = input.map((v, i) => ({ value: v, id: i, state: "default" as BarState }));
  const steps: SortStep[] = [{ bars: arr.map((b) => ({ ...b })), comparisons: 0, swaps: 0 }];
  let comps = 0, swps = 0;
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      arr[j].state = "comparing"; arr[minIdx].state = "comparing";
      comps++;
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      if (arr[j].value < arr[minIdx].value) {
        arr[minIdx].state = "default";
        minIdx = j;
      } else {
        arr[j].state = "default";
      }
    }
    if (minIdx !== i) {
      arr[i].state = "swapping"; arr[minIdx].state = "swapping";
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      swps++;
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      arr[minIdx].state = "default";
    }
    arr[i].state = "sorted";
    steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  }
  arr[n - 1].state = "sorted";
  steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  return steps;
}

function insertionSort(input: number[]): SortStep[] {
  const arr = input.map((v, i) => ({ value: v, id: i, state: "default" as BarState }));
  const steps: SortStep[] = [{ bars: arr.map((b) => ({ ...b })), comparisons: 0, swaps: 0 }];
  let comps = 0, swps = 0;
  arr[0].state = "sorted";
  steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  for (let i = 1; i < arr.length; i++) {
    let j = i;
    arr[j].state = "comparing";
    while (j > 0 && arr[j - 1].value > arr[j].value) {
      comps++;
      arr[j].state = "swapping"; arr[j - 1].state = "swapping";
      [arr[j], arr[j - 1]] = [arr[j - 1], arr[j]];
      swps++;
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      arr[j].state = "sorted";
      j--;
      arr[j].state = "comparing";
    }
    comps++;
    arr[j].state = "sorted";
    steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  }
  return steps;
}

function mergeSortSteps(input: number[]): SortStep[] {
  const arr = input.map((v, i) => ({ value: v, id: i, state: "default" as BarState }));
  const steps: SortStep[] = [{ bars: arr.map((b) => ({ ...b })), comparisons: 0, swaps: 0 }];
  let comps = 0, swps = 0;

  function merge(left: number, mid: number, right: number) {
    const temp: Bar[] = [];
    let i = left, j = mid + 1;
    while (i <= mid && j <= right) {
      arr[i].state = "comparing"; arr[j].state = "comparing";
      comps++;
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      if (arr[i].value <= arr[j].value) { temp.push({ ...arr[i] }); i++; }
      else { temp.push({ ...arr[j] }); j++; }
      arr[i - 1].state = "default"; if (j <= right) arr[j].state = "default";
    }
    while (i <= mid) { temp.push({ ...arr[i] }); i++; }
    while (j <= right) { temp.push({ ...arr[j] }); j++; }
    for (let k = 0; k < temp.length; k++) {
      arr[left + k] = { ...temp[k], state: "swapping" };
      swps++;
    }
    steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
    for (let k = left; k <= right; k++) arr[k].state = "default";
  }

  function sort(left: number, right: number) {
    if (left >= right) return;
    const mid = Math.floor((left + right) / 2);
    sort(left, mid);
    sort(mid + 1, right);
    merge(left, mid, right);
  }

  sort(0, arr.length - 1);
  arr.forEach((b) => (b.state = "sorted"));
  steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  return steps;
}

function quickSortSteps(input: number[]): SortStep[] {
  const arr = input.map((v, i) => ({ value: v, id: i, state: "default" as BarState }));
  const steps: SortStep[] = [{ bars: arr.map((b) => ({ ...b })), comparisons: 0, swaps: 0 }];
  let comps = 0, swps = 0;

  function partition(low: number, high: number): number {
    const pivot = arr[high].value;
    arr[high].state = "comparing";
    let i = low - 1;
    for (let j = low; j < high; j++) {
      arr[j].state = "comparing";
      comps++;
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      if (arr[j].value < pivot) {
        i++;
        arr[i].state = "swapping"; arr[j].state = "swapping";
        [arr[i], arr[j]] = [arr[j], arr[i]];
        swps++;
        steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      }
      arr[j].state = "default";
      if (i >= low) arr[i].state = "default";
    }
    arr[high].state = "swapping"; arr[i + 1].state = "swapping";
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
    swps++;
    steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
    arr[high].state = "default"; arr[i + 1].state = "default";
    return i + 1;
  }

  function sort(low: number, high: number) {
    if (low < high) {
      const pi = partition(low, high);
      arr[pi].state = "sorted";
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
      sort(low, pi - 1);
      sort(pi + 1, high);
    } else if (low === high) {
      arr[low].state = "sorted";
      steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
    }
  }

  sort(0, arr.length - 1);
  arr.forEach((b) => (b.state = "sorted"));
  steps.push({ bars: arr.map((b) => ({ ...b })), comparisons: comps, swaps: swps });
  return steps;
}

function generateSteps(algorithm: string, values: number[]): SortStep[] {
  switch (algorithm) {
    case "selection": return selectionSort(values);
    case "insertion": return insertionSort(values);
    case "merge": return mergeSortSteps(values);
    case "quick": return quickSortSteps(values);
    default: return bubbleSort(values);
  }
}

// ── Main Component ──

export default function SortingRenderer({
  parameters,
  onUpdate,
}: RendererProps<SortingParams>) {
  const algorithm = parameters.algorithm ?? "bubble";
  const arraySize = parameters.arraySize ?? 15;
  const speed = parameters.speed ?? 1.0;

  const [steps, setSteps] = useState<SortStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [comparisons, setComparisons] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize
  const initSort = useCallback(() => {
    const arr = generateArray(arraySize);
    const values = arr.map((b) => b.value);
    const allSteps = generateSteps(algorithm, values);
    setSteps(allSteps);
    setStepIdx(0);
    setComparisons(0);
    setSwaps(0);
    setPlaying(false);
  }, [algorithm, arraySize]);

  useEffect(() => { initSort(); }, [initSort]);

  // Auto-play
  useEffect(() => {
    if (!playing || stepIdx >= steps.length - 1) {
      if (stepIdx >= steps.length - 1) setPlaying(false);
      return;
    }
    const delay = Math.max(50, 400 / speed);
    timerRef.current = setTimeout(() => {
      setStepIdx((i) => i + 1);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [playing, stepIdx, steps.length, speed]);

  // Update stats from current step
  useEffect(() => {
    if (steps[stepIdx]) {
      setComparisons(steps[stepIdx].comparisons);
      setSwaps(steps[stepIdx].swaps);
    }
  }, [stepIdx, steps]);

  const currentBars = steps[stepIdx]?.bars ?? [];
  const maxVal = Math.max(...currentBars.map((b) => b.value), 1);
  const isDone = stepIdx >= steps.length - 1;

  return (
    <div className="flex h-full flex-col">
      {/* SVG Bar Chart */}
      <div className="flex-1 min-h-0 p-4">
        <svg viewBox="0 0 800 400" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {currentBars.map((bar, i) => {
            const barW = 760 / currentBars.length - 2;
            const barH = (bar.value / maxVal) * 340;
            const x = 20 + i * (barW + 2);
            const y = 380 - barH;
            return (
              <motion.g key={bar.id}>
                <motion.rect
                  x={x}
                  width={barW}
                  rx={2}
                  animate={{ y, height: barH, fill: COLORS[bar.state] }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
                {barW > 14 && (
                  <motion.text
                    x={x + barW / 2}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize={Math.min(barW * 0.6, 11)}
                    fontFamily="monospace"
                    animate={{ y: y - 4 }}
                  >
                    {bar.value}
                  </motion.text>
                )}
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-cyan-400">Comparisons: {comparisons}</span>
        <span className="text-orange-400">Swaps: {swaps}</span>
        <span className="text-gray-400">
          Step: {stepIdx}/{steps.length - 1}
        </span>
        <span className="capitalize text-purple-400">{algorithm}</span>
        {isDone && <span className="text-emerald-400 font-semibold">SORTED</span>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setPlaying(!playing)}
          disabled={isDone}
          className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => { setPlaying(false); setStepIdx((i) => Math.min(i + 1, steps.length - 1)); }}
          disabled={isDone || playing}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-40"
        >
          ⏭ Step
        </button>
        <button
          onClick={initSort}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ New Array
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {/* Algorithm selector */}
        {ALGORITHMS.map((alg) => (
          <button
            key={alg}
            onClick={() => onUpdate?.({ algorithm: alg })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
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
