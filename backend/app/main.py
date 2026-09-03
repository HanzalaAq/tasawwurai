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
    triggers the correct visualization without any LLM credentials.
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
    )
    for kw in ["projectile", "projectiles", "projectile motion", "throw", "throws",
               "throwing", "thrown", "launch", "launching", "launched",
               "trajectory", "trajectories", "cannon", "ballistics"]:
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
    for kw in ["wave", "waves", "frequency", "amplitude", "wavelength",
               "vibration", "sound", "hertz", "periodic motion"]:
        provider.register_response(kw, wave)

    free_fall = _sim(
        "physics", "free_fall", "physics.free_fall",
        {"height": 100, "gravity": 9.81},
        "Free Fall",
        "Free fall is motion under the influence of gravity alone, with no air resistance. "
        "All objects fall at the same rate regardless of mass.",
        [{"name": "Distance", "latex": "d = \\frac{1}{2}gt^2"},
         {"name": "Velocity", "latex": "v = gt"}],
        ["Acceleration is constant at g = 9.81 m/s\u00b2",
         "Mass does not affect fall speed in vacuum"],
    )
    for kw in ["free fall", "falling", "falls", "gravity", "gravitational",
               "drop", "dropped", "dropping", "acceleration due to gravity"]:
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
    for kw in ["pendulum", "swing", "swinging", "oscillation", "oscillations",
               "oscillating", "simple harmonic"]:
        provider.register_response(kw, pendulum)

    spring_mass = _sim(
        "physics", "simple_harmonic_motion", "physics.spring_mass",
        {"mass": 2.0, "springConstant": 50, "amplitude": 0.8, "damping": 0.05},
        "Spring-Mass Oscillator",
        "A mass on a spring oscillates with simple harmonic motion. The restoring "
        "force follows Hooke's law, F = -kx, and the period depends only on the "
        "mass and spring constant — not on amplitude.",
        [{"name": "Hooke's Law", "latex": "F = -kx"},
         {"name": "Period", "latex": "T = 2\\pi\\sqrt{m/k}"}],
        ["Acceleration is proportional to displacement, in the opposite direction",
         "Energy trades between kinetic and elastic potential",
         "Damping gradually removes energy from the system"],
    )
    for kw in ["spring", "springs", "spring mass", "shm", "simple harmonic motion",
               "simple harmonic", "oscillator", "hooke", "hooke's law", "hookes law"]:
        provider.register_response(kw, spring_mass)

    collision = _sim(
        "physics", "momentum_collisions", "physics.collision",
        {"massA": 2, "velocityA": 4, "massB": 4, "velocityB": -2, "restitution": 1},
        "Collision Lab",
        "When two objects collide, momentum is always conserved. Kinetic energy is "
        "conserved only in perfectly elastic collisions — watch it convert to heat "
        "and sound as the restitution drops below one.",
        [{"name": "Momentum", "latex": "p = mv"},
         {"name": "Elastic Collision", "latex": "\\frac{1}{2}m_1v_1^2 + \\frac{1}{2}m_2v_2^2 = \\text{const}"}],
        ["Momentum is conserved in all collisions",
         "Perfectly inelastic collisions lose the most kinetic energy",
         "Equal masses exchange velocities in elastic collisions"],
    )
    for kw in ["collision", "collisions", "collide", "momentum", "elastic", "inelastic",
               "crash", "impact", "conservation of momentum", "restitution"]:
        provider.register_response(kw, collision)

    lens = _sim(
        "physics", "ray_optics", "physics.lens",
        {"focalLength": 15, "objectDistance": 40, "objectHeight": 8, "lensType": "converging"},
        "Thin Lens Ray Optics",
        "Light rays refract through a lens and converge (or diverge) to form an image. "
        "The thin lens equation relates focal length, object distance, and image "
        "distance. Drag the object past the focal point to see a real image "
        "become virtual.",
        [{"name": "Thin Lens Equation", "latex": "\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}"},
         {"name": "Magnification", "latex": "m = -d_i/d_o = h_i/h_o"}],
        ["Converging lenses focus parallel rays to the focal point",
         "An object beyond F forms a real, inverted image",
         "Diverging lenses always form virtual, upright images"],
    )
    for kw in ["lens", "lenses", "optics", "ray diagram", "focal length", "converging",
               "diverging", "magnifying glass", "image formation"]:
        provider.register_response(kw, lens)

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
    for kw in ["quadratic", "quadratics", "parabola", "parabolas", "x squared",
               "x^2", "second degree"]:
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
    for kw in ["function", "functions", "graph", "graphs", "plot", "plotting",
               "sine", "cosine", "curve", "curves", "sin(", "cos(",
               "exponential", "logarithm", "logarithmic", "log function",
               "natural log", "trigonometric", "trigonometry", "polynomial",
               "linear function", "square root"]:
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
    for kw in ["derivative", "derivatives", "differentiate", "differentiation",
               "differentiating", "slope", "rate of change", "tangent"]:
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
    for kw in ["vector", "vectors", "magnitude", "direction", "component",
               "components", "dot product", "resultant"]:
        provider.register_response(kw, vector)

    unit_circle = _sim(
        "math", "unit_circle", "math.unit_circle",
        {"angle": 45, "function": "sin", "speed": 1},
        "Unit Circle & Trigonometry",
        "Every point on the unit circle is (cos θ, sin θ). Watch the angle sweep "
        "around the circle and see how sine and cosine are simply the coordinates "
        "of that point — the graph draws itself.",
        [{"name": "Pythagorean Identity", "latex": "\\sin^2\\theta + \\cos^2\\theta = 1"},
         {"name": "Tangent", "latex": "\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}"}],
        ["Sine is the y-coordinate, cosine the x-coordinate",
         "Tangent is the slope of the radius line",
         "The four quadrants fix the signs of each ratio"],
    )
    for kw in ["unit circle", "sohcahtoa", "sine cosine", "sin and cos",
               "trig function", "trig functions", "radians"]:
        provider.register_response(kw, unit_circle)

    riemann = _sim(
        "math", "integration", "math.riemann",
        {"expression": "x^2", "n": 8, "method": "left", "xMin": 0, "xMax": 2},
        "Riemann Sums & Integration",
        "To find the area under a curve, slice it into rectangles. As the number "
        "of rectangles grows, the sum converges to the exact integral — that "
        "limit IS the definite integral.",
        [{"name": "Riemann Sum", "latex": "\\int_a^b f(x)\\,dx = \\lim_{n \\to \\infty} \\sum_{i=1}^{n} f(x_i)\\,\\Delta x"},
         {"name": "Fundamental Theorem", "latex": "\\int_a^b f(x)\\,dx = F(b) - F(a)"}],
        ["Left sums overestimate increasing functions",
         "Midpoint sums converge faster than left or right",
         "The exact area is the limit as n approaches infinity"],
    )
    for kw in ["riemann", "riemann sum", "riemann sums", "integration", "integral",
               "integrals", "integrating", "area under the curve", "area under curve",
               "antiderivative", "definite integral"]:
        provider.register_response(kw, riemann)

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
    for kw in ["binary tree", "binary trees", "tree", "trees", "node", "nodes",
               "traversal", "bst", "binary search tree", "leaf", "leaves"]:
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
    for kw in ["sort", "sorting", "sorted", "bubble", "bubble sort", "merge sort",
               "mergesort", "quick sort", "quicksort", "insertion sort",
               "selection sort", "algorithm", "algorithms"]:
        provider.register_response(kw, sorting)

    bfs_dfs = _sim(
        "computer_science", "bfs_dfs", "cs.bfs_dfs",
        {"algorithm": "bfs", "startNode": "A", "speed": 1.0},
        "BFS & DFS Traversal",
        "Breadth-First Search explores level by level. Depth-First Search goes as deep "
        "as possible before backtracking.",
        [{"name": "BFS Time", "latex": "O(V + E)"},
         {"name": "DFS Time", "latex": "O(V + E)"}],
        ["BFS uses a queue", "DFS uses a stack (or recursion)",
         "BFS finds shortest path in unweighted graphs"],
    )
    for kw in ["bfs", "dfs", "breadth first", "breadth-first", "depth first",
               "depth-first", "graph traversal", "graph search", "search algorithm",
               "shortest path"]:
        provider.register_response(kw, bfs_dfs)

    pathfinding = _sim(
        "computer_science", "pathfinding", "cs.pathfinding",
        {"algorithm": "astar", "wallDensity": 0.25, "speed": 5, "diagonal": True},
        "Pathfinding: Dijkstra, A*, Greedy",
        "Grid search algorithms find the shortest path very differently. Dijkstra "
        "expands uniformly in all directions, A* steers toward the goal with a "
        "heuristic, and Greedy trusts the heuristic alone — fast but not always optimal.",
        [{"name": "A* Cost", "latex": "f(n) = g(n) + h(n)"},
         {"name": "Dijkstra", "latex": "O((V+E)\\log V)"}],
        ["Dijkstra guarantees the shortest path but explores everywhere",
         "A* uses an admissible heuristic to prune the search",
         "Greedy best-first can return suboptimal paths"],
    )
    for kw in ["pathfinding", "path finding", "dijkstra", "a star", "a*", "astar",
               "greedy", "greedy best-first", "greedy best first", "greedy algorithm",
               "heuristic search", "shortest path algorithm", "maze solving", "maze solver"]:
        provider.register_response(kw, pathfinding)

    hanoi = _sim(
        "computer_science", "recursion", "cs.tower_of_hanoi",
        {"disks": 4, "speed": 1},
        "Tower of Hanoi (Recursion)",
        "Move the whole stack to the target peg, one disk at a time, never "
        "placing a larger disk on a smaller one. The recursive solution: move "
        "n−1 disks aside, move the biggest disk, then move the stack on top.",
        [{"name": "Recurrence", "latex": "T(n) = 2T(n-1) + 1 = 2^n - 1"}],
        ["Base case: one disk moves directly",
         "Each recursive call solves a smaller tower",
         "Each extra disk doubles (plus one) the moves"],
    )
    for kw in ["hanoi", "tower of hanoi", "towers of hanoi", "recursion", "recursive",
               "recursive algorithm", "call stack", "base case"]:
        provider.register_response(kw, hanoi)

    # --- Biology (interactive renderers) ---
    cell = _sim(
        "biology", "cell_structure", "biology.cell",
        {"cellType": "animal", "showLabels": True},
        "Cell Structure",
        "Cells are the basic building blocks of all living organisms. Animal and "
        "plant cells share many organelles but differ in key ways. Click any "
        "organelle in the visualization to learn its function.",
        [],
        ["Nucleus contains DNA and controls the cell",
         "Mitochondria produce ATP (energy)",
         "Cell membrane controls what enters and exits"],
    )
    for kw in ["cell", "cells", "organelle", "organelles", "organism", "tissue",
               "membrane", "mitochondria", "cytoplasm", "ribosome",
               "golgi", "endoplasmic reticulum"]:
        provider.register_response(kw, cell)

    dna = _sim(
        "biology", "dna_replication", "biology.dna_replication",
        {"basePairs": 12, "animating": True, "showLabels": True},
        "DNA Structure & Replication",
        "DNA is a double helix that carries genetic information. It replicates by "
        "unwinding and using each strand as a template for a new complementary "
        "strand. Watch the replication fork travel down the helix.",
        [{"name": "Base Pairs", "latex": "A \\leftrightarrow T, \\quad G \\leftrightarrow C"}],
        ["Adenine (A) pairs with Thymine (T)",
         "Guanine (G) pairs with Cytosine (C)",
         "DNA replicates semi-conservatively"],
    )
    for kw in ["dna", "gene", "genes", "genetics", "genetic", "chromosome",
               "chromosomes", "replication", "helix", "double helix",
               "nucleotide", "base pair", "base pairs"]:
        provider.register_response(kw, dna)

    punnett = _sim(
        "biology", "mendelian_genetics", "biology.punnett",
        {"parent1": "Aa", "parent2": "Aa", "traitDominant": "Tall", "traitRecessive": "Short"},
        "Punnett Square Heredity",
        "Gregor Mendel's pea plants revealed how traits pass between generations. "
        "Cross two heterozygous parents and watch the classic 3:1 phenotype ratio "
        "appear — each square is an equally likely offspring.",
        [{"name": "Monohybrid Cross", "latex": "Aa \\times Aa \\Rightarrow 1AA : 2Aa : 1aa"}],
        ["Each parent contributes one allele at random",
         "Heterozygotes show the dominant phenotype",
         "Genotype ratio 1:2:1 gives phenotype ratio 3:1"],
    )
    for kw in ["punnett", "punnett square", "punnet square", "genotype", "genotypes",
               "allele", "alleles", "heredity", "inheritance", "mendelian",
               "mendel", "dominant", "recessive", "heterozygous", "homozygous",
               "monohybrid cross"]:
        provider.register_response(kw, punnett)

    enzyme = _sim(
        "biology", "enzyme_kinetics", "biology.enzyme",
        {"substrate": 40, "vmax": 60, "km": 15, "inhibitor": 0},
        "Enzyme Kinetics (Michaelis-Menten)",
        "Enzymes speed up reactions by binding substrates at the active site. "
        "Rate rises with substrate concentration but saturates at Vmax as every "
        "enzyme gets busy. Competitive inhibitors raise the apparent Km.",
        [{"name": "Michaelis-Menten", "latex": "v = \\frac{V_{max}[S]}{K_m + [S]}"},
         {"name": "Lineweaver-Burk", "latex": "\\frac{1}{v} = \\frac{K_m}{V_{max}}\\frac{1}{[S]} + \\frac{1}{V_{max}}"}],
        ["Vmax is reached when the enzyme is saturated",
         "Km is the substrate concentration at half of Vmax",
         "Competitive inhibitors compete for the active site"],
    )
    for kw in ["enzyme", "enzymes", "michaelis", "michaelis menten", "michaelis-menten",
               "substrate", "catalyst", "enzyme kinetics", "active site",
               "competitive inhibitor", "inhibitor"]:
        provider.register_response(kw, enzyme)

    # --- Chemistry (interactive renderers) ---
    molecule = _sim(
        "chemistry", "molecule", "chemistry.molecule",
        {"molecule": "water", "showAngles": True, "showLabels": True},
        "Molecular Structure",
        "Molecules are formed when atoms bond together. The shape of a molecule "
        "determines its chemical properties and reactivity. Switch between "
        "presets to compare bond angles and structures.",
        [],
        ["Covalent bonds share electrons",
         "Molecular shape affects properties",
         "Bond angles determined by electron repulsion"],
    )
    for kw in ["molecule", "molecules", "molecular", "bond", "bonds", "bonding",
               "chemical bond", "compound", "compounds", "covalent",
               "water molecule", "methane", "ammonia", "carbon dioxide",
               "sodium chloride"]:
        provider.register_response(kw, molecule)

    atom = _sim(
        "chemistry", "atomic_structure", "chemistry.atomic_structure",
        {"element": "carbon", "showLabels": True},
        "Atomic Structure",
        "Atoms consist of a dense nucleus (protons + neutrons) surrounded by "
        "electrons in orbital shells. Try the Excite Electron button to see a "
        "photon absorption and shell jump.",
        [{"name": "Atomic Number", "latex": "Z = \\text{number of protons}"},
         {"name": "Mass Number", "latex": "A = Z + N"}],
        ["Protons define the element",
         "Electrons determine chemical behavior",
         "Neutrons add mass but no charge"],
    )
    for kw in ["atom", "atoms", "atomic", "electron", "electrons", "proton",
               "protons", "neutron", "neutrons", "bohr", "electron shell",
               "orbital", "element"]:
        provider.register_response(kw, atom)

    titration = _sim(
        "chemistry", "acid_base_titration", "chemistry.titration",
        {"acidType": "strong", "acidConc": 0.1, "acidVolume": 25, "baseConc": 0.1, "titrantVolume": 0},
        "Acid-Base Titration",
        "Add base to acid drop by drop and watch the pH climb — slowly at first "
        "(the buffer region for weak acids), then rocketing through the equivalence "
        "point, then leveling off in excess base.",
        [{"name": "pH", "latex": "pH = -\\log_{10}[H^+]"},
         {"name": "Henderson-Hasselbalch", "latex": "pH = pK_a + \\log\\frac{[A^-]}{[HA]}"}],
        ["Strong acid + strong base: equivalence pH is 7",
         "Weak acid equivalence pH is above 7",
         "The buffer region resists pH change"],
    )
    for kw in ["titration", "titrate", "titrant", "titrations", "neutralization",
               "equivalence point", "acid base", "acid-base", "ph curve", "ph scale",
               "henderson hasselbalch", "henderson-hasselbalch", "buffer solution",
               "ph of solution", "ph"]:
        provider.register_response(kw, titration)


