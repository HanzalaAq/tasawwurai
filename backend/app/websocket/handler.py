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
