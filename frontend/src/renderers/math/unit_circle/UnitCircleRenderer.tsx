/**
 * Unit Circle Renderer — animated trigonometry on the unit circle.
 *
 * Canvas 2D with requestAnimationFrame animation loop.
 *
 * Features:
 * - Animated angle with arc readout on the unit circle
 * - sin (yellow), cos (cyan) and tan (red) segments drawn geometrically
 * - Live graph of the selected function traced as the angle sweeps
 * - Degree/radian readouts and quadrant display
 * - Adjustable speed, function, and starting angle
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface UnitCircleParams {
  angle: number;
  function: string;
  speed: number;
}

const TAU = Math.PI * 2;

export default function UnitCircleRenderer({
  parameters,
  onUpdate,
}: RendererProps<UnitCircleParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const initialAngle = parameters.angle ?? 45;
  const fn = ["sin", "cos", "tan"].includes(parameters.function as string)
    ? (parameters.function as "sin" | "cos" | "tan")
    : "sin";
  const speed = parameters.speed ?? 1;

  const [playing, setPlaying] = useState(false);
  const thetaRef = useRef((initialAngle * Math.PI) / 180);
  const [displayDeg, setDisplayDeg] = useState(initialAngle);

  const fnValue = useCallback((t: number): number => {
    if (fn === "sin") return Math.sin(t);
    if (fn === "cos") return Math.cos(t);
    return Math.tan(t);
  }, [fn]);

  // ── Drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const theta = thetaRef.current;

    // ── Circle panel (left) ──
    const cx = w * 0.27;
    const cy = h * 0.5;
    const R = Math.min(w * 0.2, h * 0.34);

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - R - 22, cy);
    ctx.lineTo(cx + R + 22, cy);
    ctx.moveTo(cx, cy - R - 22);
    ctx.lineTo(cx, cy + R + 22);
    ctx.stroke();

    // Circle
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    // Tangent line (for tan segment)
    ctx.strokeStyle = "rgba(248,113,113,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + R, cy - R * 1.4);
    ctx.lineTo(cx + R, cy + R * 1.4);
    ctx.stroke();

    const px = cx + R * Math.cos(theta);
    const py = cy - R * Math.sin(theta); // canvas y is flipped

    // Angle arc
    ctx.strokeStyle = "rgba(250,204,21,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.22, 0, -theta, theta > 0);
    ctx.stroke();
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    const midA = theta / 2;
    ctx.fillText("θ", cx + Math.cos(midA) * R * 0.34, cy - Math.sin(midA) * R * 0.34 + 3);

    // cos segment (along x-axis from center)
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, cy);
    ctx.stroke();

    // sin segment (vertical from x-axis to point)
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // tan segment on tangent line
    const tan = Math.tan(theta);
    if (Math.abs(tan) < 1.35) {
      const ty = cy - R * tan;
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + R, cy);
      ctx.lineTo(cx + R, ty);
      ctx.stroke();
      // Radius extended to tangent line
      ctx.strokeStyle = "rgba(248,113,113,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R, ty);
      ctx.stroke();
    }

    // Radius
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Point P
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 22);
    glow.addColorStop(0, "rgba(168,85,247,0.35)");
    glow.addColorStop(1, "rgba(168,85,247,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c084fc";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, TAU);
    ctx.fill();

    // Labels
    ctx.fillStyle = "#67e8f9";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("cos θ", (cx + px) / 2, cy + 14);
    ctx.fillStyle = "#fde047";
    ctx.fillText("sin θ", px + (Math.cos(theta) >= 0 ? 26 : -26), (cy + py) / 2);
    if (Math.abs(tan) < 1.35) {
      ctx.fillStyle = "#fca5a5";
      ctx.fillText("tan θ", cx + R + 22, cy - R * tan * 0.5);
    }

    // ── Graph panel (right) ──
    const gx0 = w * 0.5;
    const gx1 = w * 0.96;
    const gy0 = h * 0.1;
    const gy1 = h * 0.9;
    const yMax = 1.5;
    const yToPx = (v: number) => gy1 - ((v + yMax) / (2 * yMax)) * (gy1 - gy0);
    const aToPx = (a: number) => gx0 + (a / TAU) * (gx1 - gx0);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let v = -1; v <= 1; v += 0.5) {
      ctx.beginPath();
      ctx.moveTo(gx0, yToPx(v));
      ctx.lineTo(gx1, yToPx(v));
      ctx.stroke();
    }
    for (let a = 0; a <= TAU + 0.01; a += Math.PI / 2) {
      ctx.beginPath();
      ctx.moveTo(aToPx(a), gy0);
      ctx.lineTo(aToPx(a), gy1);
      ctx.stroke();
    }
    // Axis
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(gx0, yToPx(0));
    ctx.lineTo(gx1, yToPx(0));
    ctx.stroke();

    // Full curve (faint)
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let x = gx0; x <= gx1; x += 2) {
      const a = ((x - gx0) / (gx1 - gx0)) * TAU;
      const v = fnValue(a);
      if (!isFinite(v) || Math.abs(v) > yMax) { started = false; continue; }
      if (!started) { ctx.moveTo(x, yToPx(v)); started = true; }
      else ctx.lineTo(x, yToPx(v));
    }
    ctx.stroke();

    // Traced portion (bright, up to current θ)
    const traceColor = fn === "sin" ? "#facc15" : fn === "cos" ? "#22d3ee" : "#f87171";
    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    started = false;
    for (let a = 0; a <= Math.min(theta, TAU); a += 0.01) {
      const v = fnValue(a);
      if (!isFinite(v) || Math.abs(v) > yMax) { started = false; continue; }
      const x = aToPx(a);
      if (!started) { ctx.moveTo(x, yToPx(v)); started = true; }
      else ctx.lineTo(x, yToPx(v));
    }
    ctx.stroke();

    // Current θ marker
    if (theta <= TAU) {
      const mv = fnValue(theta);
      if (isFinite(mv) && Math.abs(mv) <= yMax) {
        const mx = aToPx(theta);
        ctx.strokeStyle = "rgba(192,132,252,0.4)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, yToPx(0));
        ctx.lineTo(mx, yToPx(mv));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#c084fc";
        ctx.beginPath();
        ctx.arc(mx, yToPx(mv), 5, 0, TAU);
        ctx.fill();
      }
    }

    // X-axis labels (radians)
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    const xLabels: [number, string][] = [[0, "0"], [Math.PI / 2, "π/2"], [Math.PI, "π"], [3 * Math.PI / 2, "3π/2"], [TAU, "2π"]];
    xLabels.forEach(([a, l]) => ctx.fillText(l, aToPx(a), gy1 + 14));
    ctx.textAlign = "right";
    ctx.fillText("+1", gx0 - 6, yToPx(1) + 3);
    ctx.fillText("-1", gx0 - 6, yToPx(-1) + 3);

    // Connector line from circle point to graph marker
    if (theta <= TAU && isFinite(fnValue(theta)) && Math.abs(fnValue(theta)) <= yMax) {
      ctx.strokeStyle = "rgba(192,132,252,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(aToPx(theta), yToPx(fnValue(theta)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [fn, fnValue]);

  // ── Animation Loop ──
  const lastFrameRef = useRef(0);
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      thetaRef.current = (thetaRef.current + speed * 0.9 * dt) % TAU;
      setDisplayDeg((thetaRef.current * 180) / Math.PI);

      draw();
      animRef.current = requestAnimationFrame(animate);
    },
    [speed, draw]
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

  // Angle param drives position when changed
  useEffect(() => {
    thetaRef.current = (initialAngle * Math.PI) / 180;
    setDisplayDeg(initialAngle);
    draw();
  }, [initialAngle, draw]);

  const quadrant =
    displayDeg < 90 ? "I" : displayDeg < 180 ? "II" : displayDeg < 270 ? "III" : "IV";
  const t = thetaRef.current;

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-purple-400">θ: {displayDeg.toFixed(1)}° ({t.toFixed(2)} rad)</span>
        <span className="text-yellow-400">sin: {Math.sin(t).toFixed(3)}</span>
        <span className="text-cyan-400">cos: {Math.cos(t).toFixed(3)}</span>
        <span className="text-red-400">tan: {Math.tan(t).toFixed(3)}</span>
        <span className="text-gray-400">quadrant {quadrant}</span>
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
          onClick={() => {
            thetaRef.current = (initialAngle * Math.PI) / 180;
            setPlaying(false);
            setDisplayDeg(initialAngle);
            setTimeout(draw, 0);
          }}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {(["sin", "cos", "tan"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onUpdate?.({ function: f })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
              fn === f
                ? f === "sin"
                  ? "bg-yellow-600/60 text-yellow-200"
                  : f === "cos"
                    ? "bg-cyan-600/60 text-cyan-200"
                    : "bg-red-600/60 text-red-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {f} θ
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Angle
            <input
              type="range" min={0} max={360} step={1}
              value={initialAngle}
              onChange={(e) => onUpdate?.({ angle: parseFloat(e.target.value) })}
              className="h-1 w-20 accent-blue-500"
            />
            <span className="w-9 text-right text-gray-400">{initialAngle.toFixed(0)}°</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Speed
            <input
              type="range" min={0.1} max={3} step={0.1}
              value={speed}
              onChange={(e) => onUpdate?.({ speed: parseFloat(e.target.value) })}
              className="h-1 w-16 accent-blue-500"
            />
            <span className="w-7 text-right text-gray-400">{speed.toFixed(1)}x</span>
          </label>
        </div>
      </div>
    </div>
  );
}
