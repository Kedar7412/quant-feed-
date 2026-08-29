"""One-shot backfill CLI.

Run with ``uv run python -m scripts.backfill``. Fetches real news, runs the full
ingestion pipeline against the live datastores (Postgres + Qdrant + Neo4j) and
prints a summary of what was written.

Offline safety: when ``OPENAI_API_KEY`` is unset the pipeline falls back to a
deterministic local embedder + a shared-entity heuristic causal classifier
(analogous to the frontend fallback), so the backfill still populates a
non-empty graph. Re-running is idempotent: nodes and edges are upserted by
natural key, so counts stabilize on the second run.
"""

from __future__ import annotations

import argparse
import logging
import sys

from app.config import get_settings
from app.pipeline.embeddings import select_embedder
from app.pipeline.fetch import fetch_live_news
from app.pipeline.orchestrator import run
from app.pipeline.scoring import select_causal_classifier
from app.stores.neo4j_store import Neo4jStore
from app.stores.postgres import PostgresRelationalStore, _get_sessionmaker
from app.stores.qdrant_store import QdrantStore

logger = logging.getLogger("scripts.backfill")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill the graph/vector stores.")
    parser.add_argument(
        "--limit", type=int, default=0, help="Cap the number of fetched articles (0 = no cap)."
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    settings = get_settings()

    mode = "OpenAI" if settings.openai_api_key else "offline (local embedder + heuristic)"
    logger.info("Backfill starting in %s mode", mode)

    articles = fetch_live_news()
    if args.limit > 0:
        articles = articles[: args.limit]
    logger.info("Fetched %d articles", len(articles))

    if not articles:
        logger.warning("No articles fetched; nothing to backfill.")
        return 0

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
    finally:
        session.close()
        graph_store.close()
        vector_store.close()

    print("Backfill complete:")
    print(f"  articles written : {result.articles}")
    print(f"  entities linked   : {result.entities}")
    print(f"  candidate pairs   : {result.candidates}")
    print(f"  edges written     : {result.edges}")
    print(f"  vectors written   : {result.vectors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
