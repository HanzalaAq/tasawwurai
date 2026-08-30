/**
 * Generic Graph Renderer — Recharts-based fallback for data visualizations.
 *
 * Used when no specific renderer is registered but the visualization data
 * is plottable as a chart. Automatically selects chart type based on
 * the data shape and parameters.
 *
 * Features:
 * - Line charts for continuous data
 * - Bar charts for categorical data
 * - Scatter plots for point data
 * - Area charts for cumulative data
 * - Animated transitions via Recharts
 * - Auto-detects chart type from parameters
 */

"use client";

import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RendererProps } from "@/engine/types";

interface GenericParams {
  chartType?: string; // "line" | "bar" | "scatter" | "area"
  data?: Record<string, number | string>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  title?: string;
}

// Generate sample data if none provided
function generateSampleData(type: string): Record<string, number | string>[] {
  switch (type) {
    case "bar":
      return [
        { name: "A", value: 30 }, { name: "B", value: 50 },
        { name: "C", value: 20 }, { name: "D", value: 70 },
        { name: "E", value: 45 }, { name: "F", value: 60 },
      ];
    case "scatter":
      return Array.from({ length: 20 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
      }));
    default: // line, area
      return Array.from({ length: 30 }, (_, i) => ({
        x: i,
        y: Math.sin(i * 0.5) * 50 + 50 + Math.random() * 10,
      }));
  }
}

function detectChartType(params: GenericParams): string {
  if (params.chartType) return params.chartType;
  if (params.data && params.data.length > 0) {
    const first = params.data[0];
    const keys = Object.keys(first);
    if (keys.length >= 2) {
      const vals = keys.map((k) => typeof first[k]);
      if (vals.filter((v) => v === "number").length >= 2) return "scatter";
      if (vals.includes("string")) return "bar";
    }
  }
  return "line";
}

const CHART_TYPES = ["line", "bar", "scatter", "area"];

export default function GenericGraphRenderer({
  parameters,
  onUpdate,
}: RendererProps<GenericParams>) {
  const chartType = detectChartType(parameters);
  const xKey = parameters.xKey ?? (chartType === "scatter" ? "x" : chartType === "bar" ? "name" : "x");
  const yKey = parameters.yKey ?? "y";
  const color = parameters.color ?? "#6366f1";
  const title = parameters.title ?? "";

  const data = useMemo(
    () => parameters.data ?? generateSampleData(chartType),
    [parameters.data, chartType]
  );

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    const gridProps = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.06)" };
    const axisProps = { stroke: "rgba(255,255,255,0.3)", fontSize: 11 };
    const tooltipStyle = {
      contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 },
      labelStyle: { color: "#9ca3af" },
    };

    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]}
              animationDuration={800} animationBegin={0} />
          </BarChart>
        );
      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} name="X" />
            <YAxis dataKey={yKey} {...axisProps} name="Y" />
            <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill={color} animationDuration={800} />
          </ScatterChart>
        );
      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey={yKey} stroke={color}
              fill="url(#colorGrad)" animationDuration={800} />
          </AreaChart>
        );
      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey={yKey} stroke={color}
              strokeWidth={2} dot={{ r: 3, fill: color }}
              animationDuration={800} />
          </LineChart>
        );
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Title */}
      {title && (
        <div className="px-5 pt-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0 px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="capitalize text-indigo-400">{chartType} chart</span>
        <span className="text-gray-400">Points: {data.length}</span>
        <span className="text-gray-500">X: {xKey}, Y: {yKey}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950/50 px-4 py-2.5">
        {CHART_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onUpdate?.({ chartType: type })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
              chartType === type
                ? "bg-indigo-600/60 text-indigo-200"
                : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
            }`}
          >
            {type}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600 italic">Generic data visualization</span>
      </div>
    </div>
  );
}
