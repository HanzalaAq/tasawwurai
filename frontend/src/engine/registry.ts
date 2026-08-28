/**
 * Renderer Registry — the central lookup table for visualization renderers.
 *
 * Maps visualization type strings (e.g. "physics.projectile") to their
 * React component + manifest. This is the backbone of the plugin architecture.
 *
 * Adding a new renderer:
 * 1. Call `registry.register(manifest, Component)` in the registry init file.
 * 2. That's it — no other core code needs to change.
 */

import type { ComponentType } from "react";
import type { RendererEntry, RendererManifest, RendererProps } from "./types";

class RendererRegistry {
  private entries = new Map<string, RendererEntry>();

  /** Register a renderer: manifest + React component. */
  register(manifest: RendererManifest, Component: ComponentType<RendererProps<any>>): void {
    if (this.entries.has(manifest.type)) {
      console.warn(`[Registry] Overwriting renderer: ${manifest.type}`);
    }
    this.entries.set(manifest.type, { manifest, Component });
  }

  /** Resolve a renderer by type. Returns null if not found. */
  resolve(type: string): RendererEntry | null {
    return this.entries.get(type) ?? null;
  }

  /** Get the manifest for a specific type. */
  getManifest(type: string): RendererManifest | null {
    return this.entries.get(type)?.manifest ?? null;
  }

  /** Get all registered manifests (for display / debugging). */
  getAllManifests(): RendererManifest[] {
    return Array.from(this.entries.values()).map((e) => e.manifest);
  }

  /** Get all registered type strings. */
  getAllTypes(): string[] {
    return Array.from(this.entries.keys());
  }

  /** Check if a type is registered. */
  has(type: string): boolean {
    return this.entries.has(type);
  }
}

/** Singleton registry instance used throughout the app. */
export const registry = new RendererRegistry();
