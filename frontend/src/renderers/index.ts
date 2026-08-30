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

// --- Physics Renderers (Canvas 2D) ---
import ProjectileRenderer from "./physics/projectile/ProjectileRenderer";
import projectileManifest from "./physics/projectile/manifest.json";
import WaveRenderer from "./physics/wave/WaveRenderer";
import waveManifest from "./physics/wave/manifest.json";
import FreeFallRenderer from "./physics/free_fall/FreeFallRenderer";
import freeFallManifest from "./physics/free_fall/manifest.json";
import PendulumRenderer from "./physics/pendulum/PendulumRenderer";
import pendulumManifest from "./physics/pendulum/manifest.json";

// --- Math Renderers ---
import FunctionGraphRenderer from "./math/function_graph/FunctionGraphRenderer";
import functionGraphManifest from "./math/function_graph/manifest.json";
import DerivativeRenderer from "./math/derivative/DerivativeRenderer";
import derivativeManifest from "./math/derivative/manifest.json";
import VectorRenderer from "./math/vector/VectorRenderer";
import vectorManifest from "./math/vector/manifest.json";

// --- Computer Science Renderers (SVG + Framer Motion) ---
import SortingRenderer from "./cs/sorting_algorithm/SortingRenderer";
import sortingManifest from "./cs/sorting_algorithm/manifest.json";
import BinaryTreeRenderer from "./cs/binary_tree/BinaryTreeRenderer";
import binaryTreeManifest from "./cs/binary_tree/manifest.json";
import BFSDFSRenderer from "./cs/bfs_dfs/BFSDFSRenderer";
import bfsDfsManifest from "./cs/bfs_dfs/manifest.json";

// --- Biology Renderers (SVG + Framer Motion) ---
import DNAReplicationRenderer from "./biology/dna_replication/DNAReplicationRenderer";
import dnaManifest from "./biology/dna_replication/manifest.json";
import CellRenderer from "./biology/cell/CellRenderer";
import cellManifest from "./biology/cell/manifest.json";

// --- Chemistry Renderers (SVG + Framer Motion) ---
import AtomicStructureRenderer from "./chemistry/atomic_structure/AtomicStructureRenderer";
import atomicManifest from "./chemistry/atomic_structure/manifest.json";
import MoleculeRenderer from "./chemistry/molecule/MoleculeRenderer";
import moleculeManifest from "./chemistry/molecule/manifest.json";

// --- Generic Graph Fallback (Recharts) ---
import GenericGraphRenderer from "./GenericGraphRenderer";

// ── Register Production Renderers ──

// Physics
registry.register(projectileManifest as any, ProjectileRenderer);
registry.register(waveManifest as any, WaveRenderer);
registry.register(freeFallManifest as any, FreeFallRenderer);
registry.register(pendulumManifest as any, PendulumRenderer);

// Math
registry.register(functionGraphManifest as any, FunctionGraphRenderer);
registry.register(derivativeManifest as any, DerivativeRenderer);
registry.register(vectorManifest as any, VectorRenderer);

// Computer Science
registry.register(sortingManifest as any, SortingRenderer);
registry.register(binaryTreeManifest as any, BinaryTreeRenderer);
registry.register(bfsDfsManifest as any, BFSDFSRenderer);

// Biology
registry.register(dnaManifest as any, DNAReplicationRenderer);
registry.register(cellManifest as any, CellRenderer);

// Chemistry
registry.register(atomicManifest as any, AtomicStructureRenderer);
registry.register(moleculeManifest as any, MoleculeRenderer);

// ── Register GenericGraphRenderer as fallback for "generic_graph" type ──
registry.register(
  {
    type: "generic_graph",
    subject: "general",
    name: "Generic Graph",
    description: "Recharts-based data visualization fallback",
    parameters: { type: "object", properties: {}, required: [] },
    capabilities: { interactive: true, animated: true, "3d": false },
    technology: "recharts",
  },
  GenericGraphRenderer
);

// ── Export GenericGraphRenderer for use in VisualizationEngine fallback ──
export { GenericGraphRenderer };
