/**
 * Function Graph Plotter — interactive Canvas 2D function plotter.
 *
 * Features:
 * - Safe mathematical expression parser (no eval)
 * - Supports: +, -, *, /, ^, parentheses, and common functions
 * - Functions: sin, cos, tan, abs, sqrt, ln, log, exp
 * - Constants: pi, e
 * - Adaptive grid with intelligent axis labeling
 * - Auto-scaling Y axis based on visible range
 * - Optional derivative overlay (numerical)
 * - Root / vertex / extremum annotations for polynomials
 * - Mouse hover to read coordinates
 * - Zoom & pan controls
 *
 * Expression syntax:
 *   x^2          → x squared
 *   2*x + 1      → linear
 *   sin(x)       → sine
 *   x^3 - 3*x    → cubic
 *   sqrt(abs(x)) → square root of |x|
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

// ── Parameter Interface ──────────────────────────────────────────────

interface FuncGraphParams {
  expression: string;
  xMin: number;
  xMax: number;
  color: string;
  showGrid?: boolean;
  showDerivative?: boolean;
}

// ── Safe Expression Parser ───────────────────────────────────────────

type ExprFn = (x: number) => number;

function parseExpression(expr: string): ExprFn | null {
  try {
    const tokens = tokenize(expr);
    const pos = { i: 0 };
    const fn = parseAddSub(tokens, pos);
    if (pos.i < tokens.length) return null; // unparsed tokens remain
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

const FUNCTIONS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan",
  "abs", "sqrt", "ln", "log", "exp", "ceil", "floor",
]);
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    const ch = s[i];

    // Number
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i++];
      }
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }

    // Identifier (function or variable or constant)
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        id += s[i++];
      }
      if (FUNCTIONS.has(id)) {
        tokens.push({ type: "fn", value: id });
      } else if (id in CONSTANTS) {
        tokens.push({ type: "num", value: CONSTANTS[id] });
      } else if (id === "x" || id === "X") {
        tokens.push({ type: "var", value: "x" });
      } else {
        throw new Error(`Unknown identifier: ${id}`);
      }
      continue;
    }

    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }
    if ("+-*/^".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  // Insert implicit multiplication: "2x" → "2*x", "x(" → "x*(", ")(" → ")*("
  const result: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    result.push(tokens[j]);
    if (j + 1 < tokens.length) {
      const curr = tokens[j];
      const next = tokens[j + 1];
      const needsMul =
        (curr.type === "num" && (next.type === "var" || next.type === "fn" || next.type === "lparen" || next.type === "num")) ||
        (curr.type === "var" && (next.type === "num" || next.type === "fn" || next.type === "lparen" || next.type === "var")) ||
        (curr.type === "rparen" && (next.type === "num" || next.type === "var" || next.type === "fn" || next.type === "lparen"));
      if (needsMul) {
        result.push({ type: "op", value: "*" });
      }
    }
  }
  return result;
}

// Recursive descent parser: Add/Sub → Mul/Div → Power → Unary → Atom

function isOp(tokens: Token[], i: number, op: string): boolean {
  return i < tokens.length && tokens[i].type === "op" && (tokens[i] as { type: "op"; value: string }).value === op;
}

function parseAddSub(tokens: Token[], pos: { i: number }): ExprFn {
  let left = parseMulDiv(tokens, pos);
  while (pos.i < tokens.length && tokens[pos.i].type === "op" &&
    ((tokens[pos.i] as { type: "op"; value: string }).value === "+" || (tokens[pos.i] as { type: "op"; value: string }).value === "-")) {
    const op = (tokens[pos.i] as { type: "op"; value: string }).value;
    pos.i++;
    const right = parseMulDiv(tokens, pos);
    const l = left, r = right;
    left = op === "+" ? (x: number) => l(x) + r(x) : (x: number) => l(x) - r(x);
  }
  return left;
}

