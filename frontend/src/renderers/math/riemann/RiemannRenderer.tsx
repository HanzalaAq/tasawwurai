/**
 * Riemann Sums Renderer — visual integration with rectangles.
 *
 * Canvas 2D (redrawn on parameter change with a short reveal animation).
 *
 * Features:
 * - Safe expression parser (same function set as the function graph renderer)
 * - Left / right / midpoint rectangle rules
 * - Live Riemann sum vs exact integral (composite Simpson's rule)
 * - Error percentage readout
 * - Rectangle count slider from 1 to 100 showing convergence
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface RiemannParams {
  expression: string;
  n: number;
  method: string;
  xMin: number;
  xMax: number;
}

// ── Safe expression compiler ──────────────────────────────────────────

const FN_NAMES = ["asin", "acos", "atan", "sqrt", "sinh", "cosh", "tanh", "sin", "cos", "tan", "abs", "exp", "ln", "log"];

function compileExpression(expr: string): ((x: number) => number) | null {
  const cleaned = expr.replace(/\s+/g, "").replace(/\^/g, "**");
  if (!cleaned) return null;
  // Strip whitelisted function and constant names, then verify leftovers
  let stripped = cleaned;
  for (const fn of FN_NAMES) stripped = stripped.split(fn).join("#");
  stripped = stripped.split("pi").join("#").split("PI").join("#");
  // 'e' as Euler's number only when standing alone
  stripped = stripped.replace(/(?<![a-z0-9#])e(?![a-z0-9#])/gi, "#");
  if (!/^[0-9x+\-*/().#]+$/.test(stripped)) return null;
  try {
    const f = new Function(
      "x",
      `"use strict";
       const {sin,cos,tan,asin,acos,atan,abs,sqrt,exp}=Math, ln=Math.log, log=Math.log10, pi=Math.PI, e=Math.E;
       return (${cleaned});`
    );
    const probe = f(1.234);
    if (typeof probe !== "number" || Number.isNaN(probe)) return null;
    return f as (x: number) => number;
  } catch {
    return null;
  }
}

// ── Numeric integration ───────────────────────────────────────────────

function simpson(f: (x: number) => number, a: number, b: number, n = 1000): number {
  if (n % 2 === 1) n += 1;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    s += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return (h / 3) * s;
}

