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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle. Load manifests and initialize AI planner."""
    # Load visualization manifests from disk
    count = viz_registry.load_manifests_from_disk()
    logger.info("Loaded %d visualization manifests", count)

    # Initialize the AI planner (uses MockProvider if no OpenAI key is set)
    if settings.openai_api_key:
        from app.ai.openai_provider import OpenAIProvider
        provider = OpenAIProvider()
        logger.info("AI Planner initialized with OpenAI provider")
    else:
        from app.ai.openai_provider import MockProvider
        provider = MockProvider()
        logger.info("AI Planner initialized with MockProvider (no API key)")

    planner = AIPlanner(provider=provider, registry=viz_registry)
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
