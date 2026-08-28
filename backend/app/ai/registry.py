"""
Server-side visualization type registry.

Maintains a catalog of all registered visualization types and their
parameter schemas. Used by:
1. The AI prompt builder (to tell the LLM what's available)
2. The validator (to check LLM output against registered types)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Root directory for renderer manifests
MANIFESTS_DIR = Path(__file__).resolve().parent.parent.parent / "renderers"


class VisualizationRegistry:
    """
    Registry of all available visualization types.

    Each type is identified by a dot-separated string like "physics.projectile".
    Each type has a JSON schema describing its valid parameters.
    """

    def __init__(self) -> None:
        self._types: dict[str, dict[str, Any]] = {}

    def register(self, viz_type: str, manifest: dict[str, Any]) -> None:
        """Register a visualization type with its manifest."""
        self._types[viz_type] = manifest
        logger.debug("Registered visualization type: %s", viz_type)

    def get(self, viz_type: str) -> dict[str, Any] | None:
        """Get a visualization type's manifest, or None if not found."""
        return self._types.get(viz_type)

    def has(self, viz_type: str) -> bool:
        """Check if a visualization type is registered."""
        return viz_type in self._types

    def all_types(self) -> list[str]:
        """Return all registered type identifiers."""
        return list(self._types.keys())

    def all_manifests(self) -> list[dict[str, Any]]:
        """Return all registered manifests."""
        return list(self._types.values())

    def get_catalog_for_prompt(self) -> str:
        """
        Build a human-readable catalog string for the AI system prompt.

        This tells the LLM exactly which visualization types are available
        and what parameters each accepts.
        """
        lines = []
        for viz_type, manifest in sorted(self._types.items()):
            lines.append(f"## {viz_type}")
            lines.append(f"Name: {manifest.get('name', viz_type)}")
            lines.append(f"Subject: {manifest.get('subject', 'unknown')}")
            if manifest.get("description"):
                lines.append(f"Description: {manifest['description']}")

            params = manifest.get("parameters", {})
            if params.get("properties"):
                lines.append("Parameters:")
                for pname, pschema in params["properties"].items():
                    ptype = pschema.get("type", "any")
                    pdefault = pschema.get("default", "none")
                    punit = pschema.get("unit", "")
                    desc = f"  - {pname}: {ptype}"
                    if pdefault != "none":
                        desc += f" (default: {pdefault})"
                    if punit:
                        desc += f" [{punit}]"
                    if pschema.get("min") is not None:
                        desc += f" min={pschema['min']}"
                    if pschema.get("max") is not None:
                        desc += f" max={pschema['max']}"
                    lines.append(desc)

            required = params.get("required", [])
            if required:
                lines.append(f"Required: {', '.join(required)}")
            lines.append("")

        return "\n".join(lines)

    def validate_command(self, viz_type: str, parameters: dict) -> dict | None:
        """
        Validate parameters against a registered type's schema.

        Returns the validated parameters (with defaults filled in),
        or None if validation fails.
        """
        manifest = self.get(viz_type)
        if not manifest:
            logger.warning("Unknown visualization type: %s", viz_type)
            return None

        schema = manifest.get("parameters", {})
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        # Check required parameters
        for req in required:
            if req not in parameters:
                logger.warning("Missing required parameter '%s' for %s", req, viz_type)
                return None

        # Validate types and fill defaults
        validated = {}
        for pname, pvalue in parameters.items():
            if pname not in properties:
                # Unknown parameter — allow it but log a warning
                validated[pname] = pvalue
                continue

            pschema = properties[pname]
            expected_type = pschema.get("type", "any")

            # Basic type checking
            if expected_type == "number" and not isinstance(pvalue, (int, float)):
                logger.warning("Parameter '%s' expected number, got %s", pname, type(pvalue).__name__)
                return None
            if expected_type == "boolean" and not isinstance(pvalue, bool):
                logger.warning("Parameter '%s' expected boolean, got %s", pname, type(pvalue).__name__)
                return None
            if expected_type == "string" and not isinstance(pvalue, str):
                logger.warning("Parameter '%s' expected string, got %s", pname, type(pvalue).__name__)
                return None

            # Range checking for numbers
            if isinstance(pvalue, (int, float)):
                pmin = pschema.get("min")
                pmax = pschema.get("max")
                if pmin is not None and pvalue < pmin:
                    pvalue = pmin  # Clamp to min
                if pmax is not None and pvalue > pmax:
                    pvalue = pmax  # Clamp to max

            validated[pname] = pvalue

        # Fill in defaults for missing optional parameters
        for pname, pschema in properties.items():
            if pname not in validated and "default" in pschema:
                validated[pname] = pschema["default"]

        return validated

    def load_manifests_from_disk(self, manifests_dir: Path | None = None) -> int:
        """
        Auto-discover and load all manifest.json files from the renderers directory.

        Returns the number of manifests loaded.
        """
        base = manifests_dir or MANIFESTS_DIR
        count = 0

        if not base.exists():
            logger.warning("Renderers directory not found: %s", base)
            return 0

        for manifest_file in base.rglob("manifest.json"):
            try:
                with open(manifest_file, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                viz_type = manifest.get("type")
                if viz_type:
                    self.register(viz_type, manifest)
                    count += 1
                else:
                    logger.warning("Manifest missing 'type' field: %s", manifest_file)
            except (json.JSONDecodeError, OSError) as e:
                logger.error("Failed to load manifest %s: %s", manifest_file, e)

        logger.info("Loaded %d visualization manifests from %s", count, base)
        return count


# Singleton instance
registry = VisualizationRegistry()
