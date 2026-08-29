"""FastAPI application factory and health endpoint."""

from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from app.config import Settings, get_settings

DatastoreStatus = Literal["ok", "unavailable"]


class HealthResponse(BaseModel):
    """Response schema for GET /health."""

    status: str
    neo4j: DatastoreStatus
    qdrant: DatastoreStatus
    postgres: DatastoreStatus


def _check_neo4j(settings: Settings) -> DatastoreStatus:
    try:
        from app.stores.neo4j_store import Neo4jStore

        store = Neo4jStore(settings)
        try:
            store.verify_connectivity()
            return "ok"
        finally:
            store.close()
    except Exception:
        return "unavailable"


def _check_qdrant(settings: Settings) -> DatastoreStatus:
    try:
        from app.stores.qdrant_store import QdrantStore

        store = QdrantStore(settings)
        try:
            store.ping()
            return "ok"
        finally:
            store.close()
    except Exception:
        return "unavailable"


def _check_postgres() -> DatastoreStatus:
    try:
        from app.stores.postgres import get_engine

        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "unavailable"


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()
    app = FastAPI(title="Quant Feed Backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        """Best-effort health probe of all backing datastores."""
        neo4j_status = _check_neo4j(settings)
        qdrant_status = _check_qdrant(settings)
        postgres_status = _check_postgres()
        overall = (
            "ok"
            if neo4j_status == "ok" and qdrant_status == "ok" and postgres_status == "ok"
            else "degraded"
        )
        return HealthResponse(
            status=overall,
            neo4j=neo4j_status,
            qdrant=qdrant_status,
            postgres=postgres_status,
        )

    return app


app = create_app()
