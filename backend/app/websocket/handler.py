"""
WebSocket message handler.

Routes incoming client messages to the appropriate logic
and produces server responses. Supports:
- ping/pong heartbeats
- test messages (mock visualization commands)
- transcript messages (from speech-to-text pipeline)
- demo_text messages (from demo mode — processed by AI planner)
- parameter_change messages (user interacts with visualization)
- session_control messages (start/pause/resume/end)
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import WebSocket

from app.websocket.manager import ConnectionManager
from app.websocket.protocol import (
    ErrorMessage,
    ParameterChangeMessage,
    PingMessage,
    PongMessage,
    SessionControlMessage,
    TestMessage,
    TheoryBlock,
    VisualizationAction,
    VisualizationCommandMessage,
    VisualizationPayload,
    FormulaItem,
)

logger = logging.getLogger(__name__)


# --- Mock visualization data for testing (backward compat) ---

MOCK_VISUALIZATIONS = {
    "physics.projectile_motion": {
        "visualization": VisualizationPayload(
            type="physics.projectile",
            parameters={"velocity": 20, "angle": 45, "gravity": 9.81},
        ),
        "theory": TheoryBlock(
            title="Projectile Motion",
            explanation=(
                "A projectile is any object thrown into space by some exerting force. "
                "Once launched, the only force acting on it is gravity (ignoring air resistance). "
                "The trajectory forms a parabola."
            ),
            formulas=[
                FormulaItem(
                    name="Range", latex="R = (v^2 \\sin 2\\theta) / g"),
                FormulaItem(name="Max Height",
                            latex="H = (v^2 \\sin^2 \\theta) / (2g)"),
                FormulaItem(name="Time of Flight",
                            latex="T = (2v \\sin \\theta) / g"),
            ],
            key_points=[
                "Horizontal velocity remains constant",
                "Vertical velocity changes due to gravity",
                "Maximum range at 45 degrees",
            ],
        ),
    },
    "physics.wave_motion": {
        "visualization": VisualizationPayload(
            type="physics.wave",
            parameters={"frequency": 2.0, "amplitude": 1.0, "wavelength": 3.0},
        ),
        "theory": TheoryBlock(
            title="Wave Motion",
            explanation=(
                "A wave is a disturbance that transfers energy through space or matter "
                "without permanent displacement of the particles."
            ),
            formulas=[
                FormulaItem(name="Wave Equation", latex="v = f \\lambda"),
                FormulaItem(name="Period", latex="T = 1/f"),
            ],
            key_points=[
                "Transverse waves: displacement perpendicular to propagation",
                "Longitudinal waves: displacement parallel to propagation",
            ],
        ),
    },
    "math.quadratic_function": {
        "visualization": VisualizationPayload(
            type="math.function_graph",
            parameters={"expression": "x^2", "xMin": -
                        10, "xMax": 10, "color": "#3b82f6"},
        ),
        "theory": TheoryBlock(
            title="Quadratic Functions",
            explanation=(
                "A quadratic function has the form f(x) = ax^2 + bx + c. "
                "Its graph is a parabola that opens upward when a > 0 and downward when a < 0."
            ),
            formulas=[
                FormulaItem(name="Standard Form",
                            latex="f(x) = ax^2 + bx + c"),
                FormulaItem(name="Vertex", latex="x = -b / (2a)"),
                FormulaItem(name="Discriminant", latex="\\Delta = b^2 - 4ac"),
            ],
            key_points=[
                "The vertex is the minimum or maximum point",
                "The discriminant determines the number of real roots",
            ],
        ),
    },
    # --- Physics: Free Fall ---
    "physics.free_fall": {
        "visualization": VisualizationPayload(
            type="physics.free_fall",
            parameters={"height": 100, "gravity": 9.81, "airResistance": 0, "mass": 1},
        ),
        "theory": TheoryBlock(
            title="Free Fall",
            explanation=(
                "Free fall is motion under the influence of gravity alone, with no air resistance. "
                "All objects fall at the same rate regardless of mass (Galileo's principle)."
            ),
            formulas=[
                FormulaItem(name="Distance", latex="d = \\frac{1}{2}gt^2"),
                FormulaItem(name="Velocity", latex="v = gt"),
                FormulaItem(name="Time", latex="t = \\sqrt{\\frac{2d}{g}}"),
            ],
            key_points=[
                "Acceleration is constant at g = 9.81 m/s² on Earth",
                "Mass does not affect fall speed in vacuum",
                "Galileo's famous Leaning Tower of Pisa experiment",
            ],
        ),
    },
    # --- Physics: Pendulum ---
    "physics.pendulum": {
        "visualization": VisualizationPayload(
            type="physics.pendulum",
            parameters={"length": 2.0, "angle": 30, "gravity": 9.81, "damping": 0.02},
        ),
        "theory": TheoryBlock(
            title="Simple Pendulum",
            explanation=(
                "A simple pendulum swings back and forth under gravity. "
                "For small angles, the motion is approximately simple harmonic."
            ),
            formulas=[
                FormulaItem(name="Period", latex="T = 2\\pi\\sqrt{L/g}"),
                FormulaItem(name="Frequency", latex="f = 1/T"),
                FormulaItem(name="Restoring Force", latex="F = -mg\\sin\\theta"),
            ],
            key_points=[
                "Period depends on length, not mass",
                "Small angle approximation: sin(θ) ≈ θ",
                "Energy oscillates between KE and PE",
            ],
        ),
    },
    # --- Math: Derivative ---
    "math.derivative": {
        "visualization": VisualizationPayload(
            type="math.derivative",
            parameters={"expression": "x^3 - 3*x", "xMin": -4, "xMax": 4, "showTangent": True},
        ),
        "theory": TheoryBlock(
            title="Derivatives",
            explanation=(
                "The derivative measures the instantaneous rate of change of a function. "
                "Geometrically, it is the slope of the tangent line at any point on the curve."
            ),
            formulas=[
                FormulaItem(name="Definition", latex="f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}"),
                FormulaItem(name="Power Rule", latex="\\frac{d}{dx} x^n = nx^{n-1}"),
                FormulaItem(name="Chain Rule", latex="\\frac{d}{dx} f(g(x)) = f'(g(x)) \\cdot g'(x)"),
            ],
            key_points=[
                "Positive derivative = function is increasing",
                "Zero derivative = possible maximum or minimum (critical point)",
                "Negative derivative = function is decreasing",
            ],
        ),
    },
    # --- Math: Vector ---
    "math.vector": {
        "visualization": VisualizationPayload(
            type="math.vector",
            parameters={"x": 3, "y": 4, "bx": 1, "by": 2, "operation": "add", "showComponents": True, "showMagnitude": True},
        ),
        "theory": TheoryBlock(
            title="Vectors",
            explanation=(
                "A vector has both magnitude and direction. "
                "Vectors are fundamental in physics and engineering for describing forces, velocities, and displacements."
            ),
            formulas=[
                FormulaItem(name="Magnitude", latex="|\\vec{v}| = \\sqrt{x^2 + y^2}"),
                FormulaItem(name="Direction", latex="\\theta = \\arctan(y/x)"),
                FormulaItem(name="Dot Product", latex="\\vec{A} \\cdot \\vec{B} = |A||B|\\cos\\theta"),
            ],
            key_points=[
                "Vectors can be added component-wise",
                "Dot product measures alignment between vectors",
                "Cross product gives a perpendicular vector",
            ],
        ),
    },
    # --- CS: Sorting Algorithm ---
    "computer_science.sorting_algorithm": {
        "visualization": VisualizationPayload(
            type="cs.sorting_algorithm",
            parameters={"algorithm": "bubble", "arraySize": 15, "speed": 1.0},
        ),
        "theory": TheoryBlock(
            title="Sorting Algorithms",
            explanation=(
                "Sorting arranges data in a specific order. "
                "Different algorithms trade off between speed, memory usage, and simplicity."
            ),
            formulas=[
                FormulaItem(name="Bubble Sort", latex="O(n^2)"),
                FormulaItem(name="Merge Sort", latex="O(n \\log n)"),
                FormulaItem(name="Quick Sort (avg)", latex="O(n \\log n)"),
            ],
            key_points=[
                "Bubble sort compares adjacent elements repeatedly",
                "Merge sort uses divide and conquer strategy",
                "Quick sort is fast in practice due to cache efficiency",
            ],
        ),
    },
    # --- CS: Binary Tree ---
    "computer_science.binary_tree": {
        "visualization": VisualizationPayload(
            type="cs.binary_tree",
            parameters={"depth": 3, "showTraversal": True, "traversalType": "inorder"},
        ),
        "theory": TheoryBlock(
            title="Binary Trees",
            explanation=(
                "A binary tree is a hierarchical data structure where each node has at most two children. "
                "They enable efficient searching, sorting, and expression parsing."
            ),
            formulas=[
                FormulaItem(name="Max Nodes", latex="N = 2^{d+1} - 1"),
                FormulaItem(name="Height", latex="h = \\lfloor \\log_2 n \\rfloor"),
            ],
            key_points=[
                "In-order traversal gives sorted output for BST",
                "Time complexity: O(log n) for balanced trees",
                "Pre-order used for copying trees",
            ],
        ),
    },
    # --- CS: BFS/DFS ---
    "computer_science.bfs_dfs": {
        "visualization": VisualizationPayload(
            type="cs.bfs_dfs",
            parameters={"algorithm": "bfs", "startNode": "A", "speed": 1.0},
        ),
        "theory": TheoryBlock(
            title="BFS & DFS Traversal",
            explanation=(
                "Breadth-First Search explores level by level using a queue. "
                "Depth-First Search goes as deep as possible before backtracking using a stack."
            ),
            formulas=[
                FormulaItem(name="BFS Time", latex="O(V + E)"),
                FormulaItem(name="DFS Time", latex="O(V + E)"),
            ],
            key_points=[
                "BFS uses a queue (FIFO) data structure",
                "DFS uses a stack (LIFO) or recursion",
                "BFS finds the shortest path in unweighted graphs",
            ],
        ),
    },
    # --- Biology: DNA Replication ---
    "biology.dna_replication": {
        "visualization": VisualizationPayload(
            type="biology.dna_replication",
            parameters={"basePairs": 12, "animating": True, "showLabels": True},
        ),
        "theory": TheoryBlock(
            title="DNA Structure & Replication",
            explanation=(
                "DNA is a double helix that carries genetic information. "
                "It replicates by unwinding and using each strand as a template for a new complementary strand."
            ),
            formulas=[
                FormulaItem(name="Base Pairs", latex="A \\leftrightarrow T, \\quad G \\leftrightarrow C"),
            ],
            key_points=[
                "Adenine (A) pairs with Thymine (T) via 2 hydrogen bonds",
                "Guanine (G) pairs with Cytosine (C) via 3 hydrogen bonds",
                "DNA replicates semi-conservatively",
            ],
        ),
    },
    # --- Biology: Cell Structure ---
    "biology.cell_structure": {
        "visualization": VisualizationPayload(
            type="biology.cell",
            parameters={"showLabels": True, "cellType": "animal"},
        ),
        "theory": TheoryBlock(
            title="Cell Structure",
            explanation=(
                "Cells are the basic building blocks of all living organisms. "
                "Animal cells contain specialized organelles that carry out specific functions."
            ),
            formulas=[],
            key_points=[
                "Nucleus contains DNA and controls cell activities",
                "Mitochondria produce ATP (energy) via cellular respiration",
                "Cell membrane controls what enters and exits",
            ],
        ),
    },
    # --- Chemistry: Atomic Structure ---
    "chemistry.atomic_structure": {
        "visualization": VisualizationPayload(
            type="chemistry.atomic_structure",
            parameters={"element": "carbon", "showLabels": True},
        ),
        "theory": TheoryBlock(
            title="Atomic Structure",
            explanation=(
                "Atoms consist of a dense nucleus (protons + neutrons) surrounded by "
                "electrons in orbital shells. The Bohr model shows electrons in fixed circular orbits."
            ),
            formulas=[
                FormulaItem(name="Atomic Number", latex="Z = \\text{number of protons}"),
                FormulaItem(name="Mass Number", latex="A = Z + N"),
            ],
            key_points=[
                "Protons define the element (atomic number)",
                "Electrons determine chemical behavior",
                "Neutrons add mass but no charge",
            ],
        ),
    },
    # --- Chemistry: Molecule ---
    "chemistry.molecule": {
        "visualization": VisualizationPayload(
            type="chemistry.molecule",
            parameters={"molecule": "water", "showAngles": True, "showLabels": True},
        ),
        "theory": TheoryBlock(
            title="Molecular Structure",
            explanation=(
                "Molecules are formed when atoms bond together by sharing or transferring electrons. "
                "The shape of a molecule determines its chemical properties and reactivity."
            ),
            formulas=[
                FormulaItem(name="VSEPR Bond Angle", latex="\\text{H}_2\\text{O: } 104.5°"),
                FormulaItem(name="Electronegativity", latex="\\Delta EN > 1.7 \\Rightarrow \\text{ionic}"),
            ],
            key_points=[
                "Covalent bonds share electrons between atoms",
                "Ionic bonds transfer electrons (e.g. NaCl)",
                "Molecular shape determined by VSEPR theory",
            ],
        ),
    },
    
    # --- Physics: Spring-Mass (SHM) ---
    "physics.simple_harmonic_motion": {
        "visualization": VisualizationPayload(
            type="physics.spring_mass",
            parameters={"mass": 2.0, "springConstant": 50, "amplitude": 0.8, "damping": 0.05},
        ),
        "theory": TheoryBlock(
            title="Spring-Mass Oscillator",
            explanation=(
                "A mass on a spring oscillates with simple harmonic motion. The restoring "
                "force follows Hooke's law, F = -kx, and the period depends only on the "
                "mass and spring constant — not on amplitude."
            ),
            formulas=[
                FormulaItem(name="Hooke's Law", latex="F = -kx"),
                FormulaItem(name="Period", latex="T = 2\\pi\\sqrt{m/k}"),
            ],
            key_points=[
                "Acceleration is proportional to displacement, in the opposite direction",
                "Energy trades between kinetic and elastic potential",
                "Damping gradually removes energy from the system",
            ],
        ),
    },
    # --- Physics: Collisions (Momentum) ---
    "physics.momentum_collisions": {
        "visualization": VisualizationPayload(
            type="physics.collision",
            parameters={"massA": 2, "velocityA": 4, "massB": 4, "velocityB": -2, "restitution": 1},
        ),
        "theory": TheoryBlock(
            title="Collision Lab",
            explanation=(
                "When two objects collide, momentum is always conserved. Kinetic energy is "
                "conserved only in perfectly elastic collisions — watch it convert to heat "
                "and sound as the restitution drops below one."
            ),
            formulas=[
                FormulaItem(name="Momentum", latex="p = mv"),
                FormulaItem(name="Elastic Collision", latex="\\frac{1}{2}m_1v_1^2 + \\frac{1}{2}m_2v_2^2 = \\text{const}"),
            ],
            key_points=[
                "Momentum is conserved in all collisions",
                "Perfectly inelastic collisions lose the most kinetic energy",
                "Equal masses exchange velocities in elastic collisions",
            ],
        ),
    },
    # --- Physics: Thin Lens (Ray Optics) ---
    "physics.ray_optics": {
        "visualization": VisualizationPayload(
            type="physics.lens",
            parameters={"focalLength": 15, "objectDistance": 40, "objectHeight": 8, "lensType": "converging"},
        ),
        "theory": TheoryBlock(
            title="Thin Lens Ray Optics",
            explanation=(
                "Light rays refract through a lens and converge (or diverge) to form an image. "
                "The thin lens equation relates focal length, object distance, and image "
                "distance. Drag the object past the focal point to see a real image "
                "become virtual."
            ),
            formulas=[
                FormulaItem(name="Thin Lens Equation", latex="\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}"),
                FormulaItem(name="Magnification", latex="m = -d_i/d_o = h_i/h_o"),
            ],
            key_points=[
                "Converging lenses focus parallel rays to the focal point",
                "An object beyond F forms a real, inverted image",
                "Diverging lenses always form virtual, upright images",
            ],
        ),
    },
    # --- Math: Unit Circle ---
    "math.unit_circle": {
        "visualization": VisualizationPayload(
            type="math.unit_circle",
            parameters={"angle": 45, "function": "sin", "speed": 1},
        ),
        "theory": TheoryBlock(
            title="Unit Circle & Trigonometry",
            explanation=(
                "Every point on the unit circle is (cos θ, sin θ). Watch the angle sweep "
                "around the circle and see how sine and cosine are simply the coordinates "
                "of that point — the graph draws itself."
            ),
            formulas=[
                FormulaItem(name="Pythagorean Identity", latex="\\sin^2\\theta + \\cos^2\\theta = 1"),
                FormulaItem(name="Tangent", latex="\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}"),
            ],
            key_points=[
                "Sine is the y-coordinate, cosine the x-coordinate",
                "Tangent is the slope of the radius line",
                "The four quadrants fix the signs of each ratio",
            ],
        ),
    },
    # --- Math: Riemann Sums ---
    "math.integration": {
        "visualization": VisualizationPayload(
            type="math.riemann",
            parameters={"expression": "x^2", "n": 8, "method": "left", "xMin": 0, "xMax": 2},
        ),
        "theory": TheoryBlock(
            title="Riemann Sums & Integration",
            explanation=(
                "To find the area under a curve, slice it into rectangles. As the number "
                "of rectangles grows, the sum converges to the exact integral — that "
                "limit IS the definite integral."
            ),
            formulas=[
                FormulaItem(name="Riemann Sum", latex="\\int_a^b f(x)\\,dx = \\lim_{n \\to \\infty} \\sum_{i=1}^{n} f(x_i)\\,\\Delta x"),
                FormulaItem(name="Fundamental Theorem", latex="\\int_a^b f(x)\\,dx = F(b) - F(a)"),
            ],
            key_points=[
                "Left sums overestimate increasing functions",
                "Midpoint sums converge faster than left or right",
                "The exact area is the limit as n approaches infinity",
            ],
        ),
    },
    # --- CS: Pathfinding ---
    "computer_science.pathfinding": {
        "visualization": VisualizationPayload(
            type="cs.pathfinding",
            parameters={"algorithm": "astar", "wallDensity": 0.25, "speed": 5, "diagonal": True},
        ),
        "theory": TheoryBlock(
            title="Pathfinding: Dijkstra, A*, Greedy",
            explanation=(
                "Grid search algorithms find the shortest path very differently. Dijkstra "
                "expands uniformly in all directions, A* steers toward the goal with a "
                "heuristic, and Greedy trusts the heuristic alone — fast but not always optimal."
            ),
            formulas=[
                FormulaItem(name="A* Cost", latex="f(n) = g(n) + h(n)"),
                FormulaItem(name="Dijkstra", latex="O((V+E)\\log V)"),
            ],
            key_points=[
                "Dijkstra guarantees the shortest path but explores everywhere",
                "A* uses an admissible heuristic to prune the search",
                "Greedy best-first can return suboptimal paths",
            ],
        ),
    },
    # --- CS: Tower of Hanoi ---
    "computer_science.recursion": {
        "visualization": VisualizationPayload(
            type="cs.tower_of_hanoi",
            parameters={"disks": 4, "speed": 1},
        ),
        "theory": TheoryBlock(
            title="Tower of Hanoi (Recursion)",
            explanation=(
                "Move the whole stack to the target peg, one disk at a time, never "
                "placing a larger disk on a smaller one. The recursive solution: move "
                "n−1 disks aside, move the biggest disk, then move the stack on top."
            ),
            formulas=[
                FormulaItem(name="Recurrence", latex="T(n) = 2T(n-1) + 1 = 2^n - 1"),
            ],
            key_points=[
                "Base case: one disk moves directly",
                "Each recursive call solves a smaller tower",
                "Each extra disk doubles (plus one) the moves",
            ],
        ),
    },
    # --- Biology: Punnett Square ---
    "biology.mendelian_genetics": {
        "visualization": VisualizationPayload(
            type="biology.punnett",
            parameters={"parent1": "Aa", "parent2": "Aa", "traitDominant": "Tall", "traitRecessive": "Short"},
        ),
        "theory": TheoryBlock(
            title="Punnett Square Heredity",
            explanation=(
                "Gregor Mendel's pea plants revealed how traits pass between generations. "
                "Cross two heterozygous parents and watch the classic 3:1 phenotype ratio "
                "appear — each square is an equally likely offspring."
            ),
            formulas=[
                FormulaItem(name="Monohybrid Cross", latex="Aa \\times Aa \\Rightarrow 1AA : 2Aa : 1aa"),
            ],
            key_points=[
                "Each parent contributes one allele at random",
                "Heterozygotes show the dominant phenotype",
                "Genotype ratio 1:2:1 gives phenotype ratio 3:1",
            ],
        ),
    },
    # --- Biology: Enzyme Kinetics ---
    "biology.enzyme_kinetics": {
        "visualization": VisualizationPayload(
            type="biology.enzyme",
            parameters={"substrate": 40, "vmax": 60, "km": 15, "inhibitor": 0},
        ),
        "theory": TheoryBlock(
            title="Enzyme Kinetics (Michaelis-Menten)",
            explanation=(
                "Enzymes speed up reactions by binding substrates at the active site. "
                "Rate rises with substrate concentration but saturates at Vmax as every "
                "enzyme gets busy. Competitive inhibitors raise the apparent Km."
            ),
            formulas=[
                FormulaItem(name="Michaelis-Menten", latex="v = \\frac{V_{max}[S]}{K_m + [S]}"),
                FormulaItem(name="Lineweaver-Burk", latex="\\frac{1}{v} = \\frac{K_m}{V_{max}}\\frac{1}{[S]} + \\frac{1}{V_{max}}"),
            ],
            key_points=[
                "Vmax is reached when the enzyme is saturated",
                "Km is the substrate concentration at half of Vmax",
                "Competitive inhibitors compete for the active site",
            ],
        ),
    },
    # --- Chemistry: Acid-Base Titration ---
    "chemistry.acid_base_titration": {
        "visualization": VisualizationPayload(
            type="chemistry.titration",
            parameters={"acidType": "strong", "acidConc": 0.1, "acidVolume": 25, "baseConc": 0.1, "titrantVolume": 0},
        ),
        "theory": TheoryBlock(
            title="Acid-Base Titration",
            explanation=(
                "Add base to acid drop by drop and watch the pH climb — slowly at first "
                "(the buffer region for weak acids), then rocketing through the equivalence "
                "point, then leveling off in excess base."
            ),
            formulas=[
                FormulaItem(name="pH", latex="pH = -\\log_{10}[H^+]"),
                FormulaItem(name="Henderson-Hasselbalch", latex="pH = pK_a + \\log\\frac{[A^-]}{[HA]}"),
            ],
            key_points=[
                "Strong acid + strong base: equivalence pH is 7",
                "Weak acid equivalence pH is above 7",
                "The buffer region resists pH change",
            ],
        ),
    },

}


def _get_mock_command(subject: str, concept: str) -> VisualizationCommandMessage | None:
    """Look up a mock visualization command by subject.concept."""
    key = f"{subject}.{concept}"
    mock = MOCK_VISUALIZATIONS.get(key)
    if not mock:
        return None

    return VisualizationCommandMessage(
        type="visualization_command",
        command_id=str(uuid.uuid4()),
        action=VisualizationAction.NEW,
        subject=subject,
        concept=concept,
        visualization=mock["visualization"],
        theory=mock["theory"],
        timestamp=time.time(),
    )


async def handle_message(
    raw: dict,
    websocket: WebSocket,
    session_id: str,
    conn_manager: ConnectionManager,
    planner=None,
) -> None:
    """
    Parse and route an incoming client message.

    Each message must have a `type` field that determines how it is handled.
    The optional `planner` parameter is the AIPlanner instance from app.state.
    """
    msg_type = raw.get("type")

    if msg_type == "ping":
        msg = PingMessage(**raw)
        await conn_manager.send_json(
            session_id,
            websocket,
            PongMessage(type="pong", timestamp=msg.timestamp).model_dump(),
        )

    elif msg_type == "test":
        msg = TestMessage(**raw)
        command = _get_mock_command(msg.subject, msg.concept)
        if command:
            await conn_manager.send_json(session_id, websocket, command.model_dump())
        else:
            await conn_manager.send_json(
                session_id,
                websocket,
                ErrorMessage(
                    type="error",
                    code="UNKNOWN_VISUALIZATION",
                    message=f"No mock visualization for '{msg.subject}.{msg.concept}'",
                ).model_dump(),
            )

    elif msg_type in ("transcript", "demo_text"):
        # Both transcript (from STT) and demo_text (from demo mode) go through the AI planner
        text = raw.get("text", "").strip()
        if not text:
            return

        # Send transcript back to client for display
        await conn_manager.send_json(session_id, websocket, {
            "type": "transcript_segment",
            "segment_id": str(uuid.uuid4()),
            "text": text,
            "is_final": True,
            "timestamp": time.time(),
        })

        # Process through AI planner if available
        if planner:
            logger.info("Processing transcript: session=%s text='%s'", session_id, text[:80])
            result = await planner.plan(session_id, text)
            if result:
                # planner.plan() returns a single dict or a list of dicts (for "both" mode)
                if isinstance(result, list):
                    for command in result:
                        cmd_type = command.get("type", "unknown")
                        logger.info("Sending %s to frontend (session=%s)", cmd_type, session_id)
                        await conn_manager.send_json(session_id, websocket, command)
                else:
                    cmd_type = result.get("type", "unknown")
                    logger.info("Sending %s to frontend (session=%s)", cmd_type, session_id)
                    await conn_manager.send_json(session_id, websocket, result)
            else:
                logger.info("Planner returned None — no visualization change (session=%s)", session_id)
        else:
            logger.warning(
                "AI planner not available — cannot process transcript")

    elif msg_type == "parameter_change":
        msg = ParameterChangeMessage(**raw)
        logger.info(
            "Parameter change: session=%s type=%s params=%s",
            session_id, msg.visualization_type, msg.parameters,
        )

    elif msg_type == "session_control":
        msg = SessionControlMessage(**raw)
        logger.info("Session control: session=%s action=%s",
                    session_id, msg.action)
        # Reset AI context when starting a new session
        if msg.action.value == "start" and planner:
            planner.reset_context(session_id)

    else:
        await conn_manager.send_json(
            session_id,
            websocket,
            ErrorMessage(
                type="error",
                code="UNKNOWN_MESSAGE_TYPE",
                message=f"Unknown message type: '{msg_type}'",
            ).model_dump(),
        )
