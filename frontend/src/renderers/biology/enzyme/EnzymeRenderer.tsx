/**
 * Enzyme Kinetics Renderer — Michaelis-Menten simulation.
 *
 * Canvas 2D with requestAnimationFrame animation loop.
 *
 * Features:
 * - Michaelis-Menten curve v = Vmax·[S]/(Km+[S]) with live operating point
 * - Competitive inhibitor shifts apparent Km (curve shown before/after)
 * - Vmax asymptote and ½Vmax markers
 * - Animated reaction vessel: substrates enter the active site and leave as products
 * - Adjustable substrate, Vmax, Km, and inhibitor concentration
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface EnzymeParams {
  substrate: number;
  vmax: number;
  km: number;
  inhibitor: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: "substrate" | "product";
  age: number;
}

const S_MAX = 100; // mM plot range

export default function EnzymeRenderer({
  parameters,
  onUpdate,
}: RendererProps<EnzymeParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const substrate = parameters.substrate ?? 40;
  const vmax = parameters.vmax ?? 60;
  const km = parameters.km ?? 15;
  const inhibitor = parameters.inhibitor ?? 0;

  // Competitive inhibition: apparent Km increases with inhibitor concentration
  const kmApp = km * (1 + inhibitor / 25);
  const rate = (vmax * substrate) / (kmApp + substrate);
  const rateNoInhibitor = (vmax * substrate) / (km + substrate);

  const [playing, setPlaying] = useState(true);
  const [products, setProducts] = useState(0);
  const productsRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const carryRef = useRef(0);

  // ── Particle simulation + drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ── Left panel: MM curve ──
    const px0 = 56, px1 = w * 0.55, py0 = 24, py1 = h - 44;
    const xToPx = (s: number) => px0 + (s / S_MAX) * (px1 - px0);
    const yToPx = (v: number) => py1 - (v / (vmax * 1.15)) * (py1 - py0);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.textAlign = "center";
    for (let s = 0; s <= S_MAX; s += 20) {
      ctx.beginPath();
      ctx.moveTo(xToPx(s), py0);
      ctx.lineTo(xToPx(s), py1);
      ctx.stroke();
      ctx.fillText(`${s}`, xToPx(s), py1 + 14);
    }
    ctx.textAlign = "right";
    for (let v = 0; v <= vmax; v += vmax / 4) {
      ctx.beginPath();
      ctx.moveTo(px0, yToPx(v));
      ctx.lineTo(px1, yToPx(v));
      ctx.stroke();
      ctx.fillText(v.toFixed(0), px0 - 6, yToPx(v) + 3);
    }
    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "center";
    ctx.font = "10px monospace";
    ctx.fillText("[S] (mM)", (px0 + px1) / 2, py1 + 30);
    ctx.save();
    ctx.translate(18, (py0 + py1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("v (µmol/s)", 0, 0);
    ctx.restore();

    // Vmax asymptote
    ctx.strokeStyle = "rgba(249,115,22,0.5)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px0, yToPx(vmax));
    ctx.lineTo(px1, yToPx(vmax));
    ctx.stroke();
    ctx.fillStyle = "#fb923c";
    ctx.textAlign = "left";
    ctx.font = "bold 10px monospace";
    ctx.fillText("Vmax", px1 - 34, yToPx(vmax) - 6);

    // ½Vmax marker lines (current Km)
    ctx.strokeStyle = "rgba(250,204,21,0.35)";
    ctx.beginPath();
    ctx.moveTo(xToPx(kmApp), yToPx(vmax / 2));
    ctx.lineTo(xToPx(kmApp), py1);
    ctx.moveTo(px0, yToPx(vmax / 2));
    ctx.lineTo(xToPx(kmApp), yToPx(vmax / 2));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#facc15";
    ctx.font = "10px monospace";
    ctx.fillText(`Km' = ${kmApp.toFixed(0)}`, xToPx(kmApp) + 4, yToPx(vmax / 2) - 8);

    // Uninhibited curve (faint reference)
    if (inhibitor > 0.5) {
      ctx.strokeStyle = "rgba(52,211,153,0.3)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let s = 0; s <= S_MAX; s += 1) {
        const v = (vmax * s) / (km + s);
        if (s === 0) ctx.moveTo(xToPx(s), yToPx(v));
        else ctx.lineTo(xToPx(s), yToPx(v));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current curve
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let s = 0; s <= S_MAX; s += 1) {
      const v = (vmax * s) / (kmApp + s);
      if (s === 0) ctx.moveTo(xToPx(s), yToPx(v));
      else ctx.lineTo(xToPx(s), yToPx(v));
    }
    ctx.stroke();

    // Operating point
    const opX = xToPx(Math.min(substrate, S_MAX));
    const opY = yToPx(rate);
    ctx.strokeStyle = "rgba(192,132,252,0.4)";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(opX, py1);
    ctx.lineTo(opX, opY);
    ctx.stroke();
    ctx.setLineDash([]);
    const opGlow = ctx.createRadialGradient(opX, opY, 0, opX, opY, 14);
    opGlow.addColorStop(0, "rgba(192,132,252,0.5)");
    opGlow.addColorStop(1, "rgba(192,132,252,0)");
    ctx.fillStyle = opGlow;
    ctx.beginPath();
    ctx.arc(opX, opY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c084fc";
    ctx.beginPath();
    ctx.arc(opX, opY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8b4fe";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = opX > (px0 + px1) / 2 ? "right" : "left";
    ctx.fillText(`v = ${rate.toFixed(1)}`, opX + (opX > (px0 + px1) / 2 ? -10 : 10), opY - 10);

    // ── Right panel: reaction vessel ──
    const vx0 = w * 0.6, vx1 = w - 20, vy0 = 20, vy1 = h - 20;
    const ex = (vx0 + vx1) / 2;
    const ey = (vy0 + vy1) / 2 + 20;

    // Vessel border
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(vx0, vy0, vx1 - vx0, vy1 - vy0, 12);
    ctx.stroke();

    // Enzyme (pac-man style with active site gap facing left)
    ctx.fillStyle = "rgba(129,140,248,0.25)";
    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, 26, 0.45, Math.PI * 2 - 0.45);
    ctx.lineTo(ex - 14, ey - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("E", ex + 4, ey + 3);

    // Particles
    particlesRef.current.forEach((p) => {
      const r = p.kind === "substrate" ? 5 : 5;
      const color = p.kind === "substrate" ? "#22d3ee" : "#fb923c";
      const alpha = p.kind === "product" ? Math.max(0, 1 - p.age / 2.5) : 0.9;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (p.kind === "substrate") {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "7px monospace";
        ctx.fillText("S", p.x, p.y + 2.5);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "7px monospace";
        ctx.fillText("P", p.x, p.y + 2.5);
      }
      ctx.globalAlpha = 1;
    });

    // Counters
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`products: ${productsRef.current}`, ex, vy1 - 8);
  }, [substrate, vmax, km, kmApp, inhibitor, rate]);

  // ── Simulation loop ──
  const lastFrameRef = useRef(0);
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const dt = Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      if (playing) {
        const { w, h } = dimsRef.current;
        const vx0 = w * 0.6, vx1 = w - 20, vy0 = 20, vy1 = h - 20;
        const ex = (vx0 + vx1) / 2;
        const ey = (vy0 + vy1) / 2 + 20;

        // Maintain substrate particle population ∝ [S]
        const target = Math.max(2, Math.round(substrate / 6));
        const alive = particlesRef.current.filter((p) => p.kind === "substrate").length;
        if (alive < target) {
          particlesRef.current.push({
            x: vx0 + 20 + Math.random() * (vx1 - vx0 - 40),
            y: vy0 + 20 + Math.random() * (vy1 - vy0 - 40),
            vx: (Math.random() - 0.5) * 40,
            vy: (Math.random() - 0.5) * 40,
            kind: "substrate",
            age: 0,
          });
        }

        // Move particles
        particlesRef.current.forEach((p) => {
          // Substrates drift toward the active site (left side of enzyme)
          if (p.kind === "substrate") {
            const tx = ex - 34;
            const dx = tx - p.x;
            const dy = ey - p.y;
            const d = Math.hypot(dx, dy) || 1;
            p.vx += (dx / d) * 60 * dt;
            p.vy += (dy / d) * 60 * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
          } else {
            p.age += dt;
            p.vy -= 25 * dt; // products drift up and fade
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          // Bounce inside vessel
          if (p.x < vx0 + 8 || p.x > vx1 - 8) p.vx *= -1;
          if (p.y < vy0 + 8 || p.y > vy1 - 8) p.vy *= -1;
        });

        // Conversions at rate v (scaled for visual clarity)
        carryRef.current += (rate / 6) * dt;
        while (carryRef.current >= 1) {
          carryRef.current -= 1;
          // Convert the substrate particle nearest the site
          const subs = particlesRef.current
            .map((p, i) => ({ p, i, d: Math.hypot(p.x - (ex - 34), p.y - ey) }))
            .filter((o) => o.p.kind === "substrate")
            .sort((a, b) => a.d - b.d);
          if (subs.length > 0) {
            const s = subs[0];
            particlesRef.current[s.i] = {
              x: ex - 30, y: ey, vx: -60, vy: -40,
              kind: "product", age: 0,
            };
            productsRef.current += 1;
            setProducts(productsRef.current);
          } else break;
        }

        // Remove faded products
        particlesRef.current = particlesRef.current.filter((p) => p.kind !== "product" || p.age < 2.5);
      }

      draw();
      animRef.current = requestAnimationFrame(animate);
    },
    [playing, rate, substrate, draw]
  );

  useEffect(() => {
    lastFrameRef.current = 0;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

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

  const resetSim = useCallback(() => {
    particlesRef.current = [];
    productsRef.current = 0;
    carryRef.current = 0;
    setProducts(0);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-emerald-400">v: {rate.toFixed(1)} µmol/s</span>
        <span className="text-gray-400">{((rate / vmax) * 100).toFixed(0)}% of Vmax</span>
        <span className="text-yellow-400">Km: {km.toFixed(0)} mM{inhibitor > 0.5 ? ` → ${kmApp.toFixed(0)} (with I)` : ""}</span>
        {inhibitor > 0.5 && (
          <span className="text-red-400">
            rate ↓ {(((rateNoInhibitor - rate) / rateNoInhibitor) * 100).toFixed(0)}% vs uninhibited
          </span>
        )}
        <span className="text-gray-500">products: {products}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={resetSim}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          [S]
          <input
            type="range" min={1} max={100} step={1}
            value={substrate}
            onChange={(e) => onUpdate?.({ substrate: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-emerald-500"
          />
          <span className="w-11 text-right text-gray-400">{substrate.toFixed(0)}mM</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Vmax
          <input
            type="range" min={10} max={100} step={5}
            value={vmax}
            onChange={(e) => onUpdate?.({ vmax: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-emerald-500"
          />
          <span className="w-14 text-right text-gray-400">{vmax.toFixed(0)}µmol</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Km
          <input
            type="range" min={1} max={50} step={1}
            value={km}
            onChange={(e) => onUpdate?.({ km: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-emerald-500"
          />
          <span className="w-11 text-right text-gray-400">{km.toFixed(0)}mM</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Inhibitor
          <input
            type="range" min={0} max={100} step={5}
            value={inhibitor}
            onChange={(e) => onUpdate?.({ inhibitor: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-red-500"
          />
          <span className="w-9 text-right text-gray-400">{inhibitor.toFixed(0)}%</span>
        </label>
      </div>
    </div>
  );
}
