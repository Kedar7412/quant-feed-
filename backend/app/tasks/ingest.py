"""Celery ingestion task: fetch live news -> run the pipeline -> persist.

The Celery beat schedule in ``celery_app`` references ``app.tasks.ingest.ingest_news``
every 15 minutes. This module must import cleanly without a live broker or live
datastores; the stores/embedder/classifier are only constructed when the task
actually runs.
"""

from __future__ import annotations

from typing import Any

from app.config import get_settings
from app.pipeline.embeddings import select_embedder
from app.pipeline.fetch import fetch_live_news
from app.pipeline.orchestrator import RunResult, run
from app.pipeline.scoring import select_causal_classifier
from app.stores.neo4j_store import Neo4jStore
from app.stores.postgres import PostgresRelationalStore, _get_sessionmaker
from app.stores.qdrant_store import QdrantStore
from app.tasks.celery_app import celery_app


def run_ingestion() -> RunResult:
    """Fetch live news and run the full pipeline against the real datastores.

    Constructs the embedder/classifier via the config-driven selectors so that a
    missing ``OPENAI_API_KEY`` transparently falls back to offline components.
    """
    settings = get_settings()
    articles = fetch_live_news()

    graph_store = Neo4jStore(settings)
    graph_store.init_schema()
    vector_store = QdrantStore(settings)
    session = _get_sessionmaker()()
    relational_store = PostgresRelationalStore(session)

    try:
        return run(
            articles,
            settings=settings,
            embedder=select_embedder(settings),
            causal_classifier=select_causal_classifier(settings),
            graph_store=graph_store,
            vector_store=vector_store,
            relational_store=relational_store,
        )
    finally:
        session.close()
        graph_store.close()
        vector_store.close()


@celery_app.task(name="app.tasks.ingest.ingest_news")
def ingest_news() -> dict[str, Any]:
    """Periodic ingestion task. Returns a summary dict of what was written."""
    result = run_ingestion()
    return {
        "articles": result.articles,
        "entities": result.entities,
        "edges": result.edges,
        "vectors": result.vectors,
        "candidates": result.candidates,
    }