def _build_planner() -> AIPlanner:
    """
    Build the AI planner.

    Uses Cloudflare Workers AI when its credentials are configured;
    otherwise the app runs in offline demo mode (MockProvider keyword
    matching). MockProvider also stays wired as the runtime fallback,
    so a Workers AI outage degrades gracefully instead of breaking
    sessions.
    """
    from app.ai.mock_provider import MockProvider

    # Final fallback for every configuration — always available offline
    fallback = MockProvider()
    _setup_mock_provider(fallback)

    mode = settings.ai_provider.strip().lower()
    if mode not in ("cloudflare", "mock"):
        logger.warning(
            "Unknown TASAWWUR_AI_PROVIDER=%r — using cloudflare selection", mode,
        )

    configured = bool(settings.cloudflare_account_id and settings.cloudflare_api_token)
    if mode == "mock" or not configured:
        if mode != "mock":
            logger.warning(
                "Cloudflare Workers AI credentials not configured "
                "(TASAWWUR_CLOUDFLARE_ACCOUNT_ID / TASAWWUR_CLOUDFLARE_API_TOKEN) "
                "— using MockProvider (offline demo mode)",
            )
        else:
            logger.info("AI Planner initialized with MockProvider (offline demo mode)")
        return AIPlanner(provider=fallback, registry=viz_registry)

    from app.ai.cloudflare_provider import CloudflareProvider

    logger.info(
        "AI Planner initialized with Cloudflare Workers AI (%s) — "
        "MockProvider as runtime fallback",
        settings.cloudflare_model,
    )
    return AIPlanner(
        provider=CloudflareProvider(),
        registry=viz_registry,
        fallback_provider=fallback,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle. Load manifests and initialize AI planner."""
    # Load visualization manifests from disk
    count = viz_registry.load_manifests_from_disk()
    logger.info("Loaded %d visualization manifests", count)

    # Initialize the AI planner (Cloudflare Workers AI / MockProvider)
    app.state.planner = _build_planner()
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
