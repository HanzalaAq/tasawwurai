/**
 * Simple Pendulum Renderer — interactive swinging pendulum simulation.
 *
 * Canvas 2D with requestAnimationFrame animation loop.
 *
 * Features:
 * - Physically correct pendulum dynamics (not small-angle approximation)
 * - Angle arc visualization with degree readout
 * - Velocity vector at bob position
 * - Energy bar showing KE/PE distribution
 * - Period calculation and display
 * - Damping coefficient slider
 * - Planet gravity presets
 * - Ghost trail showing bob trajectory
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface PendulumParams {
  length: number;
  angle: number;
  gravity: number;
  damping: number;
}

const GRAVITY_PRESETS: { label: string; g: number; emoji: string }[] = [
  { label: "Earth", g: 9.81, emoji: "🌍" },
  { label: "Moon", g: 1.62, emoji: "🌙" },
  { label: "Mars", g: 3.72, emoji: "🔴" },
];

const BOB_RADIUS = 14;
const TRAIL_MAX = 40;

// ── Main Component ───────────────────────────────────────────────────

export default function PendulumRenderer({
  parameters,
  onUpdate,
}: RendererProps<PendulumParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const length = parameters.length ?? 2;
  const initAngle = ((parameters.angle ?? 30) * Math.PI) / 180;
  const gravity = parameters.gravity ?? 9.81;
  const damping = parameters.damping ?? 0.02;

  // State
  const [playing, setPlaying] = useState(false);
  const thetaRef = useRef(initAngle);
  const omegaRef = useRef(0);
  const timeRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const [displayAngle, setDisplayAngle] = useState((parameters.angle ?? 30));
  const [displayOmega, setDisplayOmega] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);

  // Period: T = 2π√(L/g) (small angle)
  const period = 2 * Math.PI * Math.sqrt(length / gravity);

  // ── Physics step (Verlet-like for stability) ──
  const physicsStep = useCallback(
    (dt: number) => {
      // θ'' = -(g/L)sin(θ) - damping * θ'
      const alpha = -(gravity / length) * Math.sin(thetaRef.current) - damping * omegaRef.current;
      omegaRef.current += alpha * dt;
      thetaRef.current += omegaRef.current * dt;
      timeRef.current += dt;
    },
    [gravity, length, damping]
  );

  // ── Drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Pivot position
    const pivotX = w * 0.4;
    const pivotY = h * 0.15;

    // Scale: map pendulum length to pixels
    const pixelLen = Math.min(h * 0.55, w * 0.35);
    const scale = pixelLen / length;

    const theta = thetaRef.current;
    const bobX = pivotX + pixelLen * Math.sin(theta);
    const bobY = pivotY + pixelLen * Math.cos(theta);

    // ── Pivot mount ──
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fill();
    // Mount line
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX - 40, pivotY);
    ctx.lineTo(pivotX + 40, pivotY);
    ctx.stroke();

    // ── Ghost trail ──
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const alpha = 0.04 + (i / trail.length) * 0.15;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, BOB_RADIUS - 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168,85,247,${alpha})`;
      ctx.fill();
    }

    // ── String ──
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // ── Angle arc ──
    if (Math.abs(theta) > 0.02) {
      const arcR = pixelLen * 0.25;
      ctx.strokeStyle = "rgba(250,204,21,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (theta > 0) {
        ctx.arc(pivotX, pivotY, arcR, Math.PI / 2 - theta, Math.PI / 2);
      } else {
        ctx.arc(pivotX, pivotY, arcR, Math.PI / 2, Math.PI / 2 - theta);
      }
      ctx.stroke();
      // Angle label
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      const labelR = arcR + 14;
      const labelAngle = Math.PI / 2 - theta / 2;
      ctx.fillText(
        `${(Math.abs(theta) * 180 / Math.PI).toFixed(1)}°`,
        pivotX + labelR * Math.cos(labelAngle) * (theta > 0 ? 1 : 1),
        pivotY + labelR * Math.sin(labelAngle)
      );
    }

    // ── Equilibrium line (dashed) ──
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + pixelLen + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Bob ──
    // Glow
    const glow = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, BOB_RADIUS * 3);
    glow.addColorStop(0, "rgba(168,85,247,0.3)");
    glow.addColorStop(1, "rgba(168,85,247,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bobX, bobY, BOB_RADIUS * 3, 0, Math.PI * 2);
    ctx.fill();
    // Body
    const bodyGrad = ctx.createRadialGradient(bobX - 3, bobY - 3, 0, bobX, bobY, BOB_RADIUS);
    bodyGrad.addColorStop(0, "#c084fc");
    bodyGrad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(bobX, bobY, BOB_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // ── Velocity vector ──
    const omega = omegaRef.current;
    if (Math.abs(omega) > 0.05) {
      const vScale = 30;
      // Tangential velocity direction: perpendicular to string
      const vx = omega * pixelLen * Math.cos(theta);
      const vy = -omega * pixelLen * Math.sin(theta);
      const vMag = Math.sqrt(vx * vx + vy * vy);
      const nvx = (vx / vMag) * Math.min(vMag * vScale / pixelLen, 80);
      const nvy = (vy / vMag) * Math.min(vMag * vScale / pixelLen, 80);

      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bobX, bobY);
      ctx.lineTo(bobX + nvx, bobY + nvy);
      ctx.stroke();
      // Arrowhead
      const headLen = 8;
      const headAngle = Math.atan2(nvy, nvx);
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(bobX + nvx, bobY + nvy);
      ctx.lineTo(
        bobX + nvx - headLen * Math.cos(headAngle - 0.4),
        bobY + nvy - headLen * Math.sin(headAngle - 0.4)
      );
      ctx.lineTo(
        bobX + nvx - headLen * Math.cos(headAngle + 0.4),
        bobY + nvy - headLen * Math.sin(headAngle + 0.4)
      );
      ctx.closePath();
      ctx.fill();
    }

    // ── Energy bars (right side) ──
    const barX = w * 0.72;
    const barW = w * 0.22;
    const barH = h * 0.3;
    const barY = h * 0.15;

    // Calculate energies
    const h0 = length * (1 - Math.cos(theta)); // height above lowest point
    const v = omega * length;
    const PE = gravity * h0; // per unit mass
    const KE = 0.5 * v * v;
    const totalE = PE + KE || 1;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("ENERGY", barX + barW / 2, barY + 16);

    const keH = (KE / totalE) * (barH - 40);
    const peH = (PE / totalE) * (barH - 40);

    // KE bar
    ctx.fillStyle = "#f97316";
    ctx.fillRect(barX + 15, barY + barH - 10 - keH, barW / 2 - 20, keH);
    ctx.fillStyle = "#fb923c";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("KE", barX + 15 + (barW / 2 - 20) / 2, barY + barH - 2);

    // PE bar
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(barX + barW / 2 + 5, barY + barH - 10 - peH, barW / 2 - 20, peH);
    ctx.fillStyle = "#67e8f9";
    ctx.fillText("PE", barX + barW / 2 + 5 + (barW / 2 - 20) / 2, barY + barH - 2);

    // ── Period display ──
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(barX, barY + barH + 15, barW, 30, 6);
    ctx.fill();
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`T = ${period.toFixed(3)}s`, barX + barW / 2, barY + barH + 34);
  }, [length, gravity, period]);

  // ── Animation Loop ──
  const lastFrameRef = useRef(0);

  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      // Sub-step for accuracy
      const steps = 4;
      for (let i = 0; i < steps; i++) physicsStep(dt / steps);

      // Record trail
      const { w, h } = dimsRef.current;
      const pivotX = w * 0.4;
      const pivotY = h * 0.15;
      const pixelLen = Math.min(h * 0.55, w * 0.35);
      const bx = pivotX + pixelLen * Math.sin(thetaRef.current);
      const by = pivotY + pixelLen * Math.cos(thetaRef.current);
      trailRef.current.push({ x: bx, y: by });
      if (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();

      // Update React state
      setDisplayAngle((thetaRef.current * 180) / Math.PI);
      setDisplayOmega(omegaRef.current);
      setDisplayTime(timeRef.current);

      draw();
      animRef.current = requestAnimationFrame(animate);
    },
    [physicsStep, draw]
  );

  useEffect(() => {
    if (playing) {
      lastFrameRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, animate]);

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

  // ── Reset ──
  const handleReset = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    thetaRef.current = initAngle;
    omegaRef.current = 0;
    timeRef.current = 0;
    trailRef.current = [];
    setDisplayAngle((initAngle * 180) / Math.PI);
    setDisplayOmega(0);
    setDisplayTime(0);
    setTimeout(draw, 0);
  }, [initAngle, draw]);

  // Draw initial state
  useEffect(() => {
    thetaRef.current = initAngle;
    draw();
  }, [initAngle, draw]);

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-yellow-400">θ: {displayAngle.toFixed(1)}°</span>
        <span className="text-orange-400">ω: {displayOmega.toFixed(2)} rad/s</span>
        <span className="text-purple-400">T: {period.toFixed(2)}s</span>
        <span className="text-gray-400">t: {displayTime.toFixed(2)}s</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setPlaying(!playing)}
          className="rounded-lg bg-purple-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {GRAVITY_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onUpdate?.({ gravity: p.g })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              Math.abs(gravity - p.g) < 0.01
                ? "bg-purple-600/60 text-purple-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {p.emoji} {p.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Length
            <input
              type="range" min={0.5} max={10} step={0.1}
              value={length}
              onChange={(e) => onUpdate?.({ length: parseFloat(e.target.value) })}
              className="h-1 w-16 accent-purple-500"
            />
            <span className="w-10 text-right text-gray-400">{length.toFixed(1)}m</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Damp
            <input
              type="range" min={0} max={0.5} step={0.005}
              value={damping}
              onChange={(e) => onUpdate?.({ damping: parseFloat(e.target.value) })}
              className="h-1 w-16 accent-purple-500"
            />
            <span className="w-8 text-right text-gray-400">{damping.toFixed(3)}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