function parseMulDiv(tokens: Token[], pos: { i: number }): ExprFn {
  let left = parsePower(tokens, pos);
  while (pos.i < tokens.length && tokens[pos.i].type === "op" &&
    ((tokens[pos.i] as { type: "op"; value: string }).value === "*" || (tokens[pos.i] as { type: "op"; value: string }).value === "/")) {
    const op = (tokens[pos.i] as { type: "op"; value: string }).value;
    pos.i++;
    const right = parsePower(tokens, pos);
    const l = left, r = right;
    left = op === "*" ? (x: number) => l(x) * r(x) : (x: number) => l(x) / r(x);
  }
  return left;
}

function parsePower(tokens: Token[], pos: { i: number }): ExprFn {
  const base = parseUnary(tokens, pos);
  if (isOp(tokens, pos.i, "^")) {
    pos.i++;
    const exp = parseUnary(tokens, pos);
    return (x: number) => Math.pow(base(x), exp(x));
  }
  return base;
}

function parseUnary(tokens: Token[], pos: { i: number }): ExprFn {
  if (isOp(tokens, pos.i, "-")) {
    pos.i++;
    const inner = parseUnary(tokens, pos);
    return (x: number) => -inner(x);
  }
  if (isOp(tokens, pos.i, "+")) {
    pos.i++;
    return parseUnary(tokens, pos);
  }
  return parseAtom(tokens, pos);
}

function parseAtom(tokens: Token[], pos: { i: number }): ExprFn {
  const tok = tokens[pos.i];
  if (!tok) throw new Error("Unexpected end of expression");

  // Number literal
  if (tok.type === "num") {
    pos.i++;
    const v = tok.value;
    return () => v;
  }

  // Variable x
  if (tok.type === "var") {
    pos.i++;
    return (x: number) => x;
  }

  // Function call
  if (tok.type === "fn") {
    const fname = tok.value;
    pos.i++;
    if (tokens[pos.i]?.type !== "lparen") throw new Error(`Expected ( after ${fname}`);
    pos.i++; // skip (
    const arg = parseAddSub(tokens, pos);
    if (tokens[pos.i]?.type !== "rparen") throw new Error(`Expected ) after ${fname} args`);
    pos.i++; // skip )
    return makeFuncFn(fname, arg);
  }

  // Parenthesized expression
  if (tok.type === "lparen") {
    pos.i++;
    const inner = parseAddSub(tokens, pos);
    if (tokens[pos.i]?.type !== "rparen") throw new Error("Expected )");
    pos.i++;
    return inner;
  }

  throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
}

function makeFuncFn(name: string, arg: ExprFn): ExprFn {
  const fns: Record<string, (v: number) => number> = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    abs: Math.abs, sqrt: Math.sqrt,
    ln: Math.log, log: Math.log10, exp: Math.exp,
    ceil: Math.ceil, floor: Math.floor,
  };
  const fn = fns[name];
  if (!fn) throw new Error(`Unknown function: ${name}`);
  return (x: number) => fn(arg(x));
}

// ── Numerical derivative ─────────────────────────────────────────────

function numericalDerivative(f: ExprFn, x: number): number {
  const h = 1e-7;
  return (f(x + h) - f(x - h)) / (2 * h);
}

// ── Find roots via bisection ─────────────────────────────────────────

function findRoots(f: ExprFn, xMin: number, xMax: number, steps = 500): number[] {
  const roots: number[] = [];
  const dx = (xMax - xMin) / steps;
  for (let i = 0; i < steps; i++) {
    const a = xMin + i * dx;
    const b = a + dx;
    const fa = f(a);
    const fb = f(b);
    if (!isFinite(fa) || !isFinite(fb)) continue;
    if (fa * fb <= 0) {
      // Bisection
      let lo = a, hi = b;
      for (let j = 0; j < 50; j++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (!isFinite(fm)) break;
        if (Math.abs(fm) < 1e-12) { lo = hi = mid; break; }
        if (fa * fm < 0) hi = mid;
        else lo = mid;
      }
      const root = (lo + hi) / 2;
      // Deduplicate
      if (roots.length === 0 || Math.abs(root - roots[roots.length - 1]) > dx * 2) {
        roots.push(root);
      }
    }
  }
  return roots;
}

