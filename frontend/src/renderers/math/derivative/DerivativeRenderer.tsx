/**
 * Derivative Renderer — interactive function plot with animated tangent line.
 *
 * Canvas 2D visualization.
 *
 * Features:
 * - Safe mathematical expression parser (no eval)
 * - f(x) curve with grid and axis
 * - Numerical derivative f'(x) overlay curve
 * - Animated tangent line sliding along the curve
 * - Slope value display at tangent point
 * - Critical points (where f'(x) ≈ 0) marked
 * - Mouse interaction to move tangent point
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

// ── Parameter Interface ──

interface DerivativeParams {
  expression: string;
  xMin: number;
  xMax: number;
  showTangent: boolean;
}

// ── Safe Expression Parser (self-contained) ──

type ExprFn = (x: number) => number;

function parseExpression(expr: string): ExprFn | null {
  try {
    const tokens = tokenize(expr);
    const pos = { i: 0 };
    const fn = parseAddSub(tokens, pos);
    if (pos.i < tokens.length) return null;
    return fn;
  } catch {
    return null;
  }
}

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string }
  | { type: "fn"; value: string }
  | { type: "var"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

const FUNCTIONS = new Set(["sin","cos","tan","asin","acos","atan","abs","sqrt","ln","log","exp","ceil","floor"]);
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++];
      if (FUNCTIONS.has(id)) tokens.push({ type: "fn", value: id });
      else if (id in CONSTANTS) tokens.push({ type: "num", value: CONSTANTS[id] });
      else if (id === "x" || id === "X") tokens.push({ type: "var", value: "x" });
      else throw new Error(`Unknown: ${id}`);
      continue;
    }
    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }
    if ("+-*/^".includes(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }
    throw new Error(`Unexpected: ${ch}`);
  }
  // Implicit multiplication
  const result: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    result.push(tokens[j]);
    if (j + 1 < tokens.length) {
      const c = tokens[j], n = tokens[j + 1];
      if (
        (c.type === "num" && ["var","fn","lparen","num"].includes(n.type)) ||
        (c.type === "var" && ["num","fn","lparen","var"].includes(n.type)) ||
        (c.type === "rparen" && ["num","var","fn","lparen"].includes(n.type))
      ) result.push({ type: "op", value: "*" });
    }
  }
  return result;
}

function isOp(tokens: Token[], i: number, op: string): boolean {
  return i < tokens.length && tokens[i].type === "op" && (tokens[i] as { type: "op"; value: string }).value === op;
}

function parseAddSub(tokens: Token[], pos: { i: number }): ExprFn {
  let left = parseMulDiv(tokens, pos);
  while (pos.i < tokens.length && tokens[pos.i].type === "op" &&
    ["+", "-"].includes((tokens[pos.i] as { type: "op"; value: string }).value)) {
    const op = (tokens[pos.i] as { type: "op"; value: string }).value; pos.i++;
    const right = parseMulDiv(tokens, pos);
    const l = left, r = right;
    left = op === "+" ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
  }
  return left;
}

function parseMulDiv(tokens: Token[], pos: { i: number }): ExprFn {
  let left = parsePower(tokens, pos);
  while (pos.i < tokens.length && tokens[pos.i].type === "op" &&
    ["*", "/"].includes((tokens[pos.i] as { type: "op"; value: string }).value)) {
    const op = (tokens[pos.i] as { type: "op"; value: string }).value; pos.i++;
    const right = parsePower(tokens, pos);
    const l = left, r = right;
    left = op === "*" ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
  }
  return left;
}

function parsePower(tokens: Token[], pos: { i: number }): ExprFn {
  const base = parseUnary(tokens, pos);
  if (isOp(tokens, pos.i, "^")) { pos.i++; const exp = parseUnary(tokens, pos); return (x) => Math.pow(base(x), exp(x)); }
  return base;
}

function parseUnary(tokens: Token[], pos: { i: number }): ExprFn {
  if (isOp(tokens, pos.i, "-")) { pos.i++; const inner = parseUnary(tokens, pos); return (x) => -inner(x); }
  if (isOp(tokens, pos.i, "+")) { pos.i++; return parseUnary(tokens, pos); }
  return parseAtom(tokens, pos);
}

function makeFuncFn(name: string, arg: ExprFn): ExprFn {
  const fns: Record<string, (v: number) => number> = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    abs: Math.abs, sqrt: Math.sqrt, ln: Math.log, log: Math.log10,
    exp: Math.exp, ceil: Math.ceil, floor: Math.floor,
  };
  return (x) => fns[name](arg(x));
}

