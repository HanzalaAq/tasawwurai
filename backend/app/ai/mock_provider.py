"""
Offline mock LLM provider + speech parameter extraction.

MockProvider is the demo/offline provider: it answers via keyword
matching PLUS speech parameter extraction, so spoken values
("at 30 degrees", "plot x squared plus 2x") are reflected in the
generated visualization. It is used whenever Cloudflare Workers AI
is not configured and as the runtime fallback if the real provider
fails.
"""

from __future__ import annotations

import copy
import logging
import re
from typing import Any

from pydantic import BaseModel

from app.ai.provider import LLMProvider

logger = logging.getLogger(__name__)


# --- Speech parameter extraction helpers (used by MockProvider) ----------

# Gravity presets (m/s²) recognized in speech
GRAVITY_PRESETS = {
    "moon": 1.62,
    "mars": 3.71,
    "jupiter": 24.79,
    "earth": 9.81,
}

# Element names → AtomicStructureRenderer keys
ELEMENTS = {
    "hydrogen", "helium", "lithium", "beryllium", "boron", "carbon",
    "nitrogen", "oxygen", "fluorine", "neon", "sodium", "magnesium",
    "aluminum", "aluminium", "silicon", "phosphorus", "sulfur", "sulphur",
    "chlorine", "argon", "potassium", "calcium", "iron", "copper",
    "zinc", "silver", "gold",
}

# Molecule phrases → MoleculeRenderer keys
MOLECULE_PHRASES = {
    "water": "water", "h2o": "water", "h₂o": "water",
    "carbon dioxide": "co2", "co2": "co2",
    "methane": "methane", "ch4": "methane",
    "ammonia": "ammonia", "nh3": "ammonia",
    "sodium chloride": "nacl", "table salt": "nacl", "nacl": "nacl", "salt": "nacl",
}

# Functions supported by the frontend expression parser
EXPR_FUNCS = {"sin", "cos", "tan", "asin", "acos", "atan",
              "abs", "sqrt", "ln", "log", "exp", "ceil", "floor"}

# Spoken math words → symbolic fragments
SPOKEN_MATH = [
    (r'\bsquared\b', '^2'),
    (r'\bcubed\b', '^3'),
    (r'\b(\d+)\s+to\s+the\s+power\s+of\s+x\b', r'\1^x'),
    (r'\bto\s+the\s+power\s+of\s+(\d+)\b', r'^\1'),
    (r'\bto\s+the\s+(fourth|fifth|sixth)\b', lambda m: f"^{4 + ['fourth', 'fifth', 'sixth'].index(m.group(1))}"),
    (r'\be\s+to\s+the\s+x\b', 'exp(x)'),
    (r'\b(?:sine|sin)\s+(?:of\s+)?x\b', 'sin(x)'),
    (r'\b(?:cosine|cos)\s+(?:of\s+)?x\b', 'cos(x)'),
    (r'\b(?:tangent|tan)\s+(?:of\s+)?x\b', 'tan(x)'),
    (r'\bsquare\s+root\s+(?:of\s+)?x\b', 'sqrt(x)'),
    (r'\bnatural\s+log(?:arithm)?\s+(?:of\s+)?x\b', 'ln(x)'),
    (r'\blog(?:arithm)?\s+(?:of\s+)?x\b', 'log(x)'),
    (r'\babsolute\s+value\s+(?:of\s+)?x\b', 'abs(x)'),
    (r'\bone\s+half\s+x\b', '0.5x'),
    (r'\bhalf\s+of\s+x\b', '0.5x'),
    (r'\bx\s+over\s+(\d+)\b', r'x/\1'),
    (r'\bequals\b', '='),
    (r'\bplus\b', '+'),
    (r'\bminus\b', '-'),
    (r'\btimes\b', '*'),
    (r'\bmultiplied\s+by\b', '*'),
    (r'\bdivided\s+by\b', '/'),
    (r'\bnegative\b', '-'),
]