// ── Find extrema (where derivative changes sign) ─────────────────────

function findExtrema(f: ExprFn, xMin: number, xMax: number, steps = 500): { x: number; y: number; type: "min" | "max" }[] {
  const extrema: { x: number; y: number; type: "min" | "max" }[] = [];
  const dx = (xMax - xMin) / steps;
  for (let i = 1; i < steps - 1; i++) {
    const x0 = xMin + (i - 1) * dx;
    const x1 = xMin + i * dx;
    const x2 = xMin + (i + 1) * dx;
    const d0 = numericalDerivative(f, x0);
    const d1 = numericalDerivative(f, x1);
    if (!isFinite(d0) || !isFinite(d1)) continue;
    if (d0 * d1 < 0) {
      // Refine via bisection on derivative
      let lo = x0, hi = x1;
      for (let j = 0; j < 40; j++) {
        const mid = (lo + hi) / 2;
        const dm = numericalDerivative(f, mid);
        if (d0 * dm < 0) hi = mid;
        else lo = mid;
      }
      const ex = (lo + hi) / 2;
      const ey = f(ex);
      if (!isFinite(ey)) continue;
      const type = d0 > 0 ? "max" : "min";
      if (extrema.length === 0 || Math.abs(ex - extrema[extrema.length - 1].x) > dx * 2) {
        extrema.push({ x: ex, y: ey, type });
      }
    }
  }
  return extrema;
}

// ── Layout Constants ─────────────────────────────────────────────────

const MARGIN = { top: 30, right: 30, bottom: 55, left: 60 };

// ── Main Component ───────────────────────────────────────────────────