export default function RiemannRenderer({
  parameters,
  onUpdate,
}: RendererProps<RiemannParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });
  const revealRef = useRef(1);

  const rawExpr = parameters.expression ?? "x^2";
  const n = Math.round(parameters.n ?? 8);
  const method = ["left", "right", "midpoint"].includes(parameters.method as string)
    ? (parameters.method as "left" | "right" | "midpoint")
    : "left";
  const xMinParam = parameters.xMin ?? 0;
  const xMaxParam = parameters.xMax ?? 2;
  const [xMin, xMax] = xMaxParam > xMinParam ? [xMinParam, xMaxParam] : [xMinParam, xMinParam + 1];

  const fn = compileExpression(rawExpr) ?? ((x: number) => x * x);
  const [validExpr, setValidExpr] = useState(true);
  useEffect(() => {
    setValidExpr(compileExpression(rawExpr) !== null);
  }, [rawExpr]);

  // Riemann sum
  const dx = (xMax - xMin) / n;
  const sum = (() => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const x =
        method === "left" ? xMin + i * dx
        : method === "right" ? xMin + (i + 1) * dx
        : xMin + (i + 0.5) * dx;
      s += fn(x) * dx;
    }
    return s;
  })();
  const exact = simpson(fn, xMin, xMax);
  const errorPct = exact !== 0 ? ((sum - exact) / exact) * 100 : 0;

  // ── Drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const padL = 46, padR = 20, padT = 20, padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Y range
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const y = fn(xMin + ((xMax - xMin) * i) / 200);
      if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
    }
    if (!isFinite(yMin) || !isFinite(yMax)) { yMin = -1; yMax = 1; }
    if (yMax - yMin < 1e-6) { yMax += 1; yMin -= 1; }
    const yPad = (yMax - yMin) * 0.15;
    yMin -= yPad; yMax += yPad;
    if (yMin > 0 && yMin < 1) yMin = 0; // include axis when close
    if (yMax < 0 && yMax > -1) yMax = 0;

    const xToPx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const yToPx = (y: number) => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // Grid + ticks
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const niceStep = (range: number) => {
      const rough = range / 8;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const norm = rough / mag;
      return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
    };
    const xStep = niceStep(xMax - xMin);
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.textAlign = "center";
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      ctx.beginPath();
      ctx.moveTo(xToPx(x), padT);
      ctx.lineTo(xToPx(x), padT + plotH);
      ctx.stroke();
      ctx.fillText(x.toFixed(Math.abs(xStep) < 1 ? 2 : 0), xToPx(x), h - 12);
    }

    // Axes (if 0 in range)
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    if (yMin <= 0 && yMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(padL, yToPx(0));
      ctx.lineTo(padL + plotW, yToPx(0));
      ctx.stroke();
    }
    if (xMin <= 0 && xMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(xToPx(0), padT);
      ctx.lineTo(xToPx(0), padT + plotH);
      ctx.stroke();
    }

    // ── Rectangles (animated reveal) ──
    const reveal = revealRef.current;
    const shown = Math.max(1, Math.floor(n * reveal));
    for (let i = 0; i < shown; i++) {
      const x =
        method === "left" ? xMin + i * dx
        : method === "right" ? xMin + (i - 1) * dx + dx
        : xMin + (i - 0.5) * dx;
      const x0 = Math.max(xMin, Math.min(x, xMax));
      const sampleX =
        method === "left" ? xMin + i * dx
        : method === "right" ? xMin + (i + 1) * dx
        : xMin + (i + 0.5) * dx;
      const y = fn(sampleX);
      if (!isFinite(y)) continue;

      const rx = xToPx(x0);
      const rw = (dx / (xMax - xMin)) * plotW * (method === "right" ? 1 : 1);
      const ry = yToPx(y);
      const zeroY = yToPx(0);

      const alpha = 0.18 + (i / Math.max(shown, 1)) * 0.12;
      ctx.fillStyle = y >= 0 ? `rgba(59,130,246,${alpha})` : `rgba(249,115,22,${alpha})`;
      ctx.strokeStyle = y >= 0 ? "rgba(96,165,250,0.7)" : "rgba(251,146,60,0.7)";
      ctx.lineWidth = 1;
      const rectY = Math.min(ry, zeroY);
      const rectH = Math.abs(zeroY - ry);
      ctx.beginPath();
      ctx.rect(rx, rectY, Math.max(rw - 0.5, 0.5), rectH);
      ctx.fill();
      ctx.stroke();
    }

    // ── Curve ──
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 300; i++) {
      const x = xMin + ((xMax - xMin) * i) / 300;
      const y = fn(x);
      if (!isFinite(y) || yToPx(y) < -200 || yToPx(y) > h + 200) { started = false; continue; }
      if (!started) { ctx.moveTo(xToPx(x), yToPx(y)); started = true; }
      else ctx.lineTo(xToPx(x), yToPx(y));
    }
    ctx.stroke();

    // ── Readout chip ──
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w - 236, 14, 222, 62, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`Σ = ${sum.toFixed(4)}`, w - 222, 34);
    ctx.fillStyle = "#34d399";
    ctx.fillText(`∫ = ${exact.toFixed(4)}`, w - 222, 51);
    ctx.fillStyle = Math.abs(errorPct) < 1 ? "#4ade80" : "#fbbf24";
    ctx.font = "10px monospace";
    ctx.fillText(`error: ${errorPct >= 0 ? "+" : ""}${errorPct.toFixed(2)}%`, w - 222, 67);
  }, [fn, n, method, xMin, xMax, sum, exact, errorPct]);

  // ── Reveal animation on parameter change ──
  useEffect(() => {
    revealRef.current = 0;
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / 450, 1);
      revealRef.current = t * t; // ease-in
      draw();
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [fn, n, method, xMin, xMax, draw]);

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
      draw();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-blue-400">n = {n}</span>
        <span className="text-blue-300">{method} sum: {sum.toFixed(4)}</span>
        <span className="text-emerald-400">exact: {exact.toFixed(4)}</span>
        <span className={Math.abs(errorPct) < 1 ? "text-green-400" : "text-yellow-400"}>
          error: {errorPct >= 0 ? "+" : ""}{errorPct.toFixed(2)}%
        </span>
        {!validExpr && <span className="text-red-400">invalid expression — using x²</span>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        {(["left", "right", "midpoint"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onUpdate?.({ method: m })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
              method === m ? "bg-blue-600/60 text-blue-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {m}
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          n
          <input
            type="range" min={1} max={100} step={1}
            value={n}
            onChange={(e) => onUpdate?.({ n: parseInt(e.target.value, 10) })}
            className="h-1 w-24 accent-blue-500"
          />
          <span className="w-8 text-right text-gray-400">{n}</span>
        </label>

        <input
          type="text"
          value={rawExpr}
          onChange={(e) => onUpdate?.({ expression: e.target.value })}
          spellCheck={false}
          className={`w-32 rounded border bg-gray-800/60 px-2 py-1 font-mono text-xs focus:outline-none ${
            validExpr ? "border-gray-600/50 text-gray-200 focus:border-blue-500" : "border-red-500/50 text-red-300"
          }`}
          placeholder="x^2"
        />

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1 text-xs text-gray-500">
          xMin
          <input
            type="number" step={0.5} value={xMin}
            onChange={(e) => onUpdate?.({ xMin: parseFloat(e.target.value) || 0 })}
            className="w-16 rounded border border-gray-600/50 bg-gray-800/60 px-1.5 py-1 font-mono text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          xMax
          <input
            type="number" step={0.5} value={xMax}
            onChange={(e) => onUpdate?.({ xMax: parseFloat(e.target.value) || 1 })}
            className="w-16 rounded border border-gray-600/50 bg-gray-800/60 px-1.5 py-1 font-mono text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}