# Named function shortcuts when no explicit expression is spoken
EXPR_SHORTCUTS = [
    (r'\bexponential\b', 'exp(x)'),
    (r'\blogarithm\b|\blog\s+function\b', 'log(x)'),
    (r'\bnatural\s+log\b', 'ln(x)'),
    (r'\b(?:sine|sin)\s+wave\b|\btrigonometr', 'sin(x)'),
    (r'\b(?:cosine|cos)\s+wave\b', 'cos(x)'),
    (r'\bparabola\b|\bquadratic\b', 'x^2'),
    (r'\bcubic\b', 'x^3'),
    (r'\blinear\b', 'x'),
]


def _first_num(pattern: str, text: str) -> float | None:
    """Return the first float captured by a regex, or None."""
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except (ValueError, IndexError):
            return None
    return None


def _is_valid_expression(expr: str) -> bool:
    """Whitelist check: x must be a token (not inside a word like 'explain')."""
    if not expr or not re.search(r'(?<![a-z])x\b', expr):
        return False
    stripped = re.sub(
        r'\b(?:' + "|".join(EXPR_FUNCS) + r')\b', "", expr
    )
    return bool(re.fullmatch(r'[0-9xX+\-*/^().\s]+', stripped))


def extract_speech_parameters(transcript: str, viz_type: str) -> dict[str, Any]:
    """
    Extract visualization parameters from natural speech.

    Recognizes forms like "at 30 degrees", "20 meters per second",
    "from 50 meters", "frequency of 5 hertz", "on the moon", "plant cell",
    "oxygen atom", "water molecule", "quick sort", "pre order traversal".
    Returns only parameters it could confidently extract.
    """
    text = transcript.lower()
    params: dict[str, Any] = {}

    # --- Gravity presets (any physics viz) ---
    gravity = None
    for name, value in GRAVITY_PRESETS.items():
        if re.search(rf'\b{name}\b', text):
            gravity = value
            break

    # --- Angle ---
    angle = (
        _first_num(r'(?:angle\s+(?:of|is|=)?|launch(?:ing)?\s+(?:at)?|\bat)\s*'
                   r'(\d+(?:\.\d+)?)\s*(?:degrees?|°|deg\b)', text)
        or _first_num(r'(\d+(?:\.\d+)?)\s*(?:degrees?|°)\s*(?:angle|launch)', text)
    )

    # --- Velocity ---
    velocity = (
        _first_num(r'(\d+(?:\.\d+)?)\s*(?:m/s|mps|meters?\s+per\s+second|metres?\s+per\s+second)', text)
        or _first_num(r'(?:speed|velocity)(?:\s+of|\s+is|\s*=)?\s*(\d+(?:\.\d+)?)', text)
    )

    # --- Height ---
    height = (
        _first_num(r'(?:height\s+(?:of|is)?|\bfrom|\bat)\s*(\d+(?:\.\d+)?)\s*(?:meters?|metres?|m\b)', text)
        or _first_num(r'(\d+(?:\.\d+)?)\s*(?:meters?|metres?|m)\s+(?:high|tall|drop|building)', text)
    )

    # --- Length ---
    length = (
        _first_num(r'(\d+(?:\.\d+)?)\s*(?:meters?|metres?)\s+(?:pendulum|long|rope|string)', text)
        or _first_num(r'length\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
    )

    # --- Wave properties ---
    frequency = (
        _first_num(r'(\d+(?:\.\d+)?)\s*(?:hz|hertz)', text)
        or _first_num(r'frequenc(?:y|ies)\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
    )
    amplitude = _first_num(r'amplitude\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
    wavelength = _first_num(r'wavelength\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)

    # --- Mass ---
    mass = (
        _first_num(r'mass\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
        or _first_num(r'(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)', text)
    )

    # --- Algorithms ---
    algorithm = None
    for word, alg in [("quick", "quick"), ("merge", "merge"),
                      ("insertion", "insertion"), ("selection", "selection"),
                      ("bubble", "bubble")]:
        if re.search(rf'\b{word}\b', text):
            algorithm = alg
            break
    if algorithm is None:
        if re.search(r'\bbfs\b|breadth[\s-]*first', text):
            algorithm = "bfs"
        elif re.search(r'\bdfs\b|depth[\s-]*first', text):
            algorithm = "dfs"

    # --- Tree traversal ---
    traversal = None
    for phrase, t in [("in order", "inorder"), ("inorder", "inorder"),
                      ("pre order", "preorder"), ("preorder", "preorder"),
                      ("post order", "postorder"), ("postorder", "postorder")]:
        if phrase in text:
            traversal = t
            break

    # --- Expression (function graphs / derivatives) ---
    expression = extract_expression(transcript)

    # --- New simulation properties ---
    spring_constant = _first_num(
        r'spring\s+(?:constant|stiffness)\s+(?:of|is|=)?\s*(\d+(?:\.\d+)?)', text)
    amplitude_spoken = _first_num(r'amplitude\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
    focal_length = _first_num(
        r'focal\s+length\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
    object_distance = (
        _first_num(r'object\s+distance\s+(?:of|is)?\s*(\d+(?:\.\d+)?)', text)
        or _first_num(r'object\s+at\s*(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)', text)
    )
    disks = _first_num(r'(\d+)\s+disks?\b', text)
    rectangles = _first_num(
        r'(\d+)\s*(?:rectangles?|slices?|strips?|partitions?|bars?)', text)
    substrate_conc = _first_num(
        r'substrate\s+(?:concentration\s+)?(?:of|is|=)?\s*(\d+(?:\.\d+)?)', text)

    # --- Assemble per visualization type ---
    if viz_type == "physics.projectile":
        if velocity is not None: params["velocity"] = velocity
        if angle is not None: params["angle"] = angle
        if gravity is not None: params["gravity"] = gravity
    elif viz_type == "physics.free_fall":
        if height is not None: params["height"] = height
        if gravity is not None: params["gravity"] = gravity
        if mass is not None: params["mass"] = mass
    elif viz_type == "physics.pendulum":
        if length is not None: params["length"] = length
        if angle is not None: params["angle"] = angle
        if gravity is not None: params["gravity"] = gravity
    elif viz_type == "physics.wave":
        if frequency is not None: params["frequency"] = frequency
        if amplitude is not None: params["amplitude"] = amplitude
        if wavelength is not None: params["wavelength"] = wavelength
    elif viz_type in ("math.function_graph", "math.derivative"):
        if expression: params["expression"] = expression
    elif viz_type == "cs.sorting_algorithm":
        if algorithm in ("bubble", "selection", "insertion", "merge", "quick"):
            params["algorithm"] = algorithm
    elif viz_type == "cs.bfs_dfs":
        if algorithm in ("bfs", "dfs"):
            params["algorithm"] = algorithm
    elif viz_type == "cs.binary_tree":
        if traversal: params["traversalType"] = traversal
    elif viz_type == "biology.cell":
        if "plant" in text: params["cellType"] = "plant"
        elif "animal" in text: params["cellType"] = "animal"
    elif viz_type == "chemistry.atomic_structure":
        for name in ELEMENTS:
            if re.search(rf'\b{name}\b', text):
                params["element"] = "aluminum" if name == "aluminium" else name
                break
    elif viz_type == "chemistry.molecule":
        for phrase, key in MOLECULE_PHRASES.items():
            if phrase in text:
                params["molecule"] = key
                break
    elif viz_type == "physics.spring_mass":
        if mass is not None: params["mass"] = mass
        if spring_constant is not None: params["springConstant"] = spring_constant
        if amplitude_spoken is not None: params["amplitude"] = amplitude_spoken
    elif viz_type == "physics.collision":
        if mass is not None: params["massA"] = mass
        if velocity is not None: params["velocityA"] = velocity
        if re.search(r'\bperfectly\s+inelastic\b|\binelastic\b', text):
            params["restitution"] = 0.0
        elif re.search(r'\belastic\b', text):
            params["restitution"] = 1.0
    elif viz_type == "physics.lens":
        if focal_length is not None: params["focalLength"] = focal_length
        if object_distance is not None: params["objectDistance"] = object_distance
        if re.search(r'\bdiverging\b|\bconcave\b', text):
            params["lensType"] = "diverging"
        elif re.search(r'\bconverging\b|\bconvex\b', text):
            params["lensType"] = "converging"
    elif viz_type == "math.unit_circle":
        if angle is not None: params["angle"] = angle
        for word, fn_name in [("sine", "sin"), ("cosine", "cos"), ("tangent", "tan")]:
            if re.search(rf'\b{word}\b', text):
                params["function"] = fn_name
                break
    elif viz_type == "math.riemann":
        if expression: params["expression"] = expression
        if rectangles is not None: params["n"] = int(rectangles)
        if "midpoint" in text or "middle" in text:
            params["method"] = "midpoint"
        elif "right" in text:
            params["method"] = "right"
        elif "left" in text:
            params["method"] = "left"
    elif viz_type == "cs.pathfinding":
        if re.search(r'\bdijkstra\b', text):
            params["algorithm"] = "dijkstra"
        elif re.search(r'\ba\s*star\b|\bastar\b|\ba\*\b', text):
            params["algorithm"] = "astar"
        elif re.search(r'\bgreedy\b', text):
            params["algorithm"] = "greedy"
    elif viz_type == "cs.tower_of_hanoi":
        if disks is not None: params["disks"] = int(disks)
    elif viz_type == "biology.punnett":
        # Assign each parent its own genotype, in the order mentioned.
        # (A statement like "homozygous dominant crossed with homozygous
        # recessive" is AA x aa, not AA x AA.)
        genotypes = [
            (r"homozygous\s+dominant", "AA"),
            (r"homozygous\s+recessive", "aa"),
            (r"heterozygous", "Aa"),
        ]
        found = []
        for pattern, genotype in genotypes:
            m = re.search(pattern, text)
            if m:
                found.append((m.start(), genotype))
        found.sort()
        if found:
            params["parent1"] = found[0][1]
            params["parent2"] = found[1][1] if len(found) > 1 else found[0][1]
    elif viz_type == "biology.enzyme":
        if substrate_conc is not None: params["substrate"] = substrate_conc
    elif viz_type == "chemistry.titration":
        if "weak" in text:
            params["acidType"] = "weak"
        elif "strong" in text:
            params["acidType"] = "strong"

    return params


def extract_expression(transcript: str) -> str | None:
    """
    Extract a math expression from speech.

    "plot x squared plus 2x" → "x^2+2x"
    "graph 3 times sine of x" → "3*sin(x)"
    "differentiate x cubed minus 2x" → "x^3-2x"
    "draw y equals 2x plus 1" → "2x+1"
    "show the square root of x" → "sqrt(x)"
    "exponential growth" → "exp(x)"
    "natural log of x" → "ln(x)"
    "explain quantum physics" → None
    """
    text = transcript.lower()

    # Apply spoken math word substitutions to the whole text first
    spoken = text
    for pattern, repl in SPOKEN_MATH:
        spoken = re.sub(pattern, repl, spoken)

    func_alt = '|'.join(EXPR_FUNCS)

    # 1) Expression after a plotting verb: consume math tokens left to right,
    #    stopping at the first non-math word ("... 2x at x = 2" stops at "at")
    verb_m = re.search(
        r'(?:plot|graph|draw|sketch|differentiate|derivative\s+of|curve\s+of|show)\s+'
        r'(?:me\s+|us\s+|the\s+|a\s+|an\s+)?(y\s*=\s*)?',
        spoken,
    )
    if verb_m:
        rest = spoken[verb_m.end():]
        token_re = re.compile(
            rf'(\d+\.\d+|\d+|(?:{func_alt})\s*\(|\)|x\b|[+\-*/^])'
        )
        pos, parts = 0, []
        while pos < len(rest):
            if rest[pos].isspace():
                pos += 1
                continue
            tm = token_re.match(rest, pos)
            if not tm:
                break
            parts.append(tm.group(1).replace(' ', ''))
            pos = tm.end()
        if parts:
            expr = ''.join(parts)
            if _is_valid_expression(expr):
                return expr

    # 2) Bare function call from substitution ("ln(x)", "sqrt(x)", "sin(x)")
    m = re.search(rf'\b({func_alt})\(x\)', spoken)
    if m:
        return m.group(1) + '(x)'

    # 3) Bare math chunk with x and operators ("x^2 + 2x", "2x+1", "2^x")
    m = re.search(r'(\d+(?:\.\d+)?\s*\^\s*x\b)', spoken)
    if m:
        return re.sub(r'\s+', '', m.group(1))
    m = re.search(
        r'(\d*\.?\d*\s*x\b\s*(?:\^\s*\d+)?'
        r'(?:\s*[+\-*/^]\s*\d*\.?\d*\s*(?:x\b\s*(?:\^\s*\d+)?)?)*)',
        spoken,
    )
    if m:
        expr = re.sub(r'\s+', '', m.group(1))
        if _is_valid_expression(expr):
            return expr

    # 4) Named function shortcuts
    for pattern, expr in EXPR_SHORTCUTS:
        if re.search(pattern, spoken):
            return expr

    return None


class MockProvider(LLMProvider):
    """
    Mock provider for testing and demo mode.

    Returns predefined visualization commands without calling any LLM.
    Uses word-boundary matching with priority ordering (longer keywords first)
    to avoid false positives like 'atom' matching inside 'automatic'.

    On a keyword match, spoken parameters ("at 30 degrees", "plot x squared")
    are extracted and merged into the canned response so the visualization
    matches what the user actually said.
    """

    def __init__(self) -> None:
        self._responses: dict[str, dict[str, Any]] = {}
        self._sorted_keywords: list[str] = []

    def register_response(self, trigger_keyword: str, response: dict[str, Any]) -> None:
        """Register a canned response for a trigger keyword."""
        kw = trigger_keyword.lower()
        self._responses[kw] = response
        # Re-sort keywords by length descending (longer = more specific = higher priority)
        self._sorted_keywords = sorted(self._responses.keys(), key=len, reverse=True)

    def _match_keyword(self, text: str) -> dict[str, Any] | None:
        """
        Find the best matching keyword in the text.

        Uses word-boundary-aware matching to avoid substring false positives.
        Longer keywords are checked first for specificity.
        """
        text_lower = text.lower()
        for keyword in self._sorted_keywords:
            # Use word-boundary matching for single-word keywords
            # For multi-word keywords, use simple substring (they're already specific)
            if " " in keyword:
                if keyword in text_lower:
                    return self._responses[keyword]
            else:
                pattern = rf'\b{re.escape(keyword)}\b'
                if re.search(pattern, text_lower):
                    return self._responses[keyword]
        return None

    def _enrich_with_speech_parameters(
        self, response: dict[str, Any], transcript: str
    ) -> dict[str, Any]:
        """Merge spoken parameters into a matched canned response (deep copy)."""
        try:
            result = copy.deepcopy(response)
            command = result.get("command") or {}
            viz = command.get("visualization") or {}
            viz_type = viz.get("type", "")
            if viz_type and viz_type != "placeholder":
                spoken_params = extract_speech_parameters(transcript, viz_type)
                if spoken_params:
                    viz.setdefault("parameters", {}).update(spoken_params)
                    command["visualization"] = viz
                    result["command"] = command
                    result["reasoning"] = (
                        f"{result.get('reasoning', '')} | "
                        f"speech params: {spoken_params}"
                    )
            return result
        except Exception as e:  # never break the demo flow on extraction bugs
            logger.warning("Speech parameter extraction failed: %s", e)
            return response

    def _extract_topic(self, text: str) -> str:
        """
        Extract the core topic from a transcript for dynamic image generation.

        Strips common filler words and returns the meaningful content.
        """
        filler = re.compile(
            r'\b(show me|tell me about|explain|what is|what are|let\'?s talk about|'
            r'can you|i want to|let\'?s|please|the|a |an |is |are |was |were |'
            r'of |in |on |at |to |for |with |about|imagine|describe|draw|'
            r'could you|would you|how does|how do)\b',
            re.IGNORECASE,
        )
        cleaned = filler.sub("", text).strip()
        # Remove punctuation and extra whitespace
        cleaned = re.sub(r'[^\w\s]', '', cleaned).strip()
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned if cleaned else text.strip()

    def _build_dynamic_image_response(self, transcript: str) -> dict[str, Any]:
        """
        Generate a dynamic image response from the raw transcript.

        When no keyword matches, this creates an image prompt based on the
        KEY PHRASES of what was said (not filler-degraded fragments), so
        unmatched topics still get a sensible educational illustration.
        """
        # Keep the most meaningful words (nouns-ish, >3 chars) instead of
        # raw filler-stripped fragments that read like gibberish
        words = re.findall(r"[a-zA-Z]{4,}", transcript.lower())
        stop = {
            "show", "tell", "about", "please", "just", "like", "this",
            "that", "with", "have", "does", "would", "could", "want",
            "make", "give", "some", "more", "when", "what", "your", "them",
            "they", "then", "than", "into", "from", "onto", "very", "really",
        }
        key_words = [w for w in words if w not in stop][:6]
        topic = " ".join(key_words) if key_words else self._extract_topic(transcript)
        title = topic[:50].title() if topic else "Exploration"

        image_prompt = (
            f"Professional educational scientific illustration of {topic}. "
            f"Detailed textbook-quality diagram with labeled components and annotations. "
            f"Clean composition on a light background with vibrant accent colors. "
            f"Show the key relationships and processes of {topic} with arrows, "
            f"callout labels, and cross-section details where appropriate. "
            f"Highly detailed, professional educational illustration quality."
        )

        return {
            "command": {
                "action": "new",
                "subject": "general",
                "concept": topic[:100],
                "visualization": {"type": "placeholder", "parameters": {}},
                "theory": {
                    "title": title,
                    "explanation": (
                        f"Exploring {topic}. "
                        f"This visualization was generated based on what you said: "
                        f'"{transcript.strip()}"'
                    ),
                    "formulas": [],
                    "key_points": [
                        f"Topic: {topic}",
                        "Generated from your speech input",
                    ],
                },
                "render_mode": "image",
                "image_prompt": image_prompt,
            },
            "reasoning": f"Mock: dynamic image from transcript '{topic}'",
        }

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """
        Return a mock response based on keyword matching.

        On a keyword match, spoken numeric parameters and math expressions are
        extracted and merged into the canned response. If no keyword matches,
        a dynamic image is generated from the transcript.
        """
        # Extract transcript from the user prompt.
        # The planner formats the prompt as:
        #   CURRENT LESSON STATE: ...
        #   NEW TRANSCRIPT:
        #   "<actual words>"
        #   Analyze the new transcript...
        transcript = ""
        if "NEW TRANSCRIPT:" in user_prompt:
            parts = user_prompt.split("NEW TRANSCRIPT:")
            if len(parts) > 1:
                raw = parts[1].strip()
                # Stop at the next instruction line to avoid capturing template text
                for marker in [
                    "Analyze the new transcript",
                    "Respond with a JSON",
                ]:
                    idx = raw.find(marker)
                    if idx != -1:
                        raw = raw[:idx]
                transcript = raw.strip().strip('"').strip()

        # Try keyword matching first
        matched = self._match_keyword(transcript if transcript else user_prompt)
        if matched:
            if transcript:
                matched = self._enrich_with_speech_parameters(matched, transcript)
            return matched

        # No keyword matched — generate a dynamic image from the transcript
        if transcript and len(transcript) > 3:
            return self._build_dynamic_image_response(transcript)

        # Fallback: truly empty/meaningless input
        return {
            "command": None,
            "reasoning": "Mock provider: input too short to generate visualization",
        }
