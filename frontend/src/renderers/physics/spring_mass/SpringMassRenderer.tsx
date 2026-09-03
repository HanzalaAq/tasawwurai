/**
 * Spring-Mass Oscillator Renderer — simple harmonic motion simulation.
 *
 * Canvas 2D with requestAnimationFrame animation loop.
 *
 * Features:
 * - Physically correct damped SHM: x'' = -(k/m)x - 2ζωx'
 * - Coil spring drawn between wall and block
 * - Displacement arrow with live readout
 * - Horizontal energy bars (kinetic vs elastic potential)
 * - Period / frequency / angular frequency readouts
 * - Adjustable mass, spring constant, amplitude, damping
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface SpringMassParams {
  mass: number;
  springConstant: number;
  amplitude: number;
  damping: number;
}

const COILS = 11;
const COIL_H = 18;

export default function SpringMassRenderer({
  parameters,
  onUpdate,
}: RendererProps<SpringMassParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const mass = parameters.mass ?? 2;
  const k = parameters.springConstant ?? 50;
  const amplitude = parameters.amplitude ?? 0.8;
  const damping = parameters.damping ?? 0.05;

  const [playing, setPlaying] = useState(false);
  const xRef = useRef(amplitude);
  const vRef = useRef(0);
  const tRef = useRef(0);

  const [displayX, setDisplayX] = useState(amplitude);
  const [displayV, setDisplayV] = useState(0);
  const [displayA, setDisplayA] = useState(0);
  const [displayT, setDisplayT] = useState(0);

  // ω = √(k/m), T = 2π/ω, f = 1/T
  const omega = Math.sqrt(k / mass);
  const period = (2 * Math.PI) / omega;
  const frequency = 1 / period;

  // ── Physics step: x'' = -(k/m)x - 2ζωx' ──
  const physicsStep = useCallback(
    (dt: number) => {
      const a = -(k / mass) * xRef.current - 2 * damping * omega * vRef.current;
      vRef.current += a * dt;
      xRef.current += vRef.current * dt;
      tRef.current += dt;
    },
    [k, mass, damping, omega]
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

    const axisY = h * 0.46;
    const xEq = w * 0.52;
    const halfSpan = w * 0.34;
    const scale = halfSpan / Math.max(amplitude, 0.05); // px per meter

    const boxW = Math.min(44 + mass * 7, 92);
    const boxH = Math.min(36 + mass * 5, 72);
    const massX = xEq + xRef.current * scale;
    const leftEdge = massX - boxW / 2;
    const floorY = axisY + boxH / 2;
    const wallX = Math.max(18, xEq - halfSpan - boxW / 2 - 80);

    // ── Wall ──
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wallX, axisY - boxH / 2 - 30);
    ctx.lineTo(wallX, floorY);
    ctx.stroke();
    // Hatching
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    for (let y = axisY - boxH / 2 - 30; y < floorY; y += 10) {
      ctx.beginPath();
      ctx.moveTo(wallX, y);
      ctx.lineTo(wallX - 8, y + 8);
      ctx.stroke();
    }

    // ── Floor ──
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, floorY);
    ctx.lineTo(w - 20, floorY);
    ctx.stroke();

    // ── Equilibrium dashed line ──
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xEq, axisY - boxH / 2 - 26);
    ctx.lineTo(xEq, floorY + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("equilibrium", xEq, floorY + 20);

    // ── Spring (zigzag from wall to block) ──
    const springLen = leftEdge - wallX;
    if (springLen > 8) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(wallX, axisY);
      // straight lead-in
      ctx.lineTo(wallX + springLen * 0.06, axisY);
      const zigStart = wallX + springLen * 0.08;
      const zigEnd = wallX + springLen * 0.92;
      const seg = (zigEnd - zigStart) / (COILS * 2);
      ctx.lineTo(zigStart, axisY);
      let dir = -1;
      for (let i = 0; i < COILS * 2; i++) {
        ctx.lineTo(zigStart + seg * (i + 1), axisY + dir * COIL_H);
        dir = -dir;
      }
      ctx.lineTo(zigEnd, axisY);
      ctx.lineTo(leftEdge, axisY);
      ctx.stroke();
    }

    // ── Displacement arrow (from equilibrium to block center) ──
    const arrowY = axisY - boxH / 2 - 34;
    const dx = xRef.current;
    if (Math.abs(dx) > 0.01) {
      const aScale = scale;
      const x1 = xEq;
      const x2 = xEq + dx * aScale;
      ctx.strokeStyle = "#facc15";
      ctx.fillStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, arrowY);
      ctx.lineTo(x2, arrowY);
      ctx.stroke();
      // Arrowhead pointing in direction of displacement
      const headDir = dx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x2, arrowY);
      ctx.lineTo(x2 - headDir * 8, arrowY - 4);
      ctx.lineTo(x2 - headDir * 8, arrowY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`x = ${dx >= 0 ? "+" : ""}${dx.toFixed(2)} m`, (x1 + x2) / 2, arrowY - 8);
    }

    // ── Mass block ──
    const glow = ctx.createRadialGradient(massX, axisY, 0, massX, axisY, boxW);
    glow.addColorStop(0, "rgba(168,85,247,0.25)");
    glow.addColorStop(1, "rgba(168,85,247,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(massX, axisY, boxW, 0, Math.PI * 2);
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(leftEdge, axisY - boxH / 2, leftEdge + boxW, axisY + boxH / 2);
    bodyGrad.addColorStop(0, "#a78bfa");
    bodyGrad.addColorStop(1, "#6d28d9");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(leftEdge, axisY - boxH / 2, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${mass.toFixed(1)}kg`, massX, axisY + 4);

    // ── Energy bars (horizontal, top-right) ──
    const KE = 0.5 * mass * vRef.current * vRef.current;
    const PE = 0.5 * k * xRef.current * xRef.current;
    const totalE = KE + PE || 1;

    const eBarX = w * 0.58;
    const eBarW = w * 0.36;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(eBarX, 16, eBarW, 54, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fb923c";
    ctx.fillText("KE", eBarX + 8, 29);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.roundRect(eBarX + 30, 25, eBarW - 42, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.roundRect(eBarX + 30, 25, (eBarW - 42) * (KE / totalE), 7, 3);
    ctx.fill();

    ctx.fillStyle = "#67e8f9";
    ctx.fillText("PE", eBarX + 8, 45);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.roundRect(eBarX + 30, 41, eBarW - 42, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.roundRect(eBarX + 30, 41, (eBarW - 42) * (PE / totalE), 7, 3);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px monospace";
    ctx.fillText(`E = ${totalE.toFixed(2)} J`, eBarX + 8, 63);
  }, [mass, k, amplitude]);

  // ── Animation Loop ──
  const lastFrameRef = useRef(0);
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      const steps = 4;
      for (let i = 0; i < steps; i++) physicsStep(dt / steps);

      setDisplayX(xRef.current);
      setDisplayV(vRef.current);
      setDisplayA(-(k / mass) * xRef.current - 2 * damping * omega * vRef.current);
      setDisplayT(tRef.current);

      draw();
      animRef.current = requestAnimationFrame(animate);
    },
    [physicsStep, draw, k, mass, damping, omega]
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

  // ── Reset (on amplitude change or button) ──
  const reset = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    xRef.current = amplitude;
    vRef.current = 0;
    tRef.current = 0;
    setDisplayX(amplitude);
    setDisplayV(0);
    setDisplayT(0);
    setTimeout(draw, 0);
  }, [amplitude, draw]);

  useEffect(() => {
    xRef.current = amplitude;
    vRef.current = 0;
    tRef.current = 0;
    setDisplayX(amplitude);
    draw();
  }, [amplitude, draw]);

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-yellow-400">x: {displayX >= 0 ? "+" : ""}{displayX.toFixed(3)} m</span>
        <span className="text-orange-400">v: {displayV >= 0 ? "+" : ""}{displayV.toFixed(2)} m/s</span>
        <span className="text-cyan-400">a: {displayA >= 0 ? "+" : ""}{displayA.toFixed(1)} m/s²</span>
        <span className="text-purple-400">T: {period.toFixed(2)}s</span>
        <span className="text-purple-300">f: {frequency.toFixed(2)}Hz</span>
        <span className="text-gray-400">t: {displayT.toFixed(1)}s</span>
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
          onClick={reset}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Mass
          <input
            type="range" min={0.5} max={10} step={0.1}
            value={mass}
            onChange={(e) => onUpdate?.({ mass: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-purple-500"
          />
          <span className="w-10 text-right text-gray-400">{mass.toFixed(1)}kg</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          k
          <input
            type="range" min={5} max={200} step={1}
            value={k}
            onChange={(e) => onUpdate?.({ springConstant: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-purple-500"
          />
          <span className="w-14 text-right text-gray-400">{k.toFixed(0)}N/m</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Amp
          <input
            type="range" min={0.1} max={2} step={0.05}
            value={amplitude}
            onChange={(e) => onUpdate?.({ amplitude: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-purple-500"
          />
          <span className="w-9 text-right text-gray-400">{amplitude.toFixed(2)}m</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          ζ
          <input
            type="range" min={0} max={1} step={0.01}
            value={damping}
            onChange={(e) => onUpdate?.({ damping: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-purple-500"
          />
          <span className="w-5 text-right text-gray-400">{damping.toFixed(2)}</span>
        </label>
        <span className="ml-auto text-[10px] text-gray-600">
          {damping < 0.01 ? "undamped" : damping < 1 ? "underdamped" : damping === 1 ? "critically damped" : "overdamped"}
        </span>
      </div>
    </div>
  );
}
