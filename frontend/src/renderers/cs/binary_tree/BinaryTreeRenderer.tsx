/**
 * Binary Tree Renderer — interactive tree with traversal animations.
 *
 * SVG + Framer Motion for node insertion and traversal highlighting.
 *
 * Features:
 * - Auto-generated balanced BST
 * - Animated traversal: in-order, pre-order, post-order
 * - Node highlighting with visit order numbers
 * - Insert new node capability
 * - Depth control
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "@/engine/types";

interface BinaryTreeParams {
  depth: number;
  showTraversal: boolean;
  traversalType: string;
}

interface TreeNode {
  id: number;
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
  x: number;
  y: number;
}

let nodeId = 0;

function buildBalancedBST(values: number[], depth: number, x: number, y: number, spread: number): TreeNode | null {
  if (values.length === 0 || depth <= 0) return null;
  const mid = Math.floor(values.length / 2);
  const node: TreeNode = {
    id: nodeId++,
    value: values[mid],
    left: null,
    right: null,
    x,
    y,
  };
  const leftVals = values.slice(0, mid);
  const rightVals = values.slice(mid + 1);
  node.left = buildBalancedBST(leftVals, depth - 1, x - spread / 2, y + 70, spread / 2);
  node.right = buildBalancedBST(rightVals, depth - 1, x + spread / 2, y + 70, spread / 2);
  return node;
}

function getTraversalOrder(node: TreeNode | null, type: string): number[] {
  const result: number[] = [];
  function inorder(n: TreeNode | null) {
    if (!n) return;
    inorder(n.left);
    result.push(n.id);
    inorder(n.right);
  }
  function preorder(n: TreeNode | null) {
    if (!n) return;
    result.push(n.id);
    preorder(n.left);
    preorder(n.right);
  }
  function postorder(n: TreeNode | null) {
    if (!n) return;
    postorder(n.left);
    postorder(n.right);
    result.push(n.id);
  }
  if (type === "preorder") preorder(node);
  else if (type === "postorder") postorder(node);
  else inorder(node);
  return result;
}

function collectNodes(node: TreeNode | null): TreeNode[] {
  if (!node) return [];
  return [node, ...collectNodes(node.left), ...collectNodes(node.right)];
}

function collectEdges(node: TreeNode | null): { from: TreeNode; to: TreeNode }[] {
  if (!node) return [];
  const edges: { from: TreeNode; to: TreeNode }[] = [];
  if (node.left) { edges.push({ from: node, to: node.left }); edges.push(...collectEdges(node.left)); }
  if (node.right) { edges.push({ from: node, to: node.right }); edges.push(...collectEdges(node.right)); }
  return edges;
}

const TRAVERSAL_TYPES = ["inorder", "preorder", "postorder"];

export default function BinaryTreeRenderer({
  parameters,
  onUpdate,
}: RendererProps<BinaryTreeParams>) {
  const depth = parameters.depth ?? 3;
  const traversalType = parameters.traversalType ?? "inorder";

  const [root, setRoot] = useState<TreeNode | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set());
  const [visitOrder, setVisitOrder] = useState<Map<number, number>>(new Map());
  const [playing, setPlaying] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Build tree
  const buildTree = useCallback(() => {
    nodeId = 0;
    const size = Math.pow(2, depth) - 1;
    const values = Array.from({ length: size }, (_, i) => i + 1);
    const tree = buildBalancedBST(values, depth + 1, 400, 40, 380);
    setRoot(tree);
    setVisitedIds(new Set());
    setVisitOrder(new Map());
    setCurrentId(null);
    setPlaying(false);
  }, [depth]);

  useEffect(() => { buildTree(); }, [buildTree]);

  // Traversal animation
  const traversalOrder = root ? getTraversalOrder(root, traversalType) : [];

  useEffect(() => {
    if (!playing || traversalOrder.length === 0) return;
    const visited = new Set<number>();
    const orderMap = new Map<number, number>();
    let idx = 0;

    function step() {
      if (idx >= traversalOrder.length) {
        setPlaying(false);
        setCurrentId(null);
        return;
      }
      const id = traversalOrder[idx];
      visited.add(id);
      orderMap.set(id, idx + 1);
      setVisitedIds(new Set(visited));
      setVisitOrder(new Map(orderMap));
      setCurrentId(id);
      idx++;
      timerRef.current = setTimeout(step, 600);
    }
    step();
    return () => clearTimeout(timerRef.current);
  }, [playing, traversalOrder]);

  const handleStartTraversal = () => {
    setVisitedIds(new Set());
    setVisitOrder(new Map());
    setCurrentId(null);
    setPlaying(true);
  };

  const nodes = collectNodes(root);
  const edges = collectEdges(root);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 p-2">
        <svg viewBox="0 0 800 450" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Edges */}
          {edges.map((edge) => (
            <motion.line
              key={`${edge.from.id}-${edge.to.id}`}
              x1={edge.from.x} y1={edge.from.y}
              x2={edge.to.x} y2={edge.to.y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5 }}
            />
          ))}

          {/* Nodes */}
          {nodes.map((node) => {
            const isVisited = visitedIds.has(node.id);
            const isCurrent = currentId === node.id;
            const order = visitOrder.get(node.id);
            return (
              <motion.g key={node.id}>
                <motion.circle
                  cx={node.x} cy={node.y} r={20}
                  animate={{
                    fill: isCurrent ? "#f97316" : isVisited ? "#22c55e" : "#6366f1",
                    scale: isCurrent ? 1.2 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  stroke={isCurrent ? "#fb923c" : "rgba(255,255,255,0.1)"}
                  strokeWidth={isCurrent ? 3 : 1}
                />
                <text
                  x={node.x} y={node.y + 5}
                  textAnchor="middle"
                  fill="white"
                  fontSize={12}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {node.value}
                </text>
                {order && (
                  <motion.text
                    x={node.x} y={node.y - 26}
                    textAnchor="middle"
                    fill="#facc15"
                    fontSize={10}
                    fontWeight="bold"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    #{order}
                  </motion.text>
                )}
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-cyan-400">Nodes: {nodes.length}</span>
        <span className="text-purple-400">Depth: {depth}</span>
        <span className="capitalize text-indigo-400">{traversalType}</span>
        <span className="text-gray-400">
          Visited: {visitedIds.size}/{nodes.length}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={handleStartTraversal}
          disabled={playing}
          className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          ▶ Traverse
        </button>
        <button
          onClick={() => { setPlaying(false); setVisitedIds(new Set()); setVisitOrder(new Map()); setCurrentId(null); }}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>
        <button
          onClick={buildTree}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          🌲 New Tree
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {TRAVERSAL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onUpdate?.({ traversalType: t })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
              traversalType === t
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {t.replace("order", "")}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Depth
            <input
              type="range" min={1} max={5} step={1}
              value={depth}
              onChange={(e) => onUpdate?.({ depth: parseInt(e.target.value) })}
              className="h-1 w-16 accent-indigo-500"
            />
            <span className="w-4 text-right text-gray-400">{depth}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
