/**
 * Wave Simulation Renderer — animated transverse wave on Canvas 2D.
 *
 * Features:
 * - Physically accurate sinusoidal wave: y(x,t) = A·sin(kx − ωt)
 * - Animated propagation with adjustable speed
 * - Node/antinode markers (optional)
 * - Real-time data overlay (period, wave speed, angular frequency)
 * - Wavelength & amplitude dimension annotations
 * - Particle motion indicators showing transverse displacement
 *
 * Physics:
 *   y(x,t) = A·sin(kx − ωt)
 *   k = 2π/λ  (wave number)
 *   ω = 2πf   (angular frequency)
 *   v = f·λ   (wave speed)
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

// ── Parameter Interface ──────────────────────────────────────────────

interface WaveParams {
  frequency: number;
  amplitude: number;
  wavelength: number;
  showNodes?: boolean;
}

// ── Layout Constants ─────────────────────────────────────────────────

const MARGIN = { top: 40, right: 40, bottom: 60, left: 60 };
const PARTICLE_COUNT = 24;

// ── Main Component ───────────────────────────────────────────────────

export default function WaveRenderer({
  parameters,
  onUpdate,
}: RendererProps<WaveParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });
  const timeRef = useRef(0);

  // Extract parameters with safe defaults
  const frequency = parameters.frequency ?? 2.0;
  const amplitude = parameters.amplitude ?? 1.0;
  const wavelength = parameters.wavelength ?? 3.0;
  const showNodes = parameters.showNodes ?? false;

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);

  // ── Derived Physics ──────────────────────────────────────────────

  const physics = useMemo(() => {
    const omega = 2 * Math.PI * frequency;        // angular frequency (rad/s)
    const k = (2 * Math.PI) / wavelength;          // wave number (rad/m)
    const waveSpeed = frequency * wavelength;       // propagation speed (m/s)
    const period = 1 / frequency;                   // period (s)
    return { omega, k, waveSpeed, period };
  }, [frequency, wavelength]);

  const { omega, k, waveSpeed, period } = physics;

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

  // ── Wave Function ────────────────────────────────────────────────

  const waveY = useCallback(
    (x: number, t: number) => amplitude * Math.sin(k * x - omega * t),
    [amplitude, k, omega]
  );

  // ── Canvas Render ────────────────────────────────────────────────

  const render = useCallback(
    (t: number) => {
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

      const centerY = h / 2;
      const originX = MARGIN.left;
      const plotW = w - MARGIN.left - MARGIN.right;
      const plotH = h - MARGIN.top - MARGIN.bottom;

      if (plotW < 20 || plotH < 20) return;

      // Show 3 full wavelengths
      const xRange = wavelength * 3;
      const xScale = plotW / xRange;
      const yScale = (plotH / 2) / (amplitude * 1.4);

      const toScreen = (x: number, y: number) => ({
        sx: originX + x * xScale,
        sy: centerY - y * yScale,
      });

      // ── Grid ──────────────────────────────────────────────────

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
      const stepY = niceStep(amplitude * 2, 4);
      const labelFmt = (v: number) =>
        v >= 1000
          ? `${(v / 1000).toFixed(1)}k`
          : v >= 1
          ? v.toFixed(v === Math.round(v) ? 0 : 1)
          : v.toFixed(2);

      ctx.font = "10px monospace";

      // Vertical grid lines + X labels
      for (let gx = 0; gx <= xRange + stepX * 0.01; gx += stepX) {
        const { sx } = toScreen(gx, 0);
        if (sx > w - 10) break;
        ctx.strokeStyle = gx === 0 ? "#334155" : "#1e293b";
        ctx.lineWidth = gx === 0 ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, MARGIN.top);
        ctx.lineTo(sx, h - MARGIN.bottom);
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText(`${labelFmt(gx)}m`, sx, h - MARGIN.bottom + 14);
      }

      // Horizontal grid lines + Y labels
      for (let gy = -amplitude * 1.3; gy <= amplitude * 1.3 + stepY * 0.01; gy += stepY) {
        const { sy } = toScreen(0, gy);
        if (sy < 10 || sy > h - 10) continue;
        ctx.strokeStyle = Math.abs(gy) < stepY * 0.01 ? "#475569" : "#1e293b";
        ctx.lineWidth = Math.abs(gy) < stepY * 0.01 ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(originX, sy);
        ctx.lineTo(w - MARGIN.right, sy);
        ctx.stroke();
        if (Math.abs(gy) > stepY * 0.01) {
          ctx.fillStyle = "#64748b";
          ctx.textAlign = "right";
          ctx.fillText(`${labelFmt(gy)}m`, originX - 8, sy + 3);
        }
      }

      // ── Equilibrium Line ──────────────────────────────────────

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(originX, centerY);
      ctx.lineTo(w - MARGIN.right, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Wave Trail (faded past positions) ──────────────────────

      const trailCount = 4;
      const trailDt = period * 0.05;
      for (let ti = trailCount; ti >= 1; ti--) {
        const tt = t - trailDt * ti;
        if (tt < 0) continue;
        const alpha = 0.04 * (trailCount - ti + 1);
        ctx.strokeStyle = `rgba(16,185,129,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const steps = 200;
        for (let i = 0; i <= steps; i++) {
          const x = (xRange * i) / steps;
          const y = waveY(x, tt);
          const { sx, sy } = toScreen(x, y);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // ── Main Wave ──────────────────────────────────────────────

      const waveGrad = ctx.createLinearGradient(originX, 0, w - MARGIN.right, 0);
      waveGrad.addColorStop(0, "#10b981");
      waveGrad.addColorStop(0.5, "#06b6d4");
      waveGrad.addColorStop(1, "#8b5cf6");
      ctx.strokeStyle = waveGrad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const waveSteps = 300;
      for (let i = 0; i <= waveSteps; i++) {
        const x = (xRange * i) / waveSteps;
        const y = waveY(x, t);
        const { sx, sy } = toScreen(x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Glow effect
      ctx.strokeStyle = "rgba(16,185,129,0.15)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      for (let i = 0; i <= waveSteps; i++) {
        const x = (xRange * i) / waveSteps;
        const y = waveY(x, t);
        const { sx, sy } = toScreen(x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // ── Particle Markers (transverse motion indicators) ────────

      const particleSpacing = xRange / PARTICLE_COUNT;
      for (let i = 0; i <= PARTICLE_COUNT; i++) {
        const px = i * particleSpacing;
        const py = waveY(px, t);
        const { sx, sy } = toScreen(px, py);
        const { sy: eqSy } = toScreen(px, 0);

        // Vertical line from equilibrium to particle
        ctx.strokeStyle = "rgba(16,185,129,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, eqSy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Particle dot
        const normDisp = Math.abs(py) / amplitude;
        const r = 3 + 2 * normDisp;
        ctx.fillStyle = `rgba(16,185,129,${0.4 + 0.6 * normDisp})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Node / Antinode Markers ────────────────────────────────

      if (showNodes) {
        // Nodes: where sin(kx - ωt) = 0 → kx - ωt = nπ → x = (nπ + ωt)/k
        const phase = omega * t;
        for (let n = -20; n <= 20; n++) {
          const nodeX = (n * Math.PI + phase) / k;
          if (nodeX < 0 || nodeX > xRange) continue;
          const { sx, sy } = toScreen(nodeX, 0);

          // Node marker (X)
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          const ns = 5;
          ctx.beginPath();
          ctx.moveTo(sx - ns, sy - ns);
          ctx.lineTo(sx + ns, sy + ns);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx + ns, sy - ns);
          ctx.lineTo(sx - ns, sy + ns);
          ctx.stroke();

          // Label
          ctx.fillStyle = "#ef4444";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("N", sx, sy - 10);
        }

        // Antinodes: where |sin(kx - ωt)| = 1 → kx - ωt = (n+½)π
        for (let n = -20; n <= 20; n++) {
          const antiX = ((n + 0.5) * Math.PI + phase) / k;
          if (antiX < 0 || antiX > xRange) continue;
          const yVal = waveY(antiX, t);
          const { sx, sy } = toScreen(antiX, yVal);

          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#22c55e";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("A", sx, sy - 10);
        }
      }

      // ── Wavelength Annotation ───────────────────────────────────

      // Find a crest near the center for annotation
      const phase = omega * t;
      // Crest at kx - ωt = π/2 + 2nπ → x = (π/2 + 2nπ + ωt)/k
      let annotX = -1;
      for (let n = -10; n <= 10; n++) {
        const cx = (Math.PI / 2 + 2 * n * Math.PI + phase) / k;
        if (cx > xRange * 0.1 && cx + wavelength < xRange * 0.9) {
          annotX = cx;
          break;
        }
      }
      if (annotX >= 0) {
        const { sx: x1, sy: y1 } = toScreen(annotX, amplitude);
        const { sx: x2 } = toScreen(annotX + wavelength, amplitude);
        const annY = MARGIN.top + 20;

        // Dashed line from crest to annotation line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(139,92,246,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, annY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y1);
        ctx.lineTo(x2, annY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dimension line
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, annY);
        ctx.lineTo(x2, annY);
        ctx.stroke();
        // Ticks
        ctx.beginPath();
        ctx.moveTo(x1, annY - 4);
        ctx.lineTo(x1, annY + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, annY - 4);
        ctx.lineTo(x2, annY + 4);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#8b5cf6";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`λ = ${wavelength.toFixed(1)} m`, (x1 + x2) / 2, annY - 8);
      }

      // ── Amplitude Annotation ────────────────────────────────────

      if (annotX >= 0) {
        const { sx: ax, sy: crestSy } = toScreen(annotX, amplitude);
        const { sy: eqSy } = toScreen(annotX, 0);
        const ampX = ax + 20;

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(245,158,11,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, crestSy);
        ctx.lineTo(ampX + 5, crestSy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, eqSy);
        ctx.lineTo(ampX + 5, eqSy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ampX, crestSy);
        ctx.lineTo(ampX, eqSy);
        ctx.stroke();
        // Ticks
        ctx.beginPath();
        ctx.moveTo(ampX - 4, crestSy);
        ctx.lineTo(ampX + 4, crestSy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ampX - 4, eqSy);
        ctx.lineTo(ampX + 4, eqSy);
        ctx.stroke();

        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`A = ${amplitude.toFixed(1)} m`, ampX + 8, (crestSy + eqSy) / 2 + 4);
      }

      // ── Propagation Arrow ──────────────────────────────────────

      const arrowX = w - MARGIN.right - 50;
      const arrowY = h - MARGIN.bottom + 35;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(arrowX - 30, arrowY);
      ctx.lineTo(arrowX + 30, arrowY);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.moveTo(arrowX + 30, arrowY);
      ctx.lineTo(arrowX + 22, arrowY - 4);
      ctx.lineTo(arrowX + 22, arrowY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`v = ${waveSpeed.toFixed(1)} m/s`, arrowX, arrowY - 10);

      // ── Real-time Data Overlay ────────────────────────────────

      const lines = [
        `t = ${t.toFixed(2)} s`,
        `f = ${frequency.toFixed(1)} Hz`,
        `T = ${period.toFixed(3)} s`,
        `ω = ${omega.toFixed(1)} rad/s`,
        `k = ${k.toFixed(2)} rad/m`,
      ];

      const boxX = originX + 8;
      const boxY = MARGIN.top + 4;
      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.strokeStyle = "rgba(51,65,85,0.5)";
      ctx.lineWidth = 1;
      roundRect(ctx, boxX, boxY, 145, lines.length * 15 + 10, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      lines.forEach((line, i) => {
        ctx.fillText(line, boxX + 8, boxY + 17 + i * 15);
      });
    },
    [amplitude, wavelength, frequency, showNodes, omega, k, waveSpeed, period, waveY]
  );

  // ── Animation Loop ─────────────────────────────────────────────

  useEffect(() => {
    if (!playing) {
      render(timeRef.current);
      return;
    }

    let lastFrame = performance.now();
    const animate = (now: number) => {
      const delta = ((now - lastFrame) / 1000) * speed;
      lastFrame = now;
      timeRef.current += delta;
      render(timeRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, speed, render]);

  // Re-render when params change while paused
  useEffect(() => {
    if (!playing) render(timeRef.current);
  }, [frequency, amplitude, wavelength, showNodes, render, playing]);

  // ── Controls ───────────────────────────────────────────────────

  const progress = period > 0 ? ((timeRef.current % period) / period) * 100 : 0;

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
            className="h-full bg-emerald-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 py-2.5">
          {/* Row 1: Playback + Stats */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Playback buttons */}
            <div className="flex gap-1">
              <Btn onClick={() => setPlaying((p) => !p)} primary>
                {playing ? <PauseIcon /> : <PlayIcon />}
                <span className="ml-1">{playing ? "Pause" : "Play"}</span>
              </Btn>
              <Btn
                onClick={() => {
                  timeRef.current = 0;
                  render(0);
                }}
                title="Reset time"
              >
                <ResetIcon />
              </Btn>
            </div>

            <div className="mx-1 h-5 w-px bg-gray-700" />

            {/* Computed stats */}
            <div className="flex gap-3 text-[11px] font-mono">
              <Stat label="v" value={waveSpeed} unit="m/s" color="text-emerald-400" />
              <Stat label="T" value={period} unit="s" color="text-cyan-400" decimals={3} />
              <Stat label="ω" value={omega} unit="rad/s" color="text-purple-400" />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <input
                  type="checkbox"
                  checked={showNodes}
                  onChange={(e) => onUpdate?.({ showNodes: e.target.checked })}
                  className="accent-emerald-500"
                />
                Show nodes
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-600">Speed:</span>
                {[0.25, 0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                      Math.abs(speed - s) < 0.01
                        ? "bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "bg-gray-800/50 text-gray-500 hover:bg-gray-700/50 hover:text-gray-400"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Parameter Sliders */}
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <Slider
              label="Frequency"
              value={frequency}
              min={0.1}
              max={10}
              step={0.1}
              unit="Hz"
              color="emerald"
              onChange={(v) => onUpdate?.({ frequency: v })}
            />
            <Slider
              label="Amplitude"
              value={amplitude}
              min={0.1}
              max={5}
              step={0.1}
              unit="m"
              color="amber"
              onChange={(v) => onUpdate?.({ amplitude: v })}
            />
            <Slider
              label="Wavelength"
              value={wavelength}
              min={0.5}
              max={20}
              step={0.1}
              unit="m"
              color="purple"
              onChange={(v) => onUpdate?.({ wavelength: v })}
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
            ? "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-900"
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
    emerald: "accent-emerald-500",
    amber: "accent-amber-500",
    purple: "accent-purple-500",
  }[color] ?? "accent-emerald-500";

  const textColor = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  }[color] ?? "text-emerald-400";

  return (
    <label className="flex items-center gap-2 text-[11px] text-gray-400">
      <span className="w-16 text-right shrink-0">{label}</span>
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
