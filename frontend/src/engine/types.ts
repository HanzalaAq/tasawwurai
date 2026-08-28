/**
 * Visualization Engine — type definitions.
 *
 * These types define the contract between the engine, renderers, and the
 * backend visualization commands. They are the single source of truth
 * for what a visualization command looks like on the frontend.
 */

import type { ComponentType } from "react";

// --- Renderer Manifest ---

export interface RendererCapabilities {
  interactive: boolean;
  animated: boolean;
  "3d": boolean;
}

export interface ParameterSchema {
  type: string;
  default?: unknown;
  min?: number;
  max?: number;
  unit?: string;
  description?: string;
}

export interface RendererManifest {
  type: string;
  subject: string;
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ParameterSchema>;
    required?: string[];
  };
  capabilities: RendererCapabilities;
  technology: string;
}

// --- Renderer Props Contract ---

/**
 * Every renderer component must accept these props.
 * This is the contract between the engine and individual renderers.
 */
export interface RendererProps<P = Record<string, unknown>> {
  /** Current parameters from the visualization command. */
  parameters: P;
  /** Callback when the user interacts with the visualization. */
  onUpdate?: (partial: Partial<P>) => void;
}

// --- Visualization Command ---

export interface FormulaItem {
  name: string;
  latex: string;
}

export interface TheoryBlock {
  title: string;
  explanation: string;
  formulas: FormulaItem[];
  key_points: string[];
}

export interface VisualizationPayload {
  type: string;
  parameters: Record<string, unknown>;
}

export interface VisualizationCommand {
  type: "visualization_command";
  command_id: string;
  action: "new" | "update" | "none";
  subject: string;
  concept: string;
  visualization: VisualizationPayload;
  theory: TheoryBlock;
  timestamp: number;
}

// --- Registry Entry ---

export interface RendererEntry {
  manifest: RendererManifest;
  Component: ComponentType<RendererProps<any>>;
}
