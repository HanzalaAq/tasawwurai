/**
 * Renderer Registry Initialization.
 *
 * Registers all available renderers with the central registry.
 * This file is imported once at app startup (in the session page layout).
 *
 * To add a new renderer:
 * 1. Create the renderer component in src/renderers/{subject}/{name}/
 * 2. Import it and its manifest below
 * 3. Call registry.register(manifest, Component)
 *
 * No other core files need to change.
 */

import { registry } from "@/engine/registry";
import PlaceholderRenderer from "./PlaceholderRenderer";

// --- Production Renderers ---
import ProjectileRenderer from "./physics/projectile/ProjectileRenderer";
import projectileManifest from "./physics/projectile/manifest.json";
import WaveRenderer from "./physics/wave/WaveRenderer";
import waveManifest from "./physics/wave/manifest.json";
import FunctionGraphRenderer from "./math/function_graph/FunctionGraphRenderer";
import functionGraphManifest from "./math/function_graph/manifest.json";

// --- Register Production Renderers ---
registry.register(projectileManifest as any, ProjectileRenderer);
registry.register(waveManifest as any, WaveRenderer);
registry.register(functionGraphManifest as any, FunctionGraphRenderer);

// --- Register Placeholder Renderers for all other types ---
// These will be replaced with production implementations over time.

const placeholderTypes = [
  { type: "physics.free_fall", subject: "physics", name: "Free Fall Simulator" },
  { type: "physics.pendulum", subject: "physics", name: "Simple Pendulum" },
  { type: "math.derivative", subject: "mathematics", name: "Derivative Visualizer" },
  { type: "math.vector", subject: "mathematics", name: "Vector Visualizer" },
  { type: "cs.binary_tree", subject: "computer_science", name: "Binary Tree" },
  { type: "cs.sorting_algorithm", subject: "computer_science", name: "Sorting Algorithm" },
  { type: "cs.bfs_dfs", subject: "computer_science", name: "BFS/DFS Traversal" },
  { type: "biology.dna_replication", subject: "biology", name: "DNA Replication" },
  { type: "biology.cell", subject: "biology", name: "Cell Structure" },
  { type: "chemistry.molecule", subject: "chemistry", name: "Molecule Viewer" },
  { type: "chemistry.atomic_structure", subject: "chemistry", name: "Atomic Structure" },
];

for (const pt of placeholderTypes) {
  if (!registry.has(pt.type)) {
    registry.register(
      {
        type: pt.type,
        subject: pt.subject,
        name: pt.name,
        description: `${pt.name} — coming soon`,
        parameters: { type: "object", properties: {}, required: [] },
        capabilities: { interactive: false, animated: false, "3d": false },
        technology: "placeholder",
      },
      PlaceholderRenderer
    );
  }
}