function parseAtom(tokens: Token[], pos: { i: number }): ExprFn {
  const tok = tokens[pos.i];
  if (!tok) throw new Error("Unexpected end");
  if (tok.type === "num") { pos.i++; const v = tok.value; return () => v; }
  if (tok.type === "var") { pos.i++; return (x) => x; }
  if (tok.type === "fn") {
    const name = tok.value; pos.i++;
    if (tokens[pos.i]?.type !== "lparen") throw new Error("Expected (");
    pos.i++;
    const arg = parseAddSub(tokens, pos);
    if (tokens[pos.i]?.type !== "rparen") throw new Error("Expected )");
    pos.i++;
    return makeFuncFn(name, arg);
  }
  if (tok.type === "lparen") {
    pos.i++;
    const inner = parseAddSub(tokens, pos);
    if (tokens[pos.i]?.type !== "rparen") throw new Error("Expected )");
    pos.i++;
    return inner;
  }
  throw new Error(`Unexpected: ${JSON.stringify(tok)}`);
}

// ── Numerical derivative ──
function numericalDerivative(f: ExprFn, x: number, h = 1e-6): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

// ── Layout ──
const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

// ── Main Component ──

export default function DerivativeRenderer({
  parameters,
  onUpdate,
}: RendererProps<DerivativeParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const expression = parameters.expression ?? "x^3 - 3*x";
  const xMin = parameters.xMin ?? -4;
  const xMax = parameters.xMax ?? 4;
  const showTangent = parameters.showTangent ?? true;

  // Tangent point (0 to 1 normalized along x range)
  const [tangentT, setTangentT] = useState(0.5);
  const [animating, setAnimating] = useState(true);
  const animRef = useRef(0);
  const tRef = useRef(0.5);
  const dirRef = useRef(1);

  // Parse expression
  const fn = parseExpression(expression);

  // Compute y range
  const yRange = useRef({ yMin: -10, yMax: 10 });
  if (fn) {
    let minY = Infinity, maxY = -Infinity;
    for (let x = xMin; x <= xMax; x += (xMax - xMin) / 200) {
      const y = fn(x);
      if (isFinite(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    const pad = (maxY - minY) * 0.15 || 1;
    yRange.current = { yMin: minY - pad, yMax: maxY + pad };
  }

  // ── Drawing ──
  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !fn) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { w, h, dpr } = dimsRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const plotW = w - MARGIN.left - MARGIN.right;
      const plotH = h - MARGIN.top - MARGIN.bottom;
      const { yMin, yMax } = yRange.current;

      const toPixelX = (x: number) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotW;
      const toPixelY = (y: number) => MARGIN.top + plotH * (1 - (y - yMin) / (yMax - yMin));

      // ── Grid ──
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      const xStep = (xMax - xMin) / 8;
      for (let x = xMin; x <= xMax; x += xStep) {
        const px = toPixelX(x);
        ctx.beginPath(); ctx.moveTo(px, MARGIN.top); ctx.lineTo(px, h - MARGIN.bottom); ctx.stroke();
      }
      const yStep = (yMax - yMin) / 6;
      for (let y = yMin; y <= yMax; y += yStep) {
        const py = toPixelY(y);
        ctx.beginPath(); ctx.moveTo(MARGIN.left, py); ctx.lineTo(w - MARGIN.right, py); ctx.stroke();
      }

      // ── Axes ──
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      // X axis (y=0)
      if (yMin <= 0 && yMax >= 0) {
        const y0 = toPixelY(0);
        ctx.beginPath(); ctx.moveTo(MARGIN.left, y0); ctx.lineTo(w - MARGIN.right, y0); ctx.stroke();
      }
      // Y axis (x=0)
      if (xMin <= 0 && xMax >= 0) {
        const x0 = toPixelX(0);
        ctx.beginPath(); ctx.moveTo(x0, MARGIN.top); ctx.lineTo(x0, h - MARGIN.bottom); ctx.stroke();
      }

      // ── Axis labels ──
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      for (let x = xMin; x <= xMax; x += xStep) {
        ctx.fillText(x.toFixed(1), toPixelX(x), h - MARGIN.bottom + 15);
      }
      ctx.textAlign = "right";
      for (let y = yMin; y <= yMax; y += yStep) {
        ctx.fillText(y.toFixed(1), MARGIN.left - 6, toPixelY(y) + 4);
      }

      // ── f'(x) derivative curve ──
      ctx.strokeStyle = "rgba(250,204,21,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      let started = false;
      for (let px = MARGIN.left; px <= w - MARGIN.right; px += 2) {
        const x = xMin + ((px - MARGIN.left) / plotW) * (xMax - xMin);
        const dy = numericalDerivative(fn, x);
        const py = toPixelY(dy);
        if (py < MARGIN.top - 50 || py > h - MARGIN.bottom + 50) { started = false; continue; }
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // ── f(x) curve ──
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      started = false;
      for (let px = MARGIN.left; px <= w - MARGIN.right; px += 1) {
        const x = xMin + ((px - MARGIN.left) / plotW) * (xMax - xMin);
        const y = fn(x);
        const py = toPixelY(y);
        if (py < MARGIN.top - 100 || py > h - MARGIN.bottom + 100) { started = false; continue; }
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // ── Critical points (where f'(x) ≈ 0) ──
      const critXs: number[] = [];
      for (let x = xMin + 0.01; x < xMax - 0.01; x += 0.01) {
        const d1 = numericalDerivative(fn, x - 0.005);
        const d2 = numericalDerivative(fn, x + 0.005);
        if (d1 * d2 < 0) critXs.push(x);
      }
      for (const cx of critXs) {
        const py = toPixelY(fn(cx));
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(toPixelX(cx), py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(239,68,68,0.6)";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("critical", toPixelX(cx), py - 10);
      }

      // ── Tangent line ──
      if (showTangent) {
        const tx = xMin + t * (xMax - xMin);
        const ty = fn(tx);
        const slope = numericalDerivative(fn, tx);

        // Tangent line: y - ty = slope * (x - tx)
        const lineXMin = xMin - 1;
        const lineXMax = xMax + 1;
        const lineYMin = ty + slope * (lineXMin - tx);
        const lineYMax = ty + slope * (lineXMax - tx);

        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toPixelX(lineXMin), toPixelY(lineYMin));
        ctx.lineTo(toPixelX(lineXMax), toPixelY(lineYMax));
        ctx.stroke();

        // Tangent point
        const px = toPixelX(tx);
        const py = toPixelY(ty);
        // Glow
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 15);
        glow.addColorStop(0, "rgba(249,115,22,0.4)");
        glow.addColorStop(1, "rgba(249,115,22,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.fill();
        // Dot
        ctx.fillStyle = "#f97316";
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();

        // Slope label
        ctx.fillStyle = "#fb923c";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`slope = ${slope.toFixed(3)}`, px + 12, py - 12);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "11px monospace";
        ctx.fillText(`(${tx.toFixed(2)}, ${ty.toFixed(2)})`, px + 12, py + 4);
      }

      // ── Legend ──
      const legX = w - MARGIN.right - 130;
      const legY = MARGIN.top + 10;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.roundRect(legX, legY, 125, 50, 6); ctx.fill();
      ctx.font = "11px monospace";
      ctx.fillStyle = "#6366f1"; ctx.fillText("— f(x)", legX + 10, legY + 18);
      ctx.fillStyle = "rgba(250,204,21,0.7)"; ctx.fillText("--- f'(x)", legX + 10, legY + 36);
    },
    [fn, xMin, xMax, showTangent]
  );

  // ── Animation ──
  const lastRef = useRef(0);
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastRef.current) lastRef.current = timestamp;
      const dt = (timestamp - lastRef.current) / 1000;
      lastRef.current = timestamp;

      tRef.current += dirRef.current * dt * 0.15;
      if (tRef.current >= 1) { tRef.current = 1; dirRef.current = -1; }
      if (tRef.current <= 0) { tRef.current = 0; dirRef.current = 1; }

      setTangentT(tRef.current);
      draw(tRef.current);
      animRef.current = requestAnimationFrame(animate);
    },
    [draw]
  );

  useEffect(() => {
    if (animating && showTangent) {
      lastRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [animating, showTangent, animate]);

  // ── Resize ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w: width, h: height, dpr };
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      draw(tRef.current);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // ── Mouse drag to move tangent point ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (animating) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { w } = dimsRef.current;
      const plotW = w - MARGIN.left - MARGIN.right;
      const relX = e.clientX - rect.left - MARGIN.left;
      const t = Math.max(0, Math.min(1, relX / plotW));
      tRef.current = t;
      setTangentT(t);
      draw(t);
    },
    [animating, draw]
  );

  // Draw initial
  useEffect(() => { draw(tRef.current); }, [draw]);

  const tx = xMin + tangentT * (xMax - xMin);
  const ty = fn ? fn(tx) : 0;
  const slope = fn ? numericalDerivative(fn, tx) : 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0" onMouseMove={handleMouseMove}>
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-indigo-400">f(x) = {expression}</span>
        <span className="text-orange-400">slope: {slope.toFixed(3)}</span>
        <span className="text-gray-400">x: {tx.toFixed(2)}</span>
        <span className="text-gray-400">y: {ty.toFixed(2)}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setAnimating(!animating)}
          className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          {animating ? "⏸ Pause" : "▶ Animate"}
        </button>
        <button
          onClick={() => { tRef.current = 0.5; setTangentT(0.5); draw(0.5); }}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Center
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <button
          onClick={() => onUpdate?.({ showTangent: !showTangent })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showTangent ? "bg-orange-600/60 text-orange-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Tangent {showTangent ? "ON" : "OFF"}
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500 italic">
          {!animating && "Hover over graph to move tangent point"}
        </div>
      </div>
    </div>
  );
}