export default function FunctionGraphRenderer({
  parameters,
  onUpdate,
}: RendererProps<FuncGraphParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Extract parameters with safe defaults
  const expression = parameters.expression ?? "x^2";
  const xMin = parameters.xMin ?? -10;
  const xMax = parameters.xMax ?? 10;
  const color = parameters.color ?? "#3b82f6";
  const showGrid = parameters.showGrid ?? true;
  const showDerivative = parameters.showDerivative ?? false;

  // ── Parse Expression ─────────────────────────────────────────────

  const parsed = useMemo(() => {
    const fn = parseExpression(expression);
    if (!fn) return { fn: null, error: `Cannot parse: "${expression}"`, roots: [], extrema: [] };

    const roots = findRoots(fn, xMin, xMax);
    const extrema = findExtrema(fn, xMin, xMax);
    return { fn, error: null, roots, extrema };
  }, [expression, xMin, xMax]);

  const { fn, error, roots, extrema } = parsed;

  // ── Auto-scale Y ─────────────────────────────────────────────────

  const yRange = useMemo(() => {
    if (!fn) return { yMin: -10, yMax: 10 };
    let yMin = Infinity, yMax = -Infinity;
    const steps = 500;
    const dx = (xMax - xMin) / steps;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * dx;
      const y = fn(x);
      if (!isFinite(y) || Math.abs(y) > 1e6) continue;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
    if (!isFinite(yMin) || !isFinite(yMax)) return { yMin: -10, yMax: 10 };
    const pad = Math.max((yMax - yMin) * 0.15, 1);
    return { yMin: yMin - pad, yMax: yMax + pad };
  }, [fn, xMin, xMax]);

  const { yMin, yMax } = yRange;

  // ── Canvas Sizing ────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 1 || h < 1) return;
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w, h, dpr };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, []);

  // ── Canvas Render ────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    if (w < 10 || h < 10) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── Background ────────────────────────────────────────────

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#0b1120");
    bgGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Coordinate System ─────────────────────────────────────

    const plotW = w - MARGIN.left - MARGIN.right;
    const plotH = h - MARGIN.top - MARGIN.bottom;
    if (plotW < 20 || plotH < 20) return;

    const xRange = xMax - xMin;
    const yRng = yMax - yMin;
    const xScale = plotW / xRange;
    const yScale = plotH / yRng;

    const toScreen = (x: number, y: number) => ({
      sx: MARGIN.left + (x - xMin) * xScale,
      sy: MARGIN.top + (yMax - y) * yScale,
    });

    const fromScreen = (sx: number, sy: number) => ({
      x: xMin + (sx - MARGIN.left) / xScale,
      y: yMax - (sy - MARGIN.top) / yScale,
    });

    // ── Grid ──────────────────────────────────────────────────

    if (showGrid) {
      const niceStep = (range: number, targetLines: number): number => {
        if (range <= 0) return 1;
        const rough = range / targetLines;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const norm = rough / mag;
        if (norm < 1.5) return mag;
        if (norm < 3.5) return 2 * mag;
        if (norm < 7.5) return 5 * mag;
        return 10 * mag;
      };

      const stepX = niceStep(xRange, 8);
      const stepY = niceStep(yRng, 6);
      const labelFmt = (v: number) =>
        Math.abs(v) >= 1000
          ? `${(v / 1000).toFixed(1)}k`
          : Math.abs(v) >= 1
          ? v.toFixed(Math.abs(v - Math.round(v)) < 0.001 ? 0 : 1)
          : v.toFixed(2);

      ctx.font = "10px monospace";

      // Vertical grid lines + X labels
      const xStart = Math.ceil(xMin / stepX) * stepX;
      for (let gx = xStart; gx <= xMax + stepX * 0.01; gx += stepX) {
        const { sx } = toScreen(gx, 0);
        if (sx < MARGIN.left - 1 || sx > w - MARGIN.right + 1) continue;
        const isAxis = Math.abs(gx) < stepX * 0.01;
        ctx.strokeStyle = isAxis ? "#475569" : "#1e293b";
        ctx.lineWidth = isAxis ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, MARGIN.top);
        ctx.lineTo(sx, h - MARGIN.bottom);
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText(labelFmt(gx), sx, h - MARGIN.bottom + 14);
      }

      // Horizontal grid lines + Y labels
      const yStart = Math.ceil(yMin / stepY) * stepY;
      for (let gy = yStart; gy <= yMax + stepY * 0.01; gy += stepY) {
        const { sy } = toScreen(0, gy);
        if (sy < MARGIN.top - 1 || sy > h - MARGIN.bottom + 1) continue;
        const isAxis = Math.abs(gy) < stepY * 0.01;
        ctx.strokeStyle = isAxis ? "#475569" : "#1e293b";
        ctx.lineWidth = isAxis ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, sy);
        ctx.lineTo(w - MARGIN.right, sy);
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "right";
        ctx.fillText(labelFmt(gy), MARGIN.left - 8, sy + 3);
      }
    }

    // ── Axes ──────────────────────────────────────────────────

    // X axis (y=0)
    if (yMin <= 0 && yMax >= 0) {
      const { sy } = toScreen(0, 0);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, sy);
      ctx.lineTo(w - MARGIN.right, sy);
      ctx.stroke();
    }

    // Y axis (x=0)
    if (xMin <= 0 && xMax >= 0) {
      const { sx } = toScreen(0, 0);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, MARGIN.top);
      ctx.lineTo(sx, h - MARGIN.bottom);
      ctx.stroke();
    }

    // ── Plot Function ──────────────────────────────────────────

    if (fn) {
      const steps = Math.max(plotW * 2, 500);
      const dx = xRange / steps;

      // Glow
      ctx.strokeStyle = color + "30";
      ctx.lineWidth = 6;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + i * dx;
        const y = fn(x);
        if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
        const { sx, sy } = toScreen(x, y);
        if (sy < -50 || sy > h + 50) { started = false; continue; }
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Main line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      started = false;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + i * dx;
        const y = fn(x);
        if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
        const { sx, sy } = toScreen(x, y);
        if (sy < -50 || sy > h + 50) { started = false; continue; }
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // ── Derivative overlay ────────────────────────────────────

      if (showDerivative) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        started = false;
        for (let i = 0; i <= steps; i++) {
          const x = xMin + i * dx;
          const dy = numericalDerivative(fn, x);
          if (!isFinite(dy) || Math.abs(dy) > 1e6) { started = false; continue; }
          const { sx, sy } = toScreen(x, dy);
          if (sy < -50 || sy > h + 50) { started = false; continue; }
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Derivative label
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText("f'(x)", w - MARGIN.right - 40, MARGIN.top + 16);
      }

      // ── Root markers ──────────────────────────────────────────

      for (const root of roots) {
        const { sx, sy } = toScreen(root, 0);
        if (sx < MARGIN.left || sx > w - MARGIN.right) continue;

        // Circle
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(239,68,68,0.3)";
        ctx.fill();

        // Label
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`x=${root.toFixed(2)}`, sx, sy + 18);
      }

      // ── Extrema markers ───────────────────────────────────────

      for (const ext of extrema) {
        const { sx, sy } = toScreen(ext.x, ext.y);
        if (sx < MARGIN.left || sx > w - MARGIN.right) continue;
        if (sy < MARGIN.top || sy > h - MARGIN.bottom) continue;

        const markerColor = ext.type === "max" ? "#22c55e" : "#8b5cf6";

        // Diamond marker
        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 6);
        ctx.lineTo(sx + 5, sy);
        ctx.lineTo(sx, sy + 6);
        ctx.lineTo(sx - 5, sy);
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = markerColor;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        const labelY = ext.type === "max" ? sy - 12 : sy + 16;
        ctx.fillText(
          `${ext.type === "max" ? "Max" : "Min"}(${ext.x.toFixed(1)}, ${ext.y.toFixed(1)})`,
          sx, labelY
        );
      }
    }

    // ── Expression Label ──────────────────────────────────────────

    ctx.fillStyle = color;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`f(x) = ${expression}`, MARGIN.left + 8, MARGIN.top + 16);

    // ── Error message ─────────────────────────────────────────────

    if (error) {
      ctx.fillStyle = "rgba(239,68,68,0.8)";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(error, w / 2, h / 2);
    }

    // ── Mouse hover coordinate ────────────────────────────────────

    if (mousePos && fn) {
      const mp = fromScreen(mousePos.x, mousePos.y);
      if (mp.x >= xMin && mp.x <= xMax) {
        const fy = fn(mp.x);
        if (isFinite(fy)) {
          const { sx, sy } = toScreen(mp.x, fy);

          // Crosshair
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "rgba(148,163,184,0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, MARGIN.top);
          ctx.lineTo(sx, h - MARGIN.bottom);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(MARGIN.left, sy);
          ctx.lineTo(w - MARGIN.right, sy);
          ctx.stroke();
          ctx.setLineDash([]);

          // Point on curve
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();

          // Coordinate tooltip
          const label = `(${mp.x.toFixed(2)}, ${fy.toFixed(2)})`;
          ctx.font = "11px monospace";
          const tw = ctx.measureText(label).width;
          const tx = Math.min(sx + 10, w - tw - 20);
          const ty = Math.max(sy - 12, MARGIN.top + 16);
          ctx.fillStyle = "rgba(15,23,42,0.9)";
          roundRect(ctx, tx - 4, ty - 12, tw + 8, 16, 4);
          ctx.fill();
          ctx.fillStyle = "#e2e8f0";
          ctx.fillText(label, tx, ty);
        }
      }
    }
  }, [fn, error, xMin, xMax, yMin, yMax, color, showGrid, showDerivative, expression, roots, extrema, mousePos]);

  // ── Render on changes ────────────────────────────────────────────

  useEffect(() => {
    render();
  }, [render]);

  // ── Mouse tracking ───────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => setMousePos(null), []);

  // ── Zoom controls ────────────────────────────────────────────────

  const zoom = (factor: number) => {
    const cx = (xMin + xMax) / 2;
    const halfW = ((xMax - xMin) / 2) * factor;
    const newXMin = Math.max(cx - halfW, -1000);
    const newXMax = Math.min(cx + halfW, 1000);
    if (newXMax - newXMin < 0.1) return;
    onUpdate?.({ xMin: Math.round(newXMin * 100) / 100, xMax: Math.round(newXMax * 100) / 100 });
  };

  const resetZoom = () => onUpdate?.({ xMin: -10, xMax: 10 });

  // ── Preset expressions ───────────────────────────────────────────

  const presets = [
    { label: "x²", expr: "x^2" },
    { label: "sin(x)", expr: "sin(x)" },
    { label: "x³−3x", expr: "x^3-3*x" },
    { label: "1/x", expr: "1/x" },
    { label: "√x", expr: "sqrt(x)" },
  ];

  // ── Render JSX ─────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* ── Controls Panel ──────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-700/50 bg-gray-900/90 px-4 py-2.5">
        {/* Row 1: Expression input + zoom */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono text-blue-400">f(x) =</span>
            <input
              type="text"
              value={expression}
              onChange={(e) => onUpdate?.({ expression: e.target.value })}
              className="w-48 rounded-lg border border-gray-600/50 bg-gray-800 px-2.5 py-1 font-mono text-xs text-white outline-none focus:border-blue-500"
              placeholder="e.g. x^2, sin(x)"
            />
          </label>

          <div className="flex gap-1">
            {presets.map((p) => (
              <button
                key={p.expr}
                onClick={() => onUpdate?.({ expression: p.expr })}
                className={`rounded px-2 py-0.5 text-[10px] font-mono transition-colors ${
                  expression === p.expr
                    ? "bg-blue-600/30 text-blue-300 ring-1 ring-blue-500/40"
                    : "bg-gray-800/50 text-gray-500 hover:bg-gray-700/50 hover:text-gray-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <input
                type="checkbox"
                checked={showDerivative}
                onChange={(e) => onUpdate?.({ showDerivative: e.target.checked })}
                className="accent-amber-500"
              />
              f'(x)
            </label>
            <div className="mx-1 h-5 w-px bg-gray-700" />
            <button
              onClick={() => zoom(0.5)}
              className="rounded bg-gray-800/50 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-gray-700/50"
            >
              Zoom In
            </button>
            <button
              onClick={() => zoom(2)}
              className="rounded bg-gray-800/50 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-gray-700/50"
            >
              Zoom Out
            </button>
            <button
              onClick={resetZoom}
              className="rounded bg-gray-800/50 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-gray-700/50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Row 2: Domain sliders + info */}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span>Domain:</span>
            <input
              type="range"
              min={-100}
              max={0}
              step={0.5}
              value={xMin}
              onChange={(e) => onUpdate?.({ xMin: Number(e.target.value) })}
              className="h-1.5 w-24 accent-blue-500"
            />
            <span className="w-10 font-mono text-blue-400">{xMin}</span>
            <span className="text-gray-600">to</span>
            <input
              type="range"
              min={0.1}
              max={100}
              step={0.5}
              value={xMax}
              onChange={(e) => onUpdate?.({ xMax: Number(e.target.value) })}
              className="h-1.5 w-24 accent-blue-500"
            />
            <span className="w-10 font-mono text-blue-400">{xMax}</span>
          </div>

          {/* Annotations */}
          {roots.length > 0 && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-500">Roots:</span>
              {roots.slice(0, 4).map((r, i) => (
                <span key={i} className="rounded bg-red-900/30 px-1 py-0.5 font-mono text-red-400">
                  {r.toFixed(2)}
                </span>
              ))}
            </div>
          )}
          {extrema.length > 0 && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-500">Extrema:</span>
              {extrema.slice(0, 3).map((e, i) => (
                <span
                  key={i}
                  className={`rounded px-1 py-0.5 font-mono ${
                    e.type === "max" ? "bg-green-900/30 text-green-400" : "bg-purple-900/30 text-purple-400"
                  }`}
                >
                  {e.type === "max" ? "↑" : "↓"}{e.y.toFixed(1)}
                </span>
              ))}
            </div>
          )}
          {error && (
            <span className="text-[10px] text-red-400">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Drawing Utilities
// ══════════════════════════════════════════════════════════════════════

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
