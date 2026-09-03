/**
 * Thin Lens Renderer — ray diagram for converging and diverging lenses.
 *
 * Canvas 2D (static, redrawn on parameter change).
 *
 * Features:
 * - Thin lens equation 1/f = 1/do + 1/di with live solution
 * - Principal rays: parallel ray (through focus) and center ray
 * - Real image (solid) vs virtual image (dashed, with ray extensions)
 * - Converging/diverging lens shapes
 * - Focal points and 2F markers
 * - Magnification readout and image nature
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RendererProps } from "@/engine/types";

interface LensParams {
  focalLength: number;
  objectDistance: number;
  objectHeight: number;
  lensType: string;
}

export default function LensRenderer({
  parameters,
  onUpdate,
}: RendererProps<LensParams>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dimsRef = useRef({ w: 800, h: 500, dpr: 1 });

  const focalLength = parameters.focalLength ?? 15;
  const objectDistance = parameters.objectDistance ?? 40;
  const objectHeight = parameters.objectHeight ?? 8;
  const lensType = parameters.lensType === "diverging" ? "diverging" : "converging";

  // ── Thin lens math ──
  const f = lensType === "diverging" ? -focalLength : focalLength;
  const di = 1 / (1 / f - 1 / objectDistance); // cm (can be ±Infinity)
  const magnification = -di / objectDistance;
  const imageHeight = magnification * objectHeight;
  const imageAtInfinity = !isFinite(di) || Math.abs(di) > 300;
  const isReal = isFinite(di) && di > 0 && !imageAtInfinity;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const axisY = h * 0.55;
    const lensX = w * 0.52;
    const scale = Math.min((lensX - 30) / 90, (w - lensX - 30) / 90); // px per cm
    const LH = h * 0.62;
    const lensTop = axisY - LH / 2;

    const objectX = lensX - objectDistance * scale;
    const objTipY = axisY - objectHeight * scale;
    const diDraw = Math.max(-85, Math.min(85, di));
    const imageX = lensX + diDraw * scale;
    const hiDraw = Math.max(-45, Math.min(45, imageHeight));
    const imgTipY = axisY - hiDraw * scale;

    // ── Optical axis ──
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(10, axisY);
    ctx.lineTo(w - 10, axisY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Lens ──
    const bulge = lensType === "converging" ? 20 : 16;
    ctx.fillStyle = "rgba(103,232,249,0.12)";
    ctx.strokeStyle = "rgba(103,232,249,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (lensType === "converging") {
      ctx.moveTo(lensX, lensTop);
      ctx.quadraticCurveTo(lensX + bulge, axisY, lensX, lensTop + LH);
      ctx.quadraticCurveTo(lensX - bulge, axisY, lensX, lensTop);
    } else {
      ctx.moveTo(lensX, lensTop);
      ctx.quadraticCurveTo(lensX - bulge, axisY, lensX, lensTop + LH);
      ctx.quadraticCurveTo(lensX + bulge, axisY, lensX, lensTop);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ── Focal points and 2F markers ──
    const fpx = Math.abs(f) * scale;
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    const fMarks: [number, string][] = [[lensX - fpx, "F"], [lensX + fpx, "F"]];
    fMarks.forEach(([x, label]) => {
      ctx.beginPath();
      ctx.arc(x, axisY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(label, x, axisY + 18);
    });
    const f2Marks: [number, string][] = [[lensX - 2 * fpx, "2F"], [lensX + 2 * fpx, "2F"]];
    f2Marks.forEach(([x, label]) => {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, axisY - 6);
      ctx.lineTo(x, axisY + 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "9px monospace";
      ctx.fillText(label, x, axisY + 18);
    });

    // ── Arrow helper ──
    const drawArrow = (x: number, baseY: number, tipY2: number, color: string, dashed: boolean) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, tipY2);
      ctx.stroke();
      ctx.setLineDash([]);
      const dir = tipY2 < baseY ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, tipY2);
      ctx.lineTo(x - 5, tipY2 - dir * 8);
      ctx.lineTo(x + 5, tipY2 - dir * 8);
      ctx.closePath();
      ctx.fill();
    };

    // ── Object ──
    drawArrow(objectX, axisY, objTipY, "#818cf8", false);
    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Object", objectX, axisY + 32);
    ctx.fillStyle = "rgba(129,140,248,0.8)";
    ctx.font = "9px monospace";
    ctx.fillText(`${objectHeight.toFixed(0)} cm`, objectX - 26, (axisY + objTipY) / 2);

    // ── Rays ──
    const extendToRightEdge = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      if (Math.abs(dx) < 1e-6) return { x: x1, y: y2 };
      const t = (w - 8 - x1) / dx;
      return { x: x1 + dx * t, y: y1 + (y2 - y1) * t };
    };

    // Ray 2 (center ray): object tip → lens center → right edge
    const centerPt = { x: lensX, y: axisY };
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    const c2 = extendToRightEdge(objTipY ? objectX : objectX, objTipY, centerPt.x, centerPt.y);
    ctx.beginPath();
    ctx.moveTo(objectX, objTipY);
    ctx.lineTo(centerPt.x, centerPt.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();

    // Ray 1 (parallel ray): tip → (lensX, tipY) → refracted through image tip
    const lensPt1 = { x: lensX, y: objTipY };
    ctx.strokeStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(objectX, objTipY);
    ctx.lineTo(lensPt1.x, lensPt1.y);
    ctx.stroke();

    if (!imageAtInfinity) {
      let dir: { x: number; y: number };
      if (isReal) {
        // Refracted ray travels toward (and past) the real image tip
        dir = { x: imageX - lensPt1.x, y: imgTipY - lensPt1.y };
      } else {
        // Refracted ray diverges — its backward extension reaches the virtual image tip
        dir = { x: lensPt1.x - imageX, y: lensPt1.y - imgTipY };
        // Dashed backward extension to the virtual image tip
        ctx.strokeStyle = "rgba(250,204,21,0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(lensPt1.x, lensPt1.y);
        ctx.lineTo(imageX, imgTipY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const end = extendToRightEdge(lensPt1.x, lensPt1.y, lensPt1.x + dir.x, lensPt1.y + dir.y);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lensPt1.x, lensPt1.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else {
      // Image at infinity: refracted rays parallel to the center ray
      const dir = { x: lensX - objectX, y: axisY - objTipY };
      const end = extendToRightEdge(lensPt1.x, lensPt1.y, lensPt1.x + dir.x, lensPt1.y + dir.y);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lensPt1.x, lensPt1.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // ── Image ──
    if (!imageAtInfinity) {
      const virtual = !isReal;
      drawArrow(imageX, axisY, imgTipY, virtual ? "#c084fc" : "#fb923c", virtual);
      ctx.fillStyle = virtual ? "#d8b4fe" : "#fdba74";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(virtual ? "Virtual image" : "Real image", imageX, virtual ? imgTipY - 10 : imgTipY - 10);
      ctx.fillStyle = virtual ? "rgba(192,132,252,0.8)" : "rgba(251,146,60,0.85)";
      ctx.font = "9px monospace";
      ctx.fillText(`${Math.abs(imageHeight).toFixed(1)} cm`, imageX + 30, (axisY + imgTipY) / 2);
    }

    // ── Equation chip ──
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(20, 16, 250, 58, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#67e8f9";
    ctx.fillText("1/f = 1/d\u2092 + 1/d\u1d62", 32, 36);
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(
      `f=${f.toFixed(0)}  do=${objectDistance.toFixed(0)}  di=${imageAtInfinity ? "∞" : di.toFixed(1)} cm`,
      32, 52
    );
    ctx.fillText(
      `m = ${imageAtInfinity ? "∞" : magnification.toFixed(2)}  (${imageAtInfinity ? "image at ∞" : isReal ? "real, inverted" : "virtual, upright"})`,
      32, 66
    );

    // ── Infinity warning ──
    if (imageAtInfinity) {
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Object at focal point — image at infinity", w * 0.5, h * 0.15);
    }
  }, [f, lensType, objectDistance, objectHeight, di, imageHeight, magnification, isReal, imageAtInfinity]);

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

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-cyan-400">f: {f.toFixed(0)} cm</span>
        <span className="text-indigo-400">do: {objectDistance.toFixed(0)} cm</span>
        <span className="text-orange-400">di: {imageAtInfinity ? "∞" : di.toFixed(1)} cm</span>
        <span className="text-yellow-400">m: {imageAtInfinity ? "∞" : magnification.toFixed(2)}×</span>
        <span className="text-purple-400">hi: {imageAtInfinity ? "∞" : imageHeight.toFixed(1)} cm</span>
        <span className="text-gray-400">
          {imageAtInfinity ? "image at ∞" : isReal ? "real · inverted" : "virtual · upright"}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        {(["converging", "diverging"] as const).map((lt) => (
          <button
            key={lt}
            onClick={() => onUpdate?.({ lensType: lt })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
              lensType === lt
                ? "bg-cyan-600/60 text-cyan-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {lt}
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-gray-700" />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Focal
          <input
            type="range" min={5} max={40} step={1}
            value={focalLength}
            onChange={(e) => onUpdate?.({ focalLength: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-cyan-500"
          />
          <span className="w-12 text-right text-gray-400">{focalLength.toFixed(0)}cm</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Obj dist
          <input
            type="range" min={10} max={80} step={1}
            value={objectDistance}
            onChange={(e) => onUpdate?.({ objectDistance: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-cyan-500"
          />
          <span className="w-12 text-right text-gray-400">{objectDistance.toFixed(0)}cm</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Obj h
          <input
            type="range" min={2} max={15} step={0.5}
            value={objectHeight}
            onChange={(e) => onUpdate?.({ objectHeight: parseFloat(e.target.value) })}
            className="h-1 w-16 accent-cyan-500"
          />
          <span className="w-11 text-right text-gray-400">{objectHeight.toFixed(1)}cm</span>
        </label>
        <span className="ml-auto text-[10px] text-gray-600">
          drag object distance past F to flip between real and virtual images
        </span>
      </div>
    </div>
  );
}
