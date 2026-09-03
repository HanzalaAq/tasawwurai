/**
 * Collision Lab Renderer — 1D momentum and restitution simulation.
 *
 * Canvas 2D with requestAnimationFrame animation loop.
 *
 * Features:
 * - Two colliding balls with adjustable masses and velocities
 * - Restitution slider from perfectly inelastic (e=0) to elastic (e=1)
 * - Velocity arrows on balls, momentum arrows above the track
 * - Live momentum total (conserved) and kinetic energy (lost in inelastic hits)
 * - Before/after readout of the most recent collision
 * - Impact flash rings
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface CollisionParams {
  massA: number;
  velocityA: number;
  massB: number;
  velocityB: number;
  restitution: number;
}

const TRACK_LEN = 20; // meters

function radiusOf(mass: number): number {
  // meters — visually proportional to cube root of mass
  return 0.32 + 0.2 * Math.cbrt(mass);
}

interface Flash {
  x: number; // meters
  age: number; // seconds
}

interface CollisionRecord {
  vA_before: number;
  vB_before: number;
  vA_after: number;
  vB_after: number;
  keBefore: number;
  keAfter: number;
}

export default function CollisionRenderer({
  parameters,
  onUpdate,
}: RendererProps<CollisionParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const massA = parameters.massA ?? 2;
  const velocityA = parameters.velocityA ?? 4;
  const massB = parameters.massB ?? 4;
  const velocityB = parameters.velocityB ?? -2;
  const restitution = parameters.restitution ?? 1;

  const [playing, setPlaying] = useState(false);

  const pARef = useRef(3);
  const pBRef = useRef(TRACK_LEN - 3);
  const vARef = useRef(velocityA);
  const vBRef = useRef(velocityB);
  const flashesRef = useRef<Flash[]>([]);
  const collisionsRef = useRef(0);
  const [lastCollision, setLastCollision] = useState<CollisionRecord | null>(null);
  const [stats, setStats] = useState({ vA: velocityA, vB: velocityB, p: 0, ke: 0, n: 0 });

  const rA = radiusOf(massA);
  const rB = radiusOf(massB);

  // ── Physics step ──
  const physicsStep = useCallback(
    (dt: number) => {
      const e = restitution;
      let pA = pARef.current;
      let pB = pBRef.current;
      let vA = vARef.current;
      let vB = vBRef.current;

      pA += vA * dt;
      pB += vB * dt;

      // Ball-ball collision
      if (pB - pA < rA + rB) {
        // Separate proportionally to inverse mass
        const overlap = rA + rB - (pB - pA);
        pA -= overlap * (massB / (massA + massB));
        pB += overlap * (massA / (massA + massB));

        const vA0 = vA;
        const vB0 = vB;
        const newVA = ((massA - e * massB) * vA0 + (1 + e) * massB * vB0) / (massA + massB);
        const newVB = ((massB - e * massA) * vB0 + (1 + e) * massA * vA0) / (massA + massB);
        vA = newVA;
        vB = newVB;

        const keBefore = 0.5 * massA * vA0 * vA0 + 0.5 * massB * vB0 * vB0;
        const keAfter = 0.5 * massA * newVA * newVA + 0.5 * massB * newVB * newVB;
        collisionsRef.current += 1;
        setLastCollision({
          vA_before: vA0, vB_before: vB0, vA_after: newVA, vB_after: newVB,
          keBefore, keAfter,
        });
        flashesRef.current.push({ x: (pA + rA + pB - rB) / 2, age: 0 });
      }

      // Walls
      const glued = collisionsRef.current > 0 && Math.abs(vA - vB) < 0.005;
      if (pA - rA < 0) {
        pA = rA;
        if (glued && vA < 0) { vA = 0; vB = 0; }
        else if (vA < 0) { vA = -vA; flashesRef.current.push({ x: 0, age: 0 }); }
      }
      if (pB + rB > TRACK_LEN) {
        pB = TRACK_LEN - rB;
        if (glued && vB > 0) { vA = 0; vB = 0; }
        else if (vB > 0) { vB = -vB; flashesRef.current.push({ x: TRACK_LEN, age: 0 }); }
      }

      pARef.current = pA;
      pBRef.current = pB;
      vARef.current = vA;
      vBRef.current = vB;

      flashesRef.current.forEach((f) => (f.age += dt));
      flashesRef.current = flashesRef.current.filter((f) => f.age < 0.6);
    },
    [massA, massB, restitution, rA, rB]
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

    const trackL = 30;
    const trackW = w - 60;
    const m2px = trackW / TRACK_LEN;
    const cy = h * 0.58;
    const pA = pARef.current;
    const pB = pBRef.current;
    const vA = vARef.current;
    const vB = vBRef.current;

    // ── Track ──
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackL, cy + 34);
    ctx.lineTo(trackL + trackW, cy + 34);
    ctx.stroke();
    // Meter ticks
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 1;
    for (let m = 0; m <= TRACK_LEN; m += 2) {
      const x = trackL + m * m2px;
      ctx.beginPath();
      ctx.moveTo(x, cy + 34);
      ctx.lineTo(x, cy + 40);
      ctx.stroke();
      ctx.fillText(`${m}m`, x, cy + 52);
    }

    // ── Momentum arrows (above track) ──
    const momY = cy - 90;
    ctx.font = "10px monospace";
    const pAval = massA * vA;
    const pBval = massB * vB;
    const drawMomArrow = (x: number, p: number, label: string) => {
      if (Math.abs(p) < 0.05) return;
      const len = Math.max(-70, Math.min(70, p * 7));
      ctx.strokeStyle = "#facc15";
      ctx.fillStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, momY);
      ctx.lineTo(x + len, momY);
      ctx.stroke();
      const dir = len > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + len, momY);
      ctx.lineTo(x + len - dir * 7, momY - 4);
      ctx.lineTo(x + len - dir * 7, momY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(`${label} = ${p >= 0 ? "+" : ""}${p.toFixed(1)}`, x, momY - 8);
    };
    drawMomArrow(trackL + pA * m2px, pAval, "pA");
    drawMomArrow(trackL + pB * m2px, pBval, "pB");

    // ── Balls ──
    const drawBall = (
      px: number, r: number, v: number, label: string, mass: number,
      c1: string, c2: string
    ) => {
      const rpx = r * m2px;
      const glow = ctx.createRadialGradient(px, cy, 0, px, cy, rpx * 2.2);
      glow.addColorStop(0, c2 + "44");
      glow.addColorStop(1, c2 + "00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, cy, rpx * 2.2, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(px - rpx * 0.3, cy - rpx * 0.3, 0, px, cy, rpx);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, cy, rpx, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, px, cy + 4);

      // Mass label above, velocity below
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(`${mass.toFixed(1)} kg`, px, cy - rpx - 10);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(`v = ${v >= 0 ? "+" : ""}${v.toFixed(2)} m/s`, px, cy + rpx + 16);

      // Velocity arrow through ball
      if (Math.abs(v) > 0.05) {
        const len = Math.max(-60, Math.min(60, v * 9));
        ctx.strokeStyle = "#f97316";
        ctx.fillStyle = "#f97316";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px - len * 0.0, cy);
        ctx.lineTo(px + len, cy);
        ctx.stroke();
        const dir = len > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(px + len, cy);
        ctx.lineTo(px + len - dir * 8, cy - 4);
        ctx.lineTo(px + len - dir * 8, cy + 4);
        ctx.closePath();
        ctx.fill();
      }
    };
    drawBall(trackL + pA * m2px, rA, vA, "A", massA, "#93c5fd", "#3b82f6");
    drawBall(trackL + pB * m2px, rB, vB, "B", massB, "#99f6e4", "#14b8a6");

    // ── Flash rings ──
    flashesRef.current.forEach((f) => {
      const t = f.age / 0.6;
      ctx.strokeStyle = `rgba(250,204,21,${(1 - t) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(trackL + f.x * m2px, cy, 10 + t * 46, 0, Math.PI * 2);
      ctx.stroke();
    });

    // ── Totals panel (top-left) ──
    const pTotal = massA * vA + massB * vB;
    const keTotal = 0.5 * massA * vA * vA + 0.5 * massB * vB * vB;
    const p0 = massA * velocityA + massB * velocityB;
    const ke0 = 0.5 * massA * velocityA * velocityA + 0.5 * massB * velocityB * velocityB;

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(24, 16, 230, 64, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#4ade80";
    ctx.fillText(`Σp = ${pTotal >= 0 ? "+" : ""}${pTotal.toFixed(2)} kg·m/s (conserved)`, 36, 34);
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`ΣKE = ${keTotal.toFixed(1)} J  (initial ${ke0.toFixed(1)} J)`, 36, 52);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`collisions: ${collisionsRef.current}   e = ${restitution.toFixed(2)}`, 36, 70);

    // ── Last collision panel (top-right) ──
    if (lastCollision) {
      const lc = lastCollision;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.roundRect(w - 254, 16, 230, 64, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 10px monospace";
      ctx.fillText("LAST COLLISION", w - 242, 34);
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(
        `A: ${lc.vA_before >= 0 ? "+" : ""}${lc.vA_before.toFixed(2)} → ${lc.vA_after >= 0 ? "+" : ""}${lc.vA_after.toFixed(2)} m/s`,
        w - 242, 50
      );
      ctx.fillText(
        `B: ${lc.vB_before >= 0 ? "+" : ""}${lc.vB_before.toFixed(2)} → ${lc.vB_after >= 0 ? "+" : ""}${lc.vB_after.toFixed(2)} m/s`,
        w - 242, 64
      );
      const keLost = lc.keBefore - lc.keAfter;
      ctx.fillStyle = keLost > 0.01 ? "#f87171" : "#4ade80";
      ctx.fillText(`ΔKE: ${keLost > 0.01 ? "−" : ""}${keLost.toFixed(2)} J`, w - 242, 78);
    }
  }, [massA, massB, restitution, velocityA, velocityB, lastCollision, rA, rB]);

  // ── Animation Loop ──
  const lastFrameRef = useRef(0);
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      const steps = 4;
      for (let i = 0; i < steps; i++) physicsStep(dt / steps);

      setStats({
        vA: vARef.current,
        vB: vBRef.current,
        p: massA * vARef.current + massB * vBRef.current,
        ke: 0.5 * massA * vARef.current * vARef.current + 0.5 * massB * vBRef.current * vBRef.current,
        n: collisionsRef.current,
      });

      draw();
      animRef.current = requestAnimationFrame(animate);
    },
    [physicsStep, draw, massA, massB]
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

  // Live velocity updates from sliders
  useEffect(() => {
    vARef.current = velocityA;
  }, [velocityA]);
  useEffect(() => {
    vBRef.current = velocityB;
  }, [velocityB]);

  // ── Reset ──
  const reset = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    pARef.current = 3;
    pBRef.current = TRACK_LEN - 3;
    vARef.current = velocityA;
    vBRef.current = velocityB;
    collisionsRef.current = 0;
    flashesRef.current = [];
    setLastCollision(null);
    setStats({ vA: velocityA, vB: velocityB, p: massA * velocityA + massB * velocityB, ke: 24, n: 0 });
    setTimeout(draw, 0);
  }, [velocityA, velocityB, massA, massB, draw]);

  useEffect(() => {
    pARef.current = 3;
    pBRef.current = TRACK_LEN - 3;
    vARef.current = velocityA;
    vBRef.current = velocityB;
    draw();
  }, [velocityA, velocityB, draw]);

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-blue-400">vA: {stats.vA >= 0 ? "+" : ""}{stats.vA.toFixed(2)} m/s</span>
        <span className="text-teal-400">vB: {stats.vB >= 0 ? "+" : ""}{stats.vB.toFixed(2)} m/s</span>
        <span className="text-green-400">Σp: {stats.p >= 0 ? "+" : ""}{stats.p.toFixed(2)} kg·m/s</span>
        <span className="text-orange-400">ΣKE: {stats.ke.toFixed(1)} J</span>
        <span className="text-gray-400">hits: {stats.n}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setPlaying(!playing)}
          className="rounded-lg bg-blue-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
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

        <button
          onClick={() => onUpdate?.({ restitution: 1 })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            restitution > 0.95 ? "bg-blue-600/60 text-blue-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Elastic (e=1)
        </button>
        <button
          onClick={() => onUpdate?.({ restitution: 0 })}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            restitution < 0.05 ? "bg-blue-600/60 text-blue-200" : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
          }`}
        >
          Inelastic (e=0)
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          e
          <input
            type="range" min={0} max={1} step={0.05}
            value={restitution}
            onChange={(e) => onUpdate?.({ restitution: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-blue-500"
          />
          <span className="w-6 text-right text-gray-400">{restitution.toFixed(2)}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          mA
          <input
            type="range" min={0.5} max={10} step={0.5}
            value={massA}
            onChange={(e) => onUpdate?.({ massA: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-blue-500"
          />
          <span className="w-9 text-right text-gray-400">{massA.toFixed(1)}kg</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          mB
          <input
            type="range" min={0.5} max={10} step={0.5}
            value={massB}
            onChange={(e) => onUpdate?.({ massB: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-blue-500"
          />
          <span className="w-9 text-right text-gray-400">{massB.toFixed(1)}kg</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          vA
          <input
            type="range" min={-10} max={10} step={0.5}
            value={velocityA}
            onChange={(e) => onUpdate?.({ velocityA: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-blue-500"
          />
          <span className="w-9 text-right text-gray-400">{velocityA.toFixed(1)}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          vB
          <input
            type="range" min={-10} max={10} step={0.5}
            value={velocityB}
            onChange={(e) => onUpdate?.({ velocityB: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-blue-500"
          />
          <span className="w-9 text-right text-gray-400">{velocityB.toFixed(1)}</span>
        </label>
      </div>
    </div>
  );
}
