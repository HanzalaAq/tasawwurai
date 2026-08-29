"""
TasawwurAI — FastAPI Application Entry Point.

Creates the FastAPI app, configures CORS, mounts all routes,
and initializes the AI planner with the visualization registry.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.ai.planner import AIPlanner
from app.ai.registry import registry as viz_registry
from app.config import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")

logger = logging.getLogger(__name__)
settings = get_settings()


def _setup_mock_provider(provider) -> None:
    """
    Register keyword-based mock responses for the MockProvider.

    Each response maps trigger keywords to a complete PlannerResponse
    so that speaking (or typing) natural phrases like "imagine a projectile"
    triggers the correct visualization without an OpenAI API key.
    """

    def _sim(subject: str, concept: str, viz_type: str, params: dict,
             title: str, explanation: str, formulas: list[dict], key_points: list[str],
             image_prompt: str = "") -> dict:
        """Helper to build a complete PlannerResponse dict."""
        render_mode = "simulation"
        if image_prompt:
            render_mode = "both"
        return {
            "command": {
                "action": "new",
                "subject": subject,
                "concept": concept,
                "visualization": {"type": viz_type, "parameters": params},
                "theory": {
                    "title": title,
                    "explanation": explanation,
                    "formulas": formulas,
                    "key_points": key_points,
                },
                "render_mode": render_mode,
                "image_prompt": image_prompt,
            },
            "reasoning": f"Mock: keyword matched for {viz_type}",
        }

    def _img(subject: str, concept: str, title: str, explanation: str,
             image_prompt: str, key_points: list[str] | None = None) -> dict:
        """Helper to build an image-only PlannerResponse dict."""
        return {
            "command": {
                "action": "new",
                "subject": subject,
                "concept": concept,
                "visualization": {"type": "placeholder", "parameters": {}},
                "theory": {
                    "title": title,
                    "explanation": explanation,
                    "formulas": [],
                    "key_points": key_points or [],
                },
                "render_mode": "image",
                "image_prompt": image_prompt,
            },
            "reasoning": f"Mock: keyword matched for image ({concept})",
        }

    # --- Physics ---
    projectile = _sim(
        "physics", "projectile_motion", "physics.projectile",
        {"velocity": 25, "angle": 45, "gravity": 9.81},
        "Projectile Motion",
        "A projectile is any object thrown into space. Once launched, the only force "
        "acting on it is gravity. The trajectory forms a perfect parabola.",
        [{"name": "Range", "latex": "R = (v^2 \\sin 2\\theta) / g"},
         {"name": "Max Height", "latex": "H = (v^2 \\sin^2 \\theta) / (2g)"}],
        ["Horizontal velocity stays constant", "Vertical velocity changes due to gravity",
         "Maximum range at 45 degrees"],
        image_prompt="Scientific textbook illustration of projectile motion: a ball launched from "
                     "ground level traces a perfect parabolic arc. Velocity vectors shown at launch "
                     "point — horizontal Vx (blue arrow) and vertical Vy (red arrow) — with angle "
                     "theta labeled between them. Dashed horizontal and vertical grid lines mark the "
                     "apex (labeled 'Max Height H') and landing point (labeled 'Range R'). Clean white "
                     "background with soft blue tones, professional educational diagram quality, "
                     "highly detailed with labeled axes (x, y).",
    )
    for kw in ["projectile", "throw", "launch", "parabola", "trajectory", "thrown"]:
        provider.register_response(kw, projectile)

    wave = _sim(
        "physics", "wave_motion", "physics.wave",
        {"frequency": 2.0, "amplitude": 1.0, "wavelength": 3.0},
        "Wave Motion",
        "A wave is a disturbance that transfers energy through space without "
        "permanent displacement of the particles.",
        [{"name": "Wave Equation", "latex": "v = f \\lambda"},
         {"name": "Period", "latex": "T = 1/f"}],
        ["Transverse waves: displacement perpendicular to propagation",
         "Longitudinal waves: displacement parallel to propagation"],
    )
    for kw in ["wave", "frequency", "amplitude", "wavelength", "vibration", "oscillation"]:
        provider.register_response(kw, wave)

    free_fall = _sim(
        "physics", "free_fall", "physics.free_fall",
        {"height": 100, "gravity": 9.81, "initialVelocity": 0},
        "Free Fall",
        "Free fall is motion under the influence of gravity alone, with no air resistance. "
        "All objects fall at the same rate regardless of mass.",
        [{"name": "Distance", "latex": "d = \\frac{1}{2}gt^2"},
         {"name": "Velocity", "latex": "v = gt"}],
        ["Acceleration is constant at g = 9.81 m/s\u00b2",
         "Mass does not affect fall speed in vacuum"],
    )
    for kw in ["free fall", "falling", "gravity", "drop", "acceleration due to gravity"]:
        provider.register_response(kw, free_fall)

    pendulum = _sim(
        "physics", "pendulum", "physics.pendulum",
        {"length": 2.0, "angle": 30, "gravity": 9.81, "damping": 0.02},
        "Simple Pendulum",
        "A pendulum swings back and forth under gravity. For small angles, the motion "
        "is approximately simple harmonic.",
        [{"name": "Period", "latex": "T = 2\\pi\\sqrt{L/g}"},
         {"name": "Frequency", "latex": "f = 1/T"}],
        ["Period depends on length, not mass",
         "Small angle approximation: sin(theta) ~ theta"],
    )
    for kw in ["pendulum", "swing", "oscillat"]:
        provider.register_response(kw, pendulum)

    # --- Mathematics ---
    quadratic = _sim(
        "math", "quadratic_function", "math.function_graph",
        {"expression": "x^2", "xMin": -10, "xMax": 10, "color": "#3b82f6"},
        "Quadratic Functions",
        "A quadratic function has the form f(x) = ax^2 + bx + c. Its graph is a parabola "
        "that opens upward when a > 0 and downward when a < 0.",
        [{"name": "Standard Form", "latex": "f(x) = ax^2 + bx + c"},
         {"name": "Vertex", "latex": "x = -b / (2a)"}],
        ["The vertex is the minimum or maximum point",
         "The discriminant determines the number of real roots"],
    )
    for kw in ["quadratic", "parabola function", "x squared", "x^2", "second degree"]:
        provider.register_response(kw, quadratic)

    function_graph = _sim(
        "math", "function_graph", "math.function_graph",
        {"expression": "sin(x)", "xMin": -10, "xMax": 10, "color": "#10b981"},
        "Function Graphing",
        "A function maps each input x to exactly one output y. Plotting a function "
        "reveals its shape, behavior, and key features.",
        [{"name": "Function Notation", "latex": "y = f(x)"}],
        ["Domain: set of valid inputs", "Range: set of possible outputs",
         "Zeros: where f(x) = 0"],
    )
    for kw in ["function", "graph", "plot", "sine", "cosine", "sin(", "cos(",
               "curve", "equation graph"]:
        provider.register_response(kw, function_graph)

    derivative = _sim(
        "math", "derivative", "math.derivative",
        {"expression": "x^3 - 3x", "xMin": -4, "xMax": 4, "showTangent": True},
        "Derivatives",
        "The derivative measures the instantaneous rate of change of a function. "
        "Geometrically, it is the slope of the tangent line at any point.",
        [{"name": "Definition", "latex": "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}"},
         {"name": "Power Rule", "latex": "\\frac{d}{dx} x^n = nx^{n-1}"}],
        ["Positive derivative = function is increasing",
         "Zero derivative = possible maximum or minimum"],
    )
    for kw in ["derivative", "differentiat", "slope", "rate of change", "tangent"]:
        provider.register_response(kw, derivative)

    vector = _sim(
        "math", "vector", "math.vector",
        {"x": 3, "y": 4, "showComponents": True, "showMagnitude": True},
        "Vectors",
        "A vector has both magnitude and direction. Vectors are fundamental in physics "
        "and engineering for describing forces, velocities, and displacements.",
        [{"name": "Magnitude", "latex": "|\\vec{v}| = \\sqrt{x^2 + y^2}"},
         {"name": "Direction", "latex": "\\theta = \\arctan(y/x)"}],
        ["Vectors can be added component-wise",
         "Dot product measures alignment between vectors"],
    )
    for kw in ["vector", "magnitude", "direction", "component"]:
        provider.register_response(kw, vector)

    # --- Computer Science ---
    binary_tree = _sim(
        "computer_science", "binary_tree", "cs.binary_tree",
        {"depth": 3, "showTraversal": True},
        "Binary Trees",
        "A binary tree is a hierarchical data structure where each node has at most "
        "two children: left and right. They enable efficient searching and sorting.",
        [{"name": "Max Nodes", "latex": "N = 2^{d+1} - 1"}],
        ["In-order traversal gives sorted output for BST",
         "Time complexity: O(log n) for balanced trees"],
    )
    for kw in ["binary tree", "tree", "node", "leaf", "traversal"]:
        provider.register_response(kw, binary_tree)

    sorting = _sim(
        "computer_science", "sorting_algorithm", "cs.sorting_algorithm",
        {"algorithm": "bubble", "arraySize": 15, "speed": 1.0},
        "Sorting Algorithms",
        "Sorting arranges data in a specific order. Different algorithms trade off "
        "between speed, memory, and simplicity.",
        [{"name": "Bubble Sort", "latex": "O(n^2)"},
         {"name": "Merge Sort", "latex": "O(n \\log n)"}],
        ["Bubble sort compares adjacent elements",
         "Merge sort uses divide and conquer"],
    )
    for kw in ["sort", "bubble", "merge sort", "quick sort", "algorithm", "sorting"]:
        provider.register_response(kw, sorting)

    bfs_dfs = _sim(
        "computer_science", "bfs_dfs", "cs.bfs_dfs",
        {"algorithm": "bfs", "graphSize": 8},
        "BFS & DFS Traversal",
        "Breadth-First Search explores level by level. Depth-First Search goes as deep "
        "as possible before backtracking.",
        [{"name": "BFS Time", "latex": "O(V + E)"},
         {"name": "DFS Time", "latex": "O(V + E)"}],
        ["BFS uses a queue", "DFS uses a stack (or recursion)",
         "BFS finds shortest path in unweighted graphs"],
    )
    for kw in ["bfs", "dfs", "breadth", "depth", "graph traversal", "graph"]:
        provider.register_response(kw, bfs_dfs)

    # --- Biology (image-based) ---
    for kw in ["cell", "organism", "organ", "tissue"]:
        provider.register_response(kw, _img(
            "biology", "cell_structure",
            "Cell Structure",
            "Cells are the basic building blocks of all living organisms. "
            "Animal and plant cells share many organelles but differ in key ways.",
            "Scientific textbook cross-section illustration of an animal cell. The cell is shown "
            "as a large circular cross-section with a soft pink membrane boundary. Inside, the "
            "nucleus is a prominent dark blue sphere labeled 'Nucleus' with visible nucleolus. "
            "Mitochondria are shown as red bean-shaped organelles labeled 'Mitochondria'. "
            "The endoplasmic reticulum appears as winding purple tubes near the nucleus, "
            "and the Golgi apparatus as stacked yellow crescents. Small dots along the ER are "
            "labeled 'Ribosomes'. Clean white background with soft pastel colors, callout lines "
            "pointing to each organelle with text labels. Highly detailed, professional educational "
            "quality scientific illustration.",
            key_points=["Nucleus contains DNA", "Mitochondria produce ATP (energy)",
                        "Cell membrane controls what enters and exits"],
        ))

    for kw in ["dna", "gene", "chromosome", "replication", "genetic"]:
        provider.register_response(kw, _img(
            "biology", "dna_replication",
            "DNA Structure & Replication",
            "DNA is a double helix that carries genetic information. "
            "It replicates by unwinding and using each strand as a template.",
            "Scientific molecular biology illustration of a DNA double helix structure. "
            "The two twisting strands are rendered in 3D with blue and green sugar-phosphate "
            "backbones. Between them, horizontal rungs show the nucleotide base pairs: "
            "Adenine (A) paired with Thymine (T) in warm colors, and Guanine (G) paired "
            "with Cytosine (C) in cool colors, each pair labeled with letters. Thin dashed "
            "lines represent hydrogen bonds between bases. Arrows along the strands indicate "
            "5' to 3' directionality. Soft gradient background from white to light blue, "
            "clean professional educational diagram with callout labels, highly detailed.",
            key_points=["Adenine pairs with Thymine", "Guanine pairs with Cytosine",
                        "DNA replicates semi-conservatively"],
        ))

    # --- Chemistry (image-based) ---
    for kw in ["molecule", "bond", "chemical bond", "compound"]:
        provider.register_response(kw, _img(
            "chemistry", "molecule",
            "Molecular Structure",
            "Molecules are formed when atoms bond together. The shape of a molecule "
            "determines its chemical properties and reactivity.",
            "3D rendered educational chemistry diagram of a water molecule (H2O) in "
            "ball-and-stick model style. A large red sphere labeled 'Oxygen (O)' sits at "
            "the center, connected to two smaller white spheres labeled 'Hydrogen (H)' by "
            "gray cylindrical bonds. The bond angle of 104.5 degrees is marked with a "
            "curved arrow between the bonds. Electron pairs are shown as small blue dots "
            "shared between atoms. The background is clean white with a subtle grid. "
            "Professional scientific illustration with vibrant colors, labeled callouts "
            "for each element and bond angle, highly detailed educational quality.",
            key_points=["Covalent bonds share electrons", "Molecular shape affects properties",
                        "Bond angles determined by electron repulsion"],
        ))

    for kw in ["atom", "electron", "proton", "neutron", "nucleus", "atomic"]:
        provider.register_response(kw, _img(
            "chemistry", "atomic_structure",
            "Atomic Structure",
            "Atoms consist of a dense nucleus (protons + neutrons) surrounded by "
            "electrons in orbital shells.",
            "Scientific textbook illustration of atomic structure using the Bohr model. "
            "At the center, a tightly packed nucleus contains red spheres (protons, labeled "
            "'p+') and blue spheres (neutrons, labeled 'n0'). Surrounding the nucleus are "
            "three concentric orbital shells (K, L, M) drawn as thin gray circles. Small "
            "bright yellow dots orbit on each shell representing electrons (labeled 'e-'). "
            "The shells are spaced proportionally. Arrows show electron transitions between "
            "shells. Clean white background with vibrant primary colors for particles, "
            "callout labels for each component. Professional educational diagram, highly "
            "detailed and clearly labeled.",
            key_points=["Protons define the element", "Electrons determine chemical behavior",
                        "Neutrons add mass but no charge"],
        ))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle. Load manifests and initialize AI planner."""
    # Load visualization manifests from disk
    count = viz_registry.load_manifests_from_disk()
    logger.info("Loaded %d visualization manifests", count)

    # Initialize the AI planner (uses MockProvider if no OpenAI key is set)
    # Always create a MockProvider as fallback in case OpenAI fails at runtime
    from app.ai.openai_provider import MockProvider
    fallback = MockProvider()
    _setup_mock_provider(fallback)

    if settings.openai_api_key:
        from app.ai.openai_provider import OpenAIProvider
        provider = OpenAIProvider()
        planner = AIPlanner(provider=provider, registry=viz_registry, fallback_provider=fallback)
        logger.info("AI Planner initialized with OpenAI provider (MockProvider as fallback)")
    else:
        planner = AIPlanner(provider=fallback, registry=viz_registry)
        logger.info("AI Planner initialized with MockProvider (no API key)")
    app.state.planner = planner
    app.state.viz_registry = viz_registry

    yield  # App runs here

    logger.info("TasawwurAI shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered real-time educational visualization platform.",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes
app.include_router(api_router)
