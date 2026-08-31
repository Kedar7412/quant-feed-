"""Celery ingestion task: fetch live news -> run the pipeline -> persist.

The Celery beat schedule in ``celery_app`` references ``app.tasks.ingest.ingest_news``
every 15 minutes. This module must import cleanly without a live broker or live
datastores; the stores/embedder/classifier are only constructed when the task
actually runs.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import Settings, get_settings
from app.pipeline import schema_map
from app.pipeline.embeddings import select_embedder
from app.pipeline.fetch import fetch_live_news
from app.pipeline.models import ArticleIn
from app.pipeline.orchestrator import RunResult, run
from app.pipeline.scoring import select_causal_classifier
from app.realtime.diff_publisher import GraphDiff, build_publisher
from app.schemas import EconomicEdge, EconomicNode
from app.stores.neo4j_store import Neo4jStore
from app.stores.postgres import PostgresRelationalStore, _get_sessionmaker
from app.stores.qdrant_store import QdrantStore
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def build_ingestion_diff(articles: list[ArticleIn], result: RunResult) -> GraphDiff:
    """Assemble a ``GraphDiff`` for what this ingestion run added/changed.

    Added nodes are every article touched this run; updated edges are the scored
    edges produced this run (edge topology is applied as a full rewrite on the
    client). Removals are empty — ingestion only adds/updates. Reuses
    ``schema_map`` so the node/edge shapes match ``GET /graph/query`` exactly.
    """
    added_nodes = [
        EconomicNode.model_validate(schema_map.graph_node(a)) for a in articles
    ]
    updated_edges = [
        EconomicEdge.model_validate(schema_map.graph_link(e)) for e in result.scored_edges
    ]
    return GraphDiff(added_nodes=added_nodes, updated_edges=updated_edges)


def publish_ingestion_diff(
    settings: Settings, articles: list[ArticleIn], result: RunResult
) -> None:
    """Best-effort publish of the ingestion diff, guarded by ``realtime_enabled``.

    A disabled flag makes this a no-op; a misconfigured/unreachable Redis is
    swallowed and logged so it can NEVER fail ingestion. The publisher is
    constructed lazily here so the module imports without a live broker.
    """
    if not settings.realtime_enabled:
        return
    diff = build_ingestion_diff(articles, result)
    if diff.is_empty():
        return
    try:
        publisher = build_publisher(settings)
        asyncio.run(publisher.publish(diff))
    except Exception as exc:  # noqa: BLE001 - best-effort, never fail ingestion
        logger.warning("Realtime diff publish failed (ignored): %s", exc)


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
        result = run(
            articles,
            settings=settings,
            embedder=select_embedder(settings),
            causal_classifier=select_causal_classifier(settings),
            graph_store=graph_store,
            vector_store=vector_store,
            relational_store=relational_store,
        )
        # Best-effort real-time diff publish AFTER persistence. Guarded by the
        # realtime flag; never fails ingestion.
        publish_ingestion_diff(settings, articles, result)
        return result
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
