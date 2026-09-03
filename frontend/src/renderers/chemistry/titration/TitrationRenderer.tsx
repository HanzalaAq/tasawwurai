/**
 * Titration Renderer — acid-base titration curve and indicator.
 *
 * Canvas 2D with an auto-titrate animation loop.
 *
 * Features:
 * - Full pH curve for strong or weak acid vs strong base
 * - Henderson-Hasselbalch buffer region for weak acids
 * - Equivalence point marker with live pH at the equivalence volume
 * - Burette/beaker illustration with universal-indicator liquid color
 * - Auto-titrate animation or manual titrant slider
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface TitrationParams {
  acidType: string;
  acidConc: number;
  acidVolume: number;
  baseConc: number;
  titrantVolume: number;
}

const KA = 1.8e-5;
const PKA = 4.7447; // acetic acid

// Universal indicator color stops by pH
const PH_STOPS: [number, [number, number, number]][] = [
  [0, [220, 38, 38]], [2, [234, 88, 12]], [4, [234, 179, 8]], [6, [132, 204, 22]],
  [7, [34, 197, 94]], [8, [16, 185, 129]], [10, [59, 130, 246]], [12, [99, 102, 241]],
  [14, [124, 58, 237]],
];

function indicatorColor(pH: number): string {
  const v = Math.max(0, Math.min(14, pH));
  for (let i = 0; i < PH_STOPS.length - 1; i++) {
    const [p1, c1] = PH_STOPS[i];
    const [p2, c2] = PH_STOPS[i + 1];
    if (v >= p1 && v <= p2) {
      const t = (v - p1) / (p2 - p1);
      const c = c1.map((ch, k) => Math.round(ch + (c2[k] - ch) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(124,58,237)";
}

function computePH(
  acidType: string, acidConc: number, acidVolume: number, baseConc: number, vb: number
): number {
  const weak = acidType === "weak";
  const nA0 = acidConc * acidVolume; // mmol
  const nB = baseConc * vb; // mmol
  const vt = acidVolume + vb; // mL
  const eps = 1e-9;

  if (vb <= eps) {
    return weak
      ? 0.5 * (PKA - Math.log10(acidConc))
      : -Math.log10(acidConc);
  }
  if (nB < nA0 - eps) {
    if (weak) {
      return PKA + Math.log10(nB / (nA0 - nB)); // buffer region
    }
    return -Math.log10((nA0 - nB) / vt);
  }
  if (Math.abs(nB - nA0) <= eps) {
    if (weak) {
      const cs = nA0 / vt; // salt concentration (mol/L)
      return 7 + 0.5 * (PKA + Math.log10(cs));
    }
    return 7.0;
  }
  return 14 + Math.log10((nB - nA0) / vt);
}

export default function TitrationRenderer({
  parameters,
  onUpdate,
}: RendererProps<TitrationParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const acidType = parameters.acidType === "weak" ? "weak" : "strong";
  const acidConc = parameters.acidConc ?? 0.1;
  const acidVolume = parameters.acidVolume ?? 25;
  const baseConc = parameters.baseConc ?? 0.1;
  const rawTitrant = parameters.titrantVolume ?? 0;

  const nA0 = acidConc * acidVolume;
  const veq = nA0 / baseConc;
  const vMax = Math.min(120, Math.max(20, Math.ceil((2 * veq) / 5) * 5));
  const titrantVolume = Math.max(0, Math.min(rawTitrant, vMax));

  const [autoTitrating, setAutoTitrating] = useState(false);

  const pH = computePH(acidType, acidConc, acidVolume, baseConc, titrantVolume);

  // ── Drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ── Plot area (left ~62%) ──
    const px0 = 48, px1 = w * 0.62, py0 = 24, py1 = h - 44;
    const vToPx = (v: number) => px0 + (v / vMax) * (px1 - px0);
    const pToPy = (p: number) => py1 - (p / 14) * (py1 - py0);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    for (let p = 0; p <= 14; p += 2) {
      ctx.beginPath();
      ctx.moveTo(px0, pToPy(p));
      ctx.lineTo(px1, pToPy(p));
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(`${p}`, px0 - 6, pToPy(p) + 3);
    }
    ctx.textAlign = "center";
    for (let v = 0; v <= vMax; v += 10) {
      ctx.beginPath();
      ctx.moveTo(vToPx(v), py0);
      ctx.lineTo(vToPx(v), py1);
      ctx.stroke();
      ctx.fillText(`${v}`, vToPx(v), py1 + 14);
    }
    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px monospace";
    ctx.fillText("NaOH added (mL)", (px0 + px1) / 2, py1 + 32);
    ctx.save();
    ctx.translate(16, (py0 + py1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("pH", 0, 0);
    ctx.restore();

    // pH 7 reference line
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(px0, pToPy(7));
    ctx.lineTo(px1, pToPy(7));
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 400; i++) {
      const v = (vMax * i) / 400;
      const p = computePH(acidType, acidConc, acidVolume, baseConc, v);
      const cp = Math.max(0, Math.min(14, p));
      if (i === 0) ctx.moveTo(vToPx(v), pToPy(cp));
      else ctx.lineTo(vToPx(v), pToPy(cp));
    }
    ctx.stroke();

    // Equivalence marker
    const phEq = computePH(acidType, acidConc, acidVolume, baseConc, veq);
    ctx.strokeStyle = "rgba(250,204,21,0.5)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vToPx(veq), py1);
    ctx.lineTo(vToPx(veq), pToPy(Math.min(14, Math.max(0, phEq))));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(vToPx(veq), pToPy(Math.min(14, Math.max(0, phEq))), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 10px monospace";
    ctx.textAlign = vToPx(veq) > (px0 + px1) / 2 ? "right" : "left";
    ctx.fillText(`Veq = ${veq.toFixed(1)} mL (pH ${phEq.toFixed(1)})`, vToPx(veq) + (vToPx(veq) > (px0 + px1) / 2 ? -8 : 8), pToPy(Math.min(14, Math.max(0, phEq))) - 10);

    // Current position
    if (titrantVolume > 0) {
      ctx.strokeStyle = "rgba(192,132,252,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vToPx(titrantVolume), py1);
      ctx.lineTo(vToPx(titrantVolume), pToPy(Math.min(14, Math.max(0, pH))));
      ctx.stroke();
      ctx.fillStyle = "#c084fc";
      ctx.beginPath();
      ctx.arc(vToPx(titrantVolume), pToPy(Math.min(14, Math.max(0, pH))), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 11px monospace";
      ctx.textAlign = vToPx(titrantVolume) > (px0 + px1) / 2 ? "right" : "left";
      ctx.fillText(`pH ${pH.toFixed(2)}`, vToPx(titrantVolume) + 10, pToPy(Math.min(14, Math.max(0, pH))) - 12);
    }

    // ── Beaker + burette (right panel) ──
    const bx0 = w * 0.72, bx1 = w - 24, by0 = h * 0.3, by1 = h * 0.88;
    const bcx = (bx0 + bx1) / 2;

    // Liquid
    const fillFrac = (acidVolume + titrantVolume) / (acidVolume + vMax);
    const liquidTop = by1 - (by1 - by0 - 8) * fillFrac;
    const liqColor = indicatorColor(pH);
    ctx.fillStyle = liqColor + "88";
    ctx.beginPath();
    ctx.roundRect(bx0 + 4, liquidTop, bx1 - bx0 - 8, by1 - liquidTop - 4, 6);
    ctx.fill();
    // Liquid surface highlight
    ctx.strokeStyle = liqColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx0 + 6, liquidTop);
    ctx.lineTo(bx1 - 6, liquidTop);
    ctx.stroke();

    // Beaker outline
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx0, by0 - 8);
    ctx.lineTo(bx0, by1 - 4);
    ctx.quadraticCurveTo(bcx, by1 + 8, bx1, by1 - 4);
    ctx.lineTo(bx1, by0 - 8);
    ctx.stroke();

    // Burette above the beaker
    const burTop = 16, burBot = by0 - 24;
    const burW = 12;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(bcx - burW / 2, burTop, burW, burBot - burTop);
    ctx.stroke();
    // Base level in burette
    const baseFrac = 1 - titrantVolume / vMax;
    if (baseFrac > 0) {
      ctx.fillStyle = "rgba(59,130,246,0.5)";
      ctx.fillRect(bcx - burW / 2 + 1.5, burTop + 2, burW - 3, (burBot - burTop - 4) * baseFrac);
    }
    // Stopcock + drop
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(bcx - 9, burBot);
    ctx.lineTo(bcx + 9, burBot + 10);
    ctx.moveTo(bcx, burBot + 6);
    ctx.lineTo(bcx, burBot + 16);
    ctx.stroke();
    if (autoTitrating) {
      ctx.fillStyle = "rgba(59,130,246,0.9)";
      ctx.beginPath();
      ctx.arc(bcx, burBot + 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NaOH", bcx, burTop - 4);

    // pH color scale
    const sx = w - 14;
    for (let p = 0; p <= 14; p += 0.5) {
      ctx.fillStyle = indicatorColor(p);
      ctx.fillRect(sx, pToPy(p + 0.25), 8, (py1 - py0) / 28 + 1);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(sx, pToPy(14), 8, py1 - py0);
    // Marker
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(sx - 2, pToPy(Math.min(14, Math.max(0, pH))));
    ctx.lineTo(sx - 8, pToPy(Math.min(14, Math.max(0, pH))) - 4);
    ctx.lineTo(sx - 8, pToPy(Math.min(14, Math.max(0, pH))) + 4);
    ctx.closePath();
    ctx.fill();

    // Big pH readout
    ctx.fillStyle = liqColor;
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`pH ${pH.toFixed(2)}`, bcx, h * 0.14);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px monospace";
    ctx.fillText(`${acidType === "weak" ? "weak" : "strong"} acid + strong base`, bcx, h * 0.14 + 16);
  }, [acidType, acidConc, acidVolume, baseConc, titrantVolume, pH, veq, vMax, autoTitrating]);

  // ── Resize / redraw ──
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

  useEffect(() => {
    draw();
  }, [draw]);

  // ── Auto-titrate ──
  useEffect(() => {
    if (!autoTitrating) return;
    const id = setInterval(() => {
      if (titrantVolume >= vMax) {
        setAutoTitrating(false);
        return;
      }
      onUpdate?.({ titrantVolume: Math.min(titrantVolume + 0.8, vMax) });
    }, 100);
    return () => clearInterval(id);
  }, [autoTitrating, titrantVolume, vMax, onUpdate]);

  const status =
    titrantVolume <= 0.01
      ? "initial acid"
      : titrantVolume < veq - 0.3
        ? acidType === "weak" ? "buffer region" : "acid in excess"
        : titrantVolume <= veq + 0.3
          ? "AT EQUIVALENCE"
          : "base in excess";

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-emerald-400">pH: {pH.toFixed(2)}</span>
        <span className="text-purple-400">NaOH: {titrantVolume.toFixed(1)} mL</span>
        <span className="text-yellow-400">Veq: {veq.toFixed(1)} mL</span>
        <span className={status === "AT EQUIVALENCE" ? "font-bold text-yellow-300" : "text-gray-400"}>
          {status}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        <button
          onClick={() => setAutoTitrating((a) => !a)}
          className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          {autoTitrating ? "⏸ Stop" : "🧪 Auto-titrate"}
        </button>
        <button
          onClick={() => { setAutoTitrating(false); onUpdate?.({ titrantVolume: 0 }); }}
          className="rounded-lg bg-gray-700/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
        >
          ↺ Reset
        </button>

        <div className="mx-1 h-5 w-px bg-gray-700" />

        {(["strong", "weak"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { onUpdate?.({ acidType: t, titrantVolume: 0 }); }}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
              acidType === t
                ? "bg-emerald-600/60 text-emerald-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {t} acid
          </button>
        ))}

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Titrant
          <input
            type="range" min={0} max={vMax} step={0.5}
            value={titrantVolume}
            onChange={(e) => { setAutoTitrating(false); onUpdate?.({ titrantVolume: parseFloat(e.target.value) }); }}
            className="h-1 w-24 accent-emerald-500"
          />
          <span className="w-12 text-right text-gray-400">{titrantVolume.toFixed(1)}mL</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          C acid
          <input
            type="range" min={0.05} max={1} step={0.05}
            value={acidConc}
            onChange={(e) => onUpdate?.({ acidConc: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-emerald-500"
          />
          <span className="w-10 text-right text-gray-400">{acidConc.toFixed(2)}M</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          C base
          <input
            type="range" min={0.05} max={1} step={0.05}
            value={baseConc}
            onChange={(e) => onUpdate?.({ baseConc: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-emerald-500"
          />
          <span className="w-10 text-right text-gray-400">{baseConc.toFixed(2)}M</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          V acid
          <input
            type="range" min={10} max={50} step={5}
            value={acidVolume}
            onChange={(e) => onUpdate?.({ acidVolume: parseFloat(e.target.value) })}
            className="h-1 w-14 accent-emerald-500"
          />
          <span className="w-11 text-right text-gray-400">{acidVolume.toFixed(0)}mL</span>
        </label>
      </div>
    </div>
  );
}
