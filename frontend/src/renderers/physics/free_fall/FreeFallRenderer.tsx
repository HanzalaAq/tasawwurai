/**
 * Free Fall Renderer — interactive falling-object simulation.
 *
 * Canvas 2D with requestAnimationFrame animation loop.
 *
 * Features:
 * - Physically correct kinematics with optional linear drag
 * - Real-time position, velocity, and acceleration readouts
 * - Ghost trail showing object at equal time intervals
 * - Ground impact detection and bounce (optional)
 * - Planet gravity presets (Earth, Moon, Mars)
 * - Mini-graphs: height(t) and velocity(t) overlaid
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

// ── Parameter Interface ──────────────────────────────────────────────

interface FreeFallParams {
  height: number;
  gravity: number;
  airResistance: number;
  mass: number;
}

// ── Gravity Presets ──────────────────────────────────────────────────

const GRAVITY_PRESETS: { label: string; g: number; emoji: string }[] = [
  { label: "Earth", g: 9.81, emoji: "🌍" },
  { label: "Moon", g: 1.62, emoji: "🌙" },
  { label: "Mars", g: 3.72, emoji: "🔴" },
];

// ── Layout Constants ─────────────────────────────────────────────────

const MARGIN = { top: 30, right: 30, bottom: 60, left: 60 };
const GHOST_COUNT = 8;
const BALL_RADIUS = 10;

// ── Simulation State ─────────────────────────────────────────────────

interface SimSnapshot {
  y: number; // height above ground (m)
  v: number; // velocity (m/s, positive downward)
  a: number; // acceleration (m/s²)
  t: number; // elapsed time (s)
  landed: boolean;
}

// ── Main Component ───────────────────────────────────────────────────

export default function FreeFallRenderer({
  parameters,
  onUpdate,
}: RendererProps<FreeFallParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  // Extract parameters with safe defaults
  const height = parameters.height ?? 100;
  const gravity = parameters.gravity ?? 9.81;
  const airResistance = parameters.airResistance ?? 0;
  const mass = parameters.mass ?? 1;

  // Simulation state
  const [playing, setPlaying] = useState(false);
  const [landed, setLanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentVel, setCurrentVel] = useState(0);
  const [currentHeight, setCurrentHeight] = useState(height);
  const [currentAcc, setCurrentAcc] = useState(gravity);

  // Trail history for ghost rendering
  const trailRef = useRef<SimSnapshot[]>([]);
  const lastGhostRef = useRef(0);

  // Graph history
  const graphRef = useRef<{ t: number; h: number; v: number }[]>([]);

  // ── Compute total fall time (no drag) ──
  const totalTime = Math.sqrt((2 * height) / gravity);

  // ── Physics Step ──
  const physicsStep = useCallback(
    (dt: number, snap: SimSnapshot): SimSnapshot => {
      // a = g - (k/m) * v   (linear drag opposing motion)
      const drag = airResistance * snap.v;
      const a = gravity - drag / mass;
      const v = snap.v + a * dt;
      const y = snap.y - v * dt; // y decreases as object falls
      const landed = y <= 0;
      return {
        y: landed ? 0 : y,
        v: landed ? 0 : v,
        a: landed ? 0 : a,
        t: snap.t + dt,
        landed,
      };
    },
    [gravity, airResistance, mass]
  );

  // ── Drawing ──
  const draw = useCallback(
    (snap: SimSnapshot) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { w, h, dpr } = dimsRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const plotW = w - MARGIN.left - MARGIN.right;
      const plotH = h - MARGIN.top - MARGIN.bottom;

      // Scale: map [0, height] meters to [plotH, 0] pixels
      const yToPixel = (meters: number) =>
        MARGIN.top + plotH * (1 - meters / height);

      // ── Background grid ──
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      const gridStep = height / 5;
      for (let m = 0; m <= height; m += gridStep) {
        const py = yToPixel(m);
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, py);
        ctx.lineTo(w - MARGIN.right, py);
        ctx.stroke();
      }

      // ── Ground line ──
      const groundY = yToPixel(0);
      ctx.strokeStyle = "rgba(139,92,246,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, groundY);
      ctx.lineTo(w - MARGIN.right, groundY);
      ctx.stroke();
      // Hatching
      ctx.strokeStyle = "rgba(139,92,246,0.25)";
      ctx.lineWidth = 1;
      for (let x = MARGIN.left; x < w - MARGIN.right; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + 8, groundY + 8);
        ctx.stroke();
      }

      // ── Height axis labels ──
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      for (let m = 0; m <= height; m += gridStep) {
        const py = yToPixel(m);
        ctx.fillText(`${m.toFixed(0)}m`, MARGIN.left - 8, py + 4);
      }

      // ── Drop column center X ──
      const cx = MARGIN.left + plotW * 0.4;

      // ── Ghost trail ──
      const trail = trailRef.current;
      for (let i = 0; i < trail.length; i++) {
        const alpha = 0.08 + (i / trail.length) * 0.2;
        const py = yToPixel(trail[i].y);
        ctx.beginPath();
        ctx.arc(cx, py, BALL_RADIUS - 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${alpha})`;
        ctx.fill();
      }

      // ── Motion trail (gradient) ──
      if (trail.length > 1) {
        const last = trail[trail.length - 1];
        const pyStart = yToPixel(trail[0].y);
        const pyEnd = yToPixel(last.y);
        const grad = ctx.createLinearGradient(cx, pyStart, cx, pyEnd);
        grad.addColorStop(0, "rgba(99,102,241,0)");
        grad.addColorStop(1, "rgba(99,102,241,0.5)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, pyStart);
        ctx.lineTo(cx, pyEnd);
        ctx.stroke();
      }

      // ── Ball ──
      const ballY = yToPixel(snap.y);
      // Glow
      const glow = ctx.createRadialGradient(cx, ballY, 0, cx, ballY, BALL_RADIUS * 3);
      glow.addColorStop(0, "rgba(99,102,241,0.3)");
      glow.addColorStop(1, "rgba(99,102,241,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, ballY, BALL_RADIUS * 3, 0, Math.PI * 2);
      ctx.fill();
      // Body
      const bodyGrad = ctx.createRadialGradient(cx - 3, ballY - 3, 0, cx, ballY, BALL_RADIUS);
      bodyGrad.addColorStop(0, "#818cf8");
      bodyGrad.addColorStop(1, "#4f46e5");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // ── Velocity arrow ──
      if (snap.v > 0.5) {
        const arrowLen = Math.min(snap.v * 3, plotH * 0.3);
        const ax = cx + 25;
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ax, ballY);
        ctx.lineTo(ax, ballY + arrowLen);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.moveTo(ax, ballY + arrowLen + 6);
        ctx.lineTo(ax - 5, ballY + arrowLen - 2);
        ctx.lineTo(ax + 5, ballY + arrowLen - 2);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.fillStyle = "#fb923c";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`v = ${snap.v.toFixed(1)} m/s`, ax + 10, ballY + arrowLen / 2 + 4);
      }

      // ── Mini-graphs (right side) ──
      const graphX = MARGIN.left + plotW * 0.65;
      const graphW = plotW * 0.33;
      const graphH = plotH * 0.4;
      const graphData = graphRef.current;

      // Height graph
      drawMiniGraph(ctx, graphX, MARGIN.top + 10, graphW, graphH,
        graphData, "h", height, "#22d3ee", "Height (m)");

      // Velocity graph
      drawMiniGraph(ctx, graphX, MARGIN.top + graphH + 30, graphW, graphH,
        graphData, "v", Math.sqrt(2 * gravity * height) * 1.1, "#f97316", "Velocity (m/s)");
    },
    [height, gravity]
  );

  // ── Mini Graph Helper ──
  function drawMiniGraph(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    data: { t: number; h: number; v: number }[],
    key: "h" | "v",
    maxVal: number,
    color: string,
    label: string,
  ) {
    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 6, y + 14);

    if (data.length < 2) return;

    const maxT = Math.max(data[data.length - 1].t, 0.1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = x + 4 + ((w - 8) * data[i].t) / maxT;
      const py = y + h - 6 - ((h - 20) * data[i][key]) / maxVal;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // ── Animation Loop ──
  const lastTimeRef = useRef(0);

  const animate = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      // Get latest snapshot
      const trail = trailRef.current;
      const last = trail.length > 0
        ? trail[trail.length - 1]
        : { y: height, v: 0, a: gravity, t: 0, landed: false };

      if (last.landed) {
        setLanded(true);
        setPlaying(false);
        return;
      }

      const next = physicsStep(dt, last);

      // Record ghost at intervals
      const ghostInterval = totalTime / GHOST_COUNT;
      if (next.t - lastGhostRef.current >= ghostInterval) {
        trail.push({ ...next });
        lastGhostRef.current = next.t;
        if (trail.length > GHOST_COUNT) trail.shift();
      }

      // Record graph data
      graphRef.current.push({ t: next.t, h: next.y, v: next.v });
      if (graphRef.current.length > 200) graphRef.current.shift();

      // Update React state (throttled via rAF)
      setCurrentTime(next.t);
      setCurrentVel(next.v);
      setCurrentHeight(next.y);
      setCurrentAcc(next.a);

      draw(next);
      animRef.current = requestAnimationFrame(animate);
    },
    [height, gravity, physicsStep, draw, totalTime]
  );

  // ── Start/Stop ──
  useEffect(() => {
    if (playing) {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, animate]);

  // ── Resize Observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height: h } = entries[0].contentRect;
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w: width, h, dpr };
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${h}px`;
      }
      // Redraw current state
      const trail = trailRef.current;
      const snap = trail.length > 0
        ? trail[trail.length - 1]
        : { y: height, v: 0, a: gravity, t: 0, landed: false };
      draw(snap);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [height, gravity, draw]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    setLanded(false);
    setCurrentTime(0);
    setCurrentVel(0);
    setCurrentHeight(height);
    setCurrentAcc(gravity);
    trailRef.current = [];
    lastGhostRef.current = 0;
    graphRef.current = [];
    // Draw initial state
    setTimeout(() => draw({ y: height, v: 0, a: gravity, t: 0, landed: false }), 0);
  }, [height, gravity, draw]);

  // ── Step forward ──
  const handleStep = useCallback(() => {
    const trail = trailRef.current;
    const last = trail.length > 0
      ? trail[trail.length - 1]
      : { y: height, v: 0, a: gravity, t: 0, landed: false };
    if (last.landed) return;
    const next = physicsStep(0.1, last);
    trail.push({ ...next });
    graphRef.current.push({ t: next.t, h: next.y, v: next.v });
    setCurrentTime(next.t);
    setCurrentVel(next.v);
    setCurrentHeight(next.y);
    setCurrentAcc(next.a);
    draw(next);
  }, [height, gravity, physicsStep, draw]);

  // ── Planet preset change ──
  const handlePreset = useCallback(
    (g: number) => {
      onUpdate?.({ gravity: g });
    },
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-cyan-400">
          H: {currentHeight.toFixed(1)}m
        </span>
        <span className="text-orange-400">
          v: {currentVel.toFixed(1)}m/s
        </span>
        <span className="text-purple-400">
          a: {currentAcc.toFixed(2)}m/s²
        </span>
        <span className="text-gray-400">
          t: {currentTime.toFixed(2)}s
        </span>
        {landed && (
          <span className="text-emerald-400 font-semibold">LANDED</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        {/* Playback */}
        <button
          onClick={() => setPlaying(!playing)}
          disabled={landed}
          className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={handleStep}
          disabled={playing || landed}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-40"
        >
          ⏭ Step
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-gray-700" />

        {/* Planet presets */}
        {GRAVITY_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.g)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              Math.abs(gravity - p.g) < 0.01
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {p.emoji} {p.label}
          </button>
        ))}

        {/* Sliders */}
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Drag
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={airResistance}
              onChange={(e) => onUpdate?.({ airResistance: parseFloat(e.target.value) })}
              className="h-1 w-20 accent-indigo-500"
            />
            <span className="w-8 text-right text-gray-400">{airResistance.toFixed(2)}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
