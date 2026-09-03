"""
JSON schema cleaning for provider-specific structured output.

Pydantic's model_json_schema() emits fields that some structured-output
APIs reject ($defs/$ref indirection, title, default, additionalProperties,
minLength/maxLength) and nullable unions (anyOf [X, {"type": "null"}])
that Gemini's schema subset cannot express. clean_schema() resolves and
strips those, producing a plain nested schema every provider accepts.

Relaxing the LLM-side schema is safe: the planner re-validates every
response with Pydantic afterward.
"""

from __future__ import annotations

from typing import Any

# Keys Pydantic emits that structured-output APIs commonly reject.
_UNSUPPORTED_KEYS = frozenset({
    "$defs", "title", "default", "additionalProperties",
    "minLength", "maxLength",
})


def clean_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Convert a Pydantic JSON schema into a plain nested schema."""
    defs = schema.get("$defs", {})

    def clean(node: Any) -> Any:
        if isinstance(node, list):
            return [clean(item) for item in node]
        if not isinstance(node, dict):
            return node

        # Inline $ref definitions — not every provider resolves $defs
        if "$ref" in node:
            name = node["$ref"].rsplit("/", 1)[-1]
            return clean(defs.get(name, {"type": "string"}))

        # Collapse nullable unions: anyOf [X, {"type": "null"}] -> X
        if "anyOf" in node:
            variants = [
                v for v in node["anyOf"]
                if not (isinstance(v, dict) and v.get("type") == "null")
            ]
            if len(variants) == 1:
                merged = clean(variants[0])
                if "description" in node:
                    merged.setdefault("description", node["description"])
                return merged
            result = {
                key: clean(value)
                for key, value in node.items()
                if key != "anyOf"
            }
            result["anyOf"] = [clean(v) for v in variants]
            return result

        return {
            key: clean(value)
            for key, value in node.items()
            if key not in _UNSUPPORTED_KEYS
        }

    return clean(schema)
