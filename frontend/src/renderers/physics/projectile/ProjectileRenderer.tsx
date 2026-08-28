/**
 * Projectile Motion Renderer — production-quality interactive simulation.
 *
 * Uses Canvas 2D (not Three.js) because 2D provides the clearest
 * educational view of trajectory, vectors, and measurements.
 *
 * Features:
 * - Physically correct kinematic equations (no approximations)
 * - Ghost positions showing projectile at equal time intervals
 * - Motion trail with gradient opacity
 * - Resultant velocity vector + decomposed components
 * - Real-time coordinate & speed overlay
 * - Adaptive grid with intelligent spacing
 * - Preset environments (Earth, Moon, Mars)
 * - Launch angle arc with initial velocity decomposition
 * - Max height & range annotations with dimension lines
 *
 * Physics:
 *   x(t) = v₀·cos(θ)·t
 *   y(t) = v₀·sin(θ)·t − ½g·t²
 *   vx(t) = v₀·cos(θ)   (constant)
 *   vy(t) = v₀·sin(θ) − g·t
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

// ── Parameter Interface ──────────────────────────────────────────────

interface ProjectileParams {
  velocity: number;
  angle: number;
  gravity: number;
  showVectors?: boolean;
  showTrajectory?: boolean;
  animationSpeed?: number;
}

// ── Simulation State ─────────────────────────────────────────────────

interface SimState {
  time: number;
  playing: boolean;
  completed: boolean;
}

// ── Layout Constants ─────────────────────────────────────────────────

const MARGIN = { top: 30, right: 30, bottom: 65, left: 65 };
const GHOST_COUNT = 6;
const TRAIL_SAMPLES = 30;
const BALL_RADIUS = 8;

// ── Gravity Presets ──────────────────────────────────────────────────

const GRAVITY_PRESETS: { label: string; g: number; emoji: string }[] = [
  { label: "Earth", g: 9.81, emoji: "🌍" },
  { label: "Moon", g: 1.62, emoji: "🌙" },
  { label: "Mars", g: 3.72, emoji: "🔴" },
];

// ── Main Component ───────────────────────────────────────────────────

export default function ProjectileRenderer({
  parameters,
  onUpdate,
}: RendererProps<ProjectileParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  // Extract parameters with safe defaults
  const velocity = parameters.velocity ?? 20;
  const angle = parameters.angle ?? 45;
  const gravity = parameters.gravity ?? 9.81;
  const showVectors = parameters.showVectors ?? true;
  const showTrajectory = parameters.showTrajectory ?? true;
  const speed = parameters.animationSpeed ?? 1.0;

  // ── Derived Physics ──────────────────────────────────────────────

  const physics = useMemo(() => {
    const rad = (angle * Math.PI) / 180;
    const vx0 = velocity * Math.cos(rad);
    const vy0 = velocity * Math.sin(rad);
    const safeG = Math.max(gravity, 0.01);

    const flightTime = vy0 > 0.001 ? (2 * vy0) / safeG : 0.001;
    const maxHeight = vy0 > 0.001 ? (vy0 * vy0) / (2 * safeG) : 0;
    const range =
      angle > 0.01 && angle < 89.99
        ? (velocity * velocity * Math.sin(2 * rad)) / safeG
        : vx0 * flightTime;

    return { rad, vx0, vy0, safeG, flightTime, maxHeight, range };
  }, [velocity, angle, gravity]);

  const { rad, vx0, vy0, safeG, flightTime, maxHeight, range } = physics;

  // ── Simulation State ─────────────────────────────────────────────

  const [sim, setSim] = useState<SimState>({
    time: 0,
    playing: false,
    completed: false,
  });

  // ── Physics Functions ────────────────────────────────────────────

  const posAt = useCallback(
    (t: number) => ({
      x: vx0 * t,
      y: vy0 * t - 0.5 * safeG * t * t,
    }),
    [vx0, vy0, safeG]
  );

  const velAt = useCallback(
    (t: number) => ({
      x: vx0,
      y: vy0 - safeG * t,
    }),
    [vx0, vy0, safeG]
  );

  // ── Canvas Sizing (ResizeObserver) ──────────────────────────────

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

  const render = useCallback(
    (currentTime: number) => {
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

      const groundY = h - MARGIN.bottom;
      const originX = MARGIN.left;
      const plotW = w - MARGIN.left - MARGIN.right;
      const plotH = groundY - MARGIN.top;

      if (plotW < 20 || plotH < 20) return;

      const maxDX = Math.max(range * 1.25, 5);
      const maxDY = Math.max(maxHeight * 1.5, 3);
      const scale = Math.min(plotW / maxDX, plotH / maxDY);

      const toScreen = (x: number, y: number) => ({
        sx: originX + x * scale,
        sy: groundY - Math.max(y, 0) * scale,
      });

      // ── Adaptive Grid ─────────────────────────────────────────

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

      const stepX = niceStep(maxDX, 6);
      const stepY = niceStep(maxDY, 5);
      const labelFmt = (v: number) =>
        v >= 1000
          ? `${(v / 1000).toFixed(1)}k`
          : v >= 1
            ? v.toFixed(v === Math.round(v) ? 0 : 1)
            : v.toFixed(2);

      ctx.font = "10px monospace";

      // Vertical grid lines + X labels
      for (let gx = 0; gx <= maxDX + stepX * 0.01; gx += stepX) {
        const { sx } = toScreen(gx, 0);
        if (sx > w - 10) break;
        ctx.strokeStyle = gx === 0 ? "#334155" : "#1e293b";
        ctx.lineWidth = gx === 0 ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, MARGIN.top);
        ctx.lineTo(sx, groundY);
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText(`${labelFmt(gx)}m`, sx, groundY + 14);
      }

      // Horizontal grid lines + Y labels
      for (let gy = 0; gy <= maxDY + stepY * 0.01; gy += stepY) {
        const { sy } = toScreen(0, gy);
        if (sy < 10) break;
        ctx.strokeStyle = gy === 0 ? "#334155" : "#1e293b";
        ctx.lineWidth = gy === 0 ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(originX, sy);
        ctx.lineTo(w - MARGIN.right, sy);
        ctx.stroke();
        if (gy > 0) {
          ctx.fillStyle = "#64748b";
          ctx.textAlign = "right";
          ctx.fillText(`${labelFmt(gy)}m`, originX - 8, sy + 3);
        }
      }

      // ── Ground ────────────────────────────────────────────────

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(originX, groundY);
      ctx.lineTo(w - 16, groundY);
      ctx.stroke();

      // Ground hatching
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 0.5;
      for (let hx = originX; hx < w - 16; hx += 15) {
        ctx.beginPath();
        ctx.moveTo(hx, groundY + 1);
        ctx.lineTo(hx - 6, groundY + 8);
        ctx.stroke();
      }

      // ── Full Trajectory Preview (dashed) ──────────────────────

      if (showTrajectory && flightTime > 0.001) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "rgba(59,130,246,0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const n = 120;
        for (let i = 0; i <= n; i++) {
          const t = (flightTime * i) / n;
          const { x, y } = posAt(t);
          const { sx, sy } = toScreen(x, Math.max(y, 0));
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Animated Trajectory Trail (gradient opacity) ──────────

      const t = Math.min(currentTime, flightTime);
      if (t > 0.001) {
        const steps = Math.max(Math.floor((t / flightTime) * TRAIL_SAMPLES), 2);
        for (let i = 1; i <= steps; i++) {
          const t0 = (t * (i - 1)) / steps;
          const t1 = (t * i) / steps;
          const p0 = posAt(t0);
          const p1 = posAt(t1);
          const s0 = toScreen(p0.x, Math.max(p0.y, 0));
          const s1 = toScreen(p1.x, Math.max(p1.y, 0));
          const alpha = 0.3 + 0.7 * (i / steps);
          ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
          ctx.lineWidth = 2 + 1.0 * (i / steps);
          ctx.beginPath();
          ctx.moveTo(s0.sx, s0.sy);
          ctx.lineTo(s1.sx, s1.sy);
          ctx.stroke();
        }
      }

      // ── Ghost Positions (equal time intervals) ────────────────

      if (t > flightTime * 0.1 && flightTime > 0.01) {
        for (let i = 1; i <= GHOST_COUNT; i++) {
          const gt = (flightTime * i) / (GHOST_COUNT + 1);
          if (gt > t) break;
          const gp = posAt(gt);
          const gs = toScreen(gp.x, Math.max(gp.y, 0));
          const alpha = 0.1 + 0.06 * i;

          ctx.fillStyle = `rgba(96,165,250,${alpha})`;
          ctx.beginPath();
          ctx.arc(gs.sx, gs.sy, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(148,163,184,${alpha * 0.8})`;
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${gt.toFixed(2)}s`, gs.sx, gs.sy - 7);
        }
      }

      // ── Current Position ──────────────────────────────────────

      const pos = posAt(t);
      const { sx: px, sy: py } = toScreen(pos.x, Math.max(pos.y, 0));

      // Motion trail (last N positions as fading dots)
      if (t > 0.01) {
        const trailCount = 8;
        const trailDuration = Math.min(t, flightTime * 0.12);
        for (let i = trailCount; i >= 1; i--) {
          const tt = t - (trailDuration * i) / trailCount;
          if (tt < 0) continue;
          const tp = posAt(tt);
          const ts = toScreen(tp.x, Math.max(tp.y, 0));
          const a = 0.05 * (trailCount - i + 1);
          ctx.fillStyle = `rgba(96,165,250,${a})`;
          ctx.beginPath();
          ctx.arc(ts.sx, ts.sy, BALL_RADIUS * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ball glow
      const glow = ctx.createRadialGradient(px, py, 0, px, py, BALL_RADIUS * 3);
      glow.addColorStop(0, "rgba(59,130,246,0.3)");
      glow.addColorStop(1, "rgba(59,130,246,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, BALL_RADIUS * 3, 0, Math.PI * 2);
      ctx.fill();

      // Ball body
      const ballGrad = ctx.createRadialGradient(
        px - 2, py - 2, 1,
        px, py, BALL_RADIUS
      );
      ballGrad.addColorStop(0, "#93c5fd");
      ballGrad.addColorStop(0.6, "#60a5fa");
      ballGrad.addColorStop(1, "#3b82f6");
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(px, py, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Velocity Vectors ──────────────────────────────────────

      if (showVectors && currentTime <= flightTime && t > 0) {
        const vel = velAt(t);
        const spd = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const vScale = Math.max(
          1.5,
          Math.min(3.5, 60 / Math.max(velocity, 1))
        );

        // Vx component (green, horizontal)
        if (Math.abs(vel.x) > 0.05) {
          const ex = px + vel.x * vScale;
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ex, py);
          ctx.stroke();
          drawArrowhead(ctx, ex, py, vel.x > 0 ? 0 : Math.PI);
          ctx.fillStyle = "#22c55e";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = vel.x > 0 ? "left" : "right";
          const vxLabel = vel.x > 0 ? 10 : -10;
          ctx.fillText(`vₓ=${vel.x.toFixed(1)}`, ex + vxLabel, py + 14);
        }

        // Vy component (amber, vertical)
        if (Math.abs(vel.y) > 0.05) {
          const ey = py - vel.y * vScale;
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, ey);
          ctx.stroke();
          drawArrowhead(ctx, px, ey, vel.y > 0 ? -Math.PI / 2 : Math.PI / 2);
          ctx.fillStyle = "#f59e0b";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`vᵧ=${vel.y.toFixed(1)}`, px + 10, ey + 4);
        }

        // Resultant vector (cyan)
        if (spd > 0.1) {
          const rx = px + vel.x * vScale;
          const ry = py - vel.y * vScale;
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.setLineDash([]);
          drawArrowhead(
            ctx, rx, ry,
            Math.atan2(-(vel.y * vScale), vel.x * vScale)
          );
          ctx.fillStyle = "#06b6d4";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`|v|=${spd.toFixed(1)}`, rx + 8, ry - 6);
        }
      }

      // ── Max Height Marker ─────────────────────────────────────

      if (maxHeight > 0.01 && currentTime >= flightTime * 0.45) {
        const peakX = range / 2;
        const { sx: mx, sy: my } = toScreen(peakX, maxHeight);
        const { sy: groundSy } = toScreen(peakX, 0);

        // Dashed vertical line
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "rgba(239,68,68,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, groundSy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);

        // Horizontal tick at top
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mx - 6, my);
        ctx.lineTo(mx + 6, my);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`H = ${maxHeight.toFixed(2)} m`, mx, my - 12);
      }

      // ── Range Marker ──────────────────────────────────────────

      if (range > 0.01 && currentTime >= flightTime * 0.95) {
        const { sx: rx } = toScreen(range, 0);
        const { sx: ox } = toScreen(0, 0);
        const dimY = groundY + 30;

        // Dimension line with ticks
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, dimY);
        ctx.lineTo(rx, dimY);
        ctx.stroke();
        // Start tick
        ctx.beginPath();
        ctx.moveTo(ox, dimY - 4);
        ctx.lineTo(ox, dimY + 4);
        ctx.stroke();
        // End tick
        ctx.beginPath();
        ctx.moveTo(rx, dimY - 4);
        ctx.lineTo(rx, dimY + 4);
        ctx.stroke();

        // Dashed vertical at landing
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(139,92,246,0.4)";
        ctx.beginPath();
        ctx.moveTo(rx, groundY);
        ctx.lineTo(rx, groundY + 35);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = "#8b5cf6";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`R = ${range.toFixed(2)} m`, (ox + rx) / 2, dimY + 16);
      }

      // ── Launch Angle Arc ──────────────────────────────────────

      if (angle > 0.5) {
        const arcR = Math.min(45, Math.max(25, scale * range * 0.08));
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(originX, groundY, arcR, -rad, 0);
        ctx.stroke();

        // Launch direction line
        ctx.strokeStyle = "rgba(148,163,184,0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(originX, groundY);
        const dirLen = arcR * 1.8;
        ctx.lineTo(
          originX + dirLen * Math.cos(-rad),
          groundY + dirLen * Math.sin(-rad)
        );
        ctx.stroke();
        ctx.setLineDash([]);

        // Angle label at arc midpoint
        const midAngle = -rad / 2;
        const labelR = arcR + 14;
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `${angle}°`,
          originX + labelR * Math.cos(midAngle),
          groundY + labelR * Math.sin(midAngle) + 4
        );

        // Initial velocity decomposition labels
        ctx.font = "9px monospace";
        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "left";
        ctx.fillText(
          `v₀ₓ = ${vx0.toFixed(1)} m/s`,
          originX + arcR + 22,
          groundY - 4
        );
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(
          `v₀ᵧ = ${vy0.toFixed(1)} m/s`,
          originX + 6,
          groundY - arcR - 8
        );
      }

      // ── Gravity Indicator (top-right) ─────────────────────────

      const gix = w - 55;
      const giy = 35;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gix, giy);
      ctx.lineTo(gix, giy + 25);
      ctx.stroke();
      drawArrowhead(ctx, gix, giy + 25, Math.PI / 2);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`g = ${gravity}`, gix, giy - 8);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "8px monospace";
      ctx.fillText("m/s²", gix, giy + 38);

      // ── Real-time Data Overlay ────────────────────────────────

      if (currentTime > 0 && currentTime <= flightTime) {
        const vel = velAt(t);
        const spd = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

        const lines = [
          `t = ${t.toFixed(2)} s`,
          `x = ${pos.x.toFixed(2)} m`,
          `y = ${Math.max(pos.y, 0).toFixed(2)} m`,
          `|v| = ${spd.toFixed(1)} m/s`,
        ];

        const boxX = originX + 8;
        const boxY = MARGIN.top + 4;
        ctx.fillStyle = "rgba(15,23,42,0.85)";
        ctx.strokeStyle = "rgba(51,65,85,0.5)";
        ctx.lineWidth = 1;
        roundRect(ctx, boxX, boxY, 125, lines.length * 15 + 10, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "11px monospace";
        ctx.textAlign = "left";
        lines.forEach((line, i) => {
          ctx.fillText(line, boxX + 8, boxY + 17 + i * 15);
        });
      }
    },
    [
      velocity, angle, gravity, showVectors, showTrajectory,
      range, maxHeight, flightTime, posAt, velAt, vx0, vy0, rad, safeG,
    ]
  );

  // ── Animation Loop ─────────────────────────────────────────────

  useEffect(() => {
    if (!sim.playing) {
      render(sim.time);
      return;
    }

    let lastFrame = performance.now();
    const animate = (now: number) => {
      const delta = ((now - lastFrame) / 1000) * speed;
      lastFrame = now;

      setSim((prev) => {
        const next = prev.time + delta;
        if (next >= flightTime) {
          return { time: flightTime, playing: false, completed: true };
        }
        return { ...prev, time: next };
      });

      render(Math.min(sim.time + delta, flightTime));
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [sim.playing, flightTime, speed, render]);

  // Re-render when params change (while paused)
  useEffect(() => {
    if (!sim.playing) render(sim.time);
  }, [velocity, angle, gravity, showVectors, showTrajectory, render]);

  // Reset simulation when physics params change
  useEffect(() => {
    setSim({ time: 0, playing: false, completed: false });
  }, [velocity, angle, gravity]);

  // ── Controls ───────────────────────────────────────────────────

  const play = () => {
    if (sim.completed) setSim({ time: 0, playing: true, completed: false });
    else setSim((s) => ({ ...s, playing: true }));
  };
  const pause = () => setSim((s) => ({ ...s, playing: false }));
  const reset = () => setSim({ time: 0, playing: false, completed: false });
  const stepFwd = () =>
    setSim((s) => ({
      ...s,
      playing: false,
      time: Math.min(s.time + flightTime / 30, flightTime),
      completed: s.time + flightTime / 30 >= flightTime,
    }));
  const stepBack = () =>
    setSim((s) => ({
      ...s,
      playing: false,
      time: Math.max(s.time - flightTime / 30, 0),
      completed: false,
    }));

  const setPreset = (g: number) => onUpdate?.({ gravity: g });

  // Progress percentage
  const progress = flightTime > 0.001 ? (sim.time / flightTime) * 100 : 0;

  // ── Render JSX ─────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* ── Controls Panel ──────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-700/50 bg-gray-900/90">
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 py-2.5">
          {/* Row 1: Playback + Stats + Presets */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Playback buttons */}
            <div className="flex gap-1">
              <Btn
                onClick={stepBack}
                disabled={sim.time <= 0}
                title="Step back"
              >
                <StepBackIcon />
              </Btn>
              {!sim.playing ? (
                <Btn onClick={play} primary>
                  {sim.completed ? <ReplayIcon /> : <PlayIcon />}
                  <span className="ml-1">
                    {sim.completed ? "Replay" : "Play"}
                  </span>
                </Btn>
              ) : (
                <Btn onClick={pause}>
                  <PauseIcon />
                  <span className="ml-1">Pause</span>
                </Btn>
              )}
              <Btn
                onClick={stepFwd}
                disabled={sim.completed}
                title="Step forward"
              >
                <StepFwdIcon />
              </Btn>
              <Btn onClick={reset} title="Reset">
                <ResetIcon />
              </Btn>
            </div>

            <div className="mx-1 h-5 w-px bg-gray-700" />

            {/* Computed stats */}
            <div className="flex gap-3 text-[11px] font-mono">
              <Stat label="H" value={maxHeight} unit="m" color="text-red-400" />
              <Stat label="R" value={range} unit="m" color="text-purple-400" />
              <Stat label="T" value={flightTime} unit="s" color="text-blue-400" decimals={2} />
              <span className="text-gray-600">
                t={sim.time.toFixed(2)}s
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] text-gray-600 mr-0.5">Planet:</span>
              {GRAVITY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(p.g)}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                    Math.abs(gravity - p.g) < 0.02
                      ? "bg-blue-600/30 text-blue-300 ring-1 ring-blue-500/40"
                      : "bg-gray-800/50 text-gray-500 hover:bg-gray-700/50 hover:text-gray-400"
                  }`}
                  title={`${p.label}: g = ${p.g} m/s²`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Parameter Sliders */}
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <Slider
              label="Velocity"
              value={velocity}
              min={1}
              max={100}
              unit="m/s"
              color="blue"
              onChange={(v) => onUpdate?.({ velocity: v })}
            />
            <Slider
              label="Angle"
              value={angle}
              min={0}
              max={90}
              unit="°"
              color="amber"
              onChange={(v) => onUpdate?.({ angle: v })}
            />
            <Slider
              label="Gravity"
              value={gravity}
              min={0.1}
              max={25}
              step={0.01}
              unit="m/s²"
              color="red"
              onChange={(v) => onUpdate?.({ gravity: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Drawing Utilities
// ══════════════════════════════════════════════════════════════════════

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number
) {
  const size = 7;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.4);
  ctx.lineTo(-size, size * 0.4);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.fill();
  ctx.restore();
}

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

// ══════════════════════════════════════════════════════════════════════
//  UI Sub-components
// ══════════════════════════════════════════════════════════════════════

function Stat({
  label,
  value,
  unit,
  color,
  decimals = 1,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  decimals?: number;
}) {
  return (
    <span className="text-gray-500">
      {label}: <span className={color}>{value.toFixed(decimals)}</span>
      {unit}
    </span>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
        ${
          primary
            ? "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-900"
            : "border border-gray-600/50 text-gray-300 hover:bg-gray-700/60"
        }
        disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  color: string;
  onChange: (v: number) => void;
}) {
  const accent = {
    blue: "accent-blue-500",
    amber: "accent-amber-500",
    red: "accent-red-500",
  }[color] ?? "accent-blue-500";

  const textColor = {
    blue: "text-blue-400",
    amber: "text-amber-400",
    red: "text-red-400",
  }[color] ?? "text-blue-400";

  return (
    <label className="flex items-center gap-2 text-[11px] text-gray-400">
      <span className="w-14 text-right shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1.5 flex-1 min-w-[80px] cursor-pointer ${accent}`}
      />
      <span className={`w-[72px] font-mono ${textColor} tabular-nums shrink-0`}>
        {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}
        {unit}
      </span>
    </label>
  );
}

// ── Icon Components ──────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M4.5 12c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662" />
    </svg>
  );
}

function StepBackIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7.712 4.819A1.5 1.5 0 0110 6.095v2.973l5.712-4.249A1.5 1.5 0 0118 6.095v7.81a1.5 1.5 0 01-2.288 1.276L10 10.932v2.973a1.5 1.5 0 01-2.288 1.276l-5.712-4.25a1.5 1.5 0 010-2.55l5.712-4.249zM4 6.25a.75.75 0 00-1.5 0v7.5a.75.75 0 001.5 0v-7.5z" />
    </svg>
  );
}

function StepFwdIcon() {
  return (
    <svg className="h-3 w-3 scale-x-[-1]" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7.712 4.819A1.5 1.5 0 0110 6.095v2.973l5.712-4.249A1.5 1.5 0 0118 6.095v7.81a1.5 1.5 0 01-2.288 1.276L10 10.932v2.973a1.5 1.5 0 01-2.288 1.276l-5.712-4.25a1.5 1.5 0 010-2.55l5.712-4.249zM4 6.25a.75.75 0 00-1.5 0v7.5a.75.75 0 001.5 0v-7.5z" />
    </svg>
  );
}
