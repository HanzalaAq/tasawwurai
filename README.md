# TasawwurAI

An AI-powered interactive learning platform that turns spoken or typed topics into live, animated educational visualizations — covering physics, mathematics, biology, chemistry, and computer science.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
   - [Backend](#backend-python--fastapi)
   - [Frontend](#frontend-nextjs)
4. [Environment Variables](#environment-variables)
5. [Running in Demo Mode (No API Key)](#running-in-demo-mode-no-api-key)
6. [Renderer Catalogue](#renderer-catalogue)
   - [Physics](#physics)
   - [Mathematics](#mathematics)
   - [Computer Science](#computer-science)
   - [Biology](#biology)
   - [Chemistry](#chemistry)
   - [Generic Fallback](#generic-graph-fallback)
7. [Adding a New Renderer](#adding-a-new-renderer)
8. [Project Structure](#project-structure)

---

## Overview

TasawwurAI connects a FastAPI WebSocket backend to a Next.js frontend. When a user describes a concept (by voice or text), the AI planner returns a structured `VisualizationCommand`. The frontend looks up the matching renderer in a plugin registry and renders a production-quality, interactive animation — no page reload required.

**Key features**

- 14 built-in production renderers across 5 subjects
- Plugin-based renderer registry — drop in a new folder and it auto-registers
- Works fully offline in **Demo Mode** (mock provider, no OpenAI key needed)
- Recharts-powered generic graph fallback for any plottable data without a dedicated renderer
- Real-time WebSocket with automatic exponential-backoff reconnection

---

## Architecture

```
TasawwurAI/
├── backend/          FastAPI + WebSocket server
│   └── app/
│       ├── main.py               Startup, CORS, manifest loading
│       ├── config.py             Pydantic-settings env config
│       └── websocket/
│           ├── handler.py        Message routing + mock data
│           ├── manager.py        Connection manager
│           └── protocol.py       Typed message models
└── frontend/         Next.js 15 + React 19
    └── src/
        ├── app/session/[id]/     Session page (WebSocket client)
        ├── engine/               VisualizationEngine dispatcher
        ├── renderers/            All renderer plugins (see catalogue)
        │   ├── index.ts          Central registry
        │   └── GenericGraphRenderer.tsx   Recharts fallback
        ├── hooks/useWebSocket.ts
        ├── lib/websocket.ts      WS client with reconnect
        └── types/                Shared TypeScript types
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

---

### Backend (Python + FastAPI)

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy the environment file and fill in values (see below)
cp .env.example .env

# 4. Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.  
Health check: `GET /health` → `{"status": "ok", "service": "tasawwur-api"}`

---

### Frontend (Next.js)

```bash
cd frontend

# 1. Install dependencies (includes recharts + framer-motion)
npm install

# 2. Start the dev server
npm run dev
```

Open `http://localhost:3000` in your browser.  
Navigate to `http://localhost:3000/session/<any-id>` to open a session.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and edit as needed.

| Variable | Default | Description |
|---|---|---|
| `TASAWWUR_DEBUG` | `true` | Enable FastAPI debug mode and verbose logging |
| `TASAWWUR_HOST` | `0.0.0.0` | Host address for uvicorn |
| `TASAWWUR_PORT` | `8000` | Port for uvicorn |
| `TASAWWUR_CORS_ORIGINS` | `["http://localhost:3000"]` | JSON array of allowed CORS origins |
| `TASAWWUR_DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection string (optional, not yet used) |
| `TASAWWUR_OPENAI_API_KEY` | *(empty)* | OpenAI API key — leave blank to run in Demo Mode |
| `TASAWWUR_OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for the AI planner |

**Frontend environment** — create `frontend/.env.local` if you need to point at a non-default backend:

```env
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Running in Demo Mode (No API Key)

Leave `TASAWWUR_OPENAI_API_KEY` empty. The backend automatically activates **MockProvider**, which responds to test messages with pre-built visualization payloads for all 14 built-in renderer types. The Quick Test Controls panel in the session page exposes one button per renderer for instant testing.

---

## Renderer Catalogue

Every renderer is a self-contained React component that accepts `{ parameters, onUpdate }` props and is registered via a `manifest.json` file. The `VisualizationEngine` dispatches to the correct renderer by matching the `type` field in the incoming `VisualizationCommand`.

---

### Physics

#### Free Fall Simulator
| | |
|---|---|
| **Type key** | `physics.free_fall` |
| **Technology** | Canvas 2D |
| **File** | `renderers/physics/free_fall/FreeFallRenderer.tsx` |

Simulates an object falling under gravity with an optional air resistance coefficient. Renders a ghost-trail ball, real-time position/velocity/acceleration readouts, and a live mini-graph overlay.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `height` | number | `100` | Drop height in metres (1–1000) |
| `gravity` | number | `9.81` | Gravitational acceleration m/s² |
| `airResistance` | number | `0` | Drag coefficient (0 = vacuum) |
| `mass` | number | `1` | Object mass in kg |

Interactive controls: Play/Step/Reset, planet gravity presets (Earth/Moon/Mars/Jupiter), drag slider.

---

#### Simple Pendulum
| | |
|---|---|
| **Type key** | `physics.pendulum` |
| **Technology** | Canvas 2D |
| **File** | `renderers/physics/pendulum/PendulumRenderer.tsx` |

Animated pendulum with damping. Displays the angle arc, velocity vector, KE/PE energy bar, and calculated period.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `length` | number | `2.0` | String length in metres (0.5–10) |
| `angle` | number | `30` | Initial release angle in degrees (1–170) |
| `gravity` | number | `9.81` | Gravitational acceleration m/s² |
| `damping` | number | `0.02` | Damping coefficient (0 = no damping) |

Interactive controls: length/damping sliders, planet gravity presets, Play/Pause/Reset.

---

### Mathematics

#### Derivative Visualizer
| | |
|---|---|
| **Type key** | `math.derivative` |
| **Technology** | Canvas 2D |
| **File** | `renderers/math/derivative/DerivativeRenderer.tsx` |

Plots f(x) and f′(x) with a movable animated tangent line. Marks critical points and shows the instantaneous slope value.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `expression` | string | `"x^3 - 3*x"` | Math expression (e.g. `sin(x)`, `x^2`) |
| `xMin` | number | `-4` | Left bound of the plot |
| `xMax` | number | `4` | Right bound of the plot |
| `showTangent` | boolean | `true` | Toggle animated tangent line |

Interactive controls: tangent scrubber, pause/center, derivative overlay toggle.

---

#### Vector Visualizer
| | |
|---|---|
| **Type key** | `math.vector` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/math/vector/VectorRenderer.tsx` |

2D vector operations with draggable arrow endpoints. Animates the parallelogram for vector addition and shows magnitude/angle readouts.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `x` | number | `3` | Vector A x-component |
| `y` | number | `4` | Vector A y-component |
| `bx` | number | `1` | Vector B x-component |
| `by` | number | `2` | Vector B y-component |
| `operation` | string | `"add"` | `add`, `subtract`, `scale`, `dot` |
| `showComponents` | boolean | `true` | Show dashed component projections |
| `showMagnitude` | boolean | `true` | Show magnitude labels |

---

### Computer Science

#### Sorting Algorithm Visualizer
| | |
|---|---|
| **Type key** | `cs.sorting_algorithm` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/cs/sorting_algorithm/SortingRenderer.tsx` |

Animated bar chart that steps through a sorting algorithm frame by frame. Bars are colour-coded: blue (default), red (comparing), yellow (swapping), green (sorted).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `algorithm` | string | `"bubble"` | `bubble`, `selection`, `insertion`, `merge`, `quick` |
| `arraySize` | number | `15` | Number of bars (5–40) |
| `speed` | number | `1.0` | Playback speed multiplier (0.1–5) |

Interactive controls: algorithm selector, speed slider, Play/Step/New Array, comparison and swap counters.

---

#### Binary Tree Visualizer
| | |
|---|---|
| **Type key** | `cs.binary_tree` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/cs/binary_tree/BinaryTreeRenderer.tsx` |

Renders a balanced binary tree and animates traversal order, highlighting nodes as they are visited.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `depth` | number | `3` | Tree depth (1–5) |
| `showTraversal` | boolean | `true` | Enable traversal animation |
| `traversalType` | string | `"inorder"` | `inorder`, `preorder`, `postorder` |

Interactive controls: traversal type selector, depth slider, Traverse/Reset/New Tree, visited counter.

---

#### BFS / DFS Graph Traversal
| | |
|---|---|
| **Type key** | `cs.bfs_dfs` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/cs/bfs_dfs/BFSDFSRenderer.tsx` |

10-node graph with animated traversal. A side panel shows the live queue (BFS) or stack (DFS) state and traversal order.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `algorithm` | string | `"bfs"` | `bfs` or `dfs` |
| `startNode` | string | `"A"` | Starting node label |
| `speed` | number | `1.0` | Traversal speed multiplier |

Interactive controls: BFS/DFS toggle, start-node selector, speed slider, Traverse/Reset.

---

### Biology

#### DNA Replication
| | |
|---|---|
| **Type key** | `biology.dna_replication` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/biology/dna_replication/DNAReplicationRenderer.tsx` |

Animated double helix that unwinds to reveal a replication fork. Base pairs (A-T, G-C) are labelled with dashed hydrogen bonds; 5′→3′ direction arrows show strand polarity.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `basePairs` | number | `12` | Number of base pairs displayed (6–20) |
| `animating` | boolean | `true` | Auto-play the unwinding animation |
| `showLabels` | boolean | `true` | Show base-pair labels |

Interactive controls: base-pair count slider, Play/Pause/Reset, labels toggle.

---

#### Cell Structure
| | |
|---|---|
| **Type key** | `biology.cell` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/biology/cell/CellRenderer.tsx` |

Interactive animal cell cross-section. Clicking any organelle highlights it and shows a description. Includes subtle idle animations (mitochondria drift, ER pulse).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `showLabels` | boolean | `true` | Show organelle name labels |
| `cellType` | string | `"animal"` | `animal` (plant cell planned) |

Organelles rendered: Cell Membrane, Nucleus, Mitochondria, Rough ER, Smooth ER, Golgi Apparatus, Ribosomes.

---

### Chemistry

#### Atomic Structure
| | |
|---|---|
| **Type key** | `chemistry.atomic_structure` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/chemistry/atomic_structure/AtomicStructureRenderer.tsx` |

Bohr model with animated electrons orbiting their shells. Supports electron excitation transitions between shells.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `element` | string | `"carbon"` | Preset: `hydrogen`, `helium`, `carbon`, `oxygen`, `neon`, `sodium`, `iron` |
| `showLabels` | boolean | `true` | Show proton/neutron/electron counts |

Interactive controls: element selector, Excite Electron button, shell configuration display.

---

#### Molecule Viewer
| | |
|---|---|
| **Type key** | `chemistry.molecule` |
| **Technology** | SVG + Framer Motion |
| **File** | `renderers/chemistry/molecule/MoleculeRenderer.tsx` |

Ball-and-stick molecular models with animated bond formation. Bond angles are annotated; bond types (covalent, ionic) are indicated.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `molecule` | string | `"water"` | Preset: `water`, `co2`, `methane`, `ammonia`, `nacl` |
| `showAngles` | boolean | `true` | Show bond-angle annotations |
| `showLabels` | boolean | `true` | Show atom element labels |

---

### Generic Graph Fallback

| | |
|---|---|
| **Type key** | *(any unrecognised type with plottable data)* |
| **Technology** | Recharts |
| **File** | `renderers/GenericGraphRenderer.tsx` |

When no dedicated renderer matches the incoming type, `VisualizationEngine` checks whether the parameters contain `data`, `chartType`, or `expression`. If so, it renders via `GenericGraphRenderer` using Recharts with built-in animated transitions.

Supported chart types (auto-detected or explicit via `chartType`): `line`, `bar`, `scatter`, `area`.

---

## Adding a New Renderer

1. Create a folder: `frontend/src/renderers/<subject>/<concept>/`
2. Add `manifest.json`:
   ```json
   {
     "type": "subject.concept",
     "subject": "subject",
     "name": "Human-readable Name",
     "description": "...",
     "parameters": { "type": "object", "properties": { ... }, "required": [] },
     "capabilities": { "interactive": true, "animated": true, "3d": false },
     "technology": "canvas-2d | svg | recharts"
   }
   ```
3. Implement `MyRenderer.tsx`:
   ```tsx
   import type { RendererProps } from "@/types";

   interface Params { /* your params */ }

   export default function MyRenderer({ parameters, onUpdate }: RendererProps<Params>) {
     // ...
   }
   ```
4. Register in `frontend/src/renderers/index.ts`:
   ```ts
   import MyRenderer from "./subject/concept/MyRenderer";
   import myManifest from "./subject/concept/manifest.json";

   registry.register(myManifest as any, MyRenderer);
   ```
5. Add a mock entry in `backend/app/websocket/handler.py` under `MOCK_VISUALIZATIONS`:
   ```python
   "subject.concept": {
       "visualization": VisualizationPayload(type="subject.concept", parameters={...}),
       "theory": TheoryBlock(title="...", explanation="...", formulas=[], key_points=[]),
   }
   ```
6. Add a test button in `frontend/src/app/session/[id]/page.tsx` inside the `scenarios` array:
   ```ts
   { subject: "subject", concept: "concept", label: "My Renderer" }
   ```

---

## Project Structure

```
TasawwurAI/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   └── websocket/
│   │       ├── handler.py          Message router + MOCK_VISUALIZATIONS
│   │       ├── manager.py          WebSocket connection manager
│   │       └── protocol.py         Pydantic message models
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx            Landing page
    │   │   └── session/[id]/
    │   │       └── page.tsx        Session page + Quick Test Controls
    │   ├── engine/
    │   │   └── VisualizationEngine.tsx
    │   ├── renderers/
    │   │   ├── index.ts            Central registry
    │   │   ├── GenericGraphRenderer.tsx
    │   │   ├── physics/
    │   │   │   ├── projectile/
    │   │   │   ├── wave/
    │   │   │   ├── free_fall/
    │   │   │   └── pendulum/
    │   │   ├── math/
    │   │   │   ├── function_graph/
    │   │   │   ├── derivative/
    │   │   │   └── vector/
    │   │   ├── cs/
    │   │   │   ├── sorting_algorithm/
    │   │   │   ├── binary_tree/
    │   │   │   └── bfs_dfs/
    │   │   ├── biology/
    │   │   │   ├── dna_replication/
    │   │   │   └── cell/
    │   │   └── chemistry/
    │   │       ├── atomic_structure/
    │   │       └── molecule/
    │   ├── hooks/
    │   │   └── useWebSocket.ts
    │   ├── lib/
    │   │   └── websocket.ts
    │   └── types/
    ├── package.json
    └── tsconfig.json
```
