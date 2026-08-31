"""Tests for the offline seed set and Postgres commit granularity.

These cover two review-remediation items without any live datastore:

* ``app.pipeline.seed.seed_articles`` yields a non-empty, related graph so a
  truly-offline backfill (no network) still populates edges (review issue #4).
* ``PostgresRelationalStore(autocommit=False)`` flushes per write and commits
  once, collapsing the per-entity/per-edge transactions (review issue #7).
"""

from __future__ import annotations

from unittest.mock import MagicMock

from app.config import Settings
from app.pipeline import orchestrator
from app.pipeline.seed import seed_articles
from app.stores.postgres import PostgresRelationalStore
from tests.conftest import (
    FakeCausalClassifier,
    FakeEmbedder,
    InMemoryGraphStore,
    InMemoryRelationalStore,
    InMemoryVectorStore,
)


def test_seed_articles_are_deterministic_and_nonempty() -> None:
    first = seed_articles()
    second = seed_articles()
    assert len(first) >= 5
    # Deterministic ids (published_at differs only by the `now` anchor).
    assert [a.id for a in first] == [a.id for a in second]
    # All ids unique.
    assert len({a.id for a in first}) == len(first)


def test_seed_backfill_produces_related_graph_offline() -> None:
    """Running the pipeline over the seed set offline yields a non-empty graph
    WITH edges (the seed articles share entities/topics)."""
    graph, vector, relational = (
        InMemoryGraphStore(),
        InMemoryVectorStore(),
        InMemoryRelationalStore(),
    )
    result = orchestrator.run(
        seed_articles(),
        settings=Settings(openai_api_key=None),
        embedder=FakeEmbedder(),
        causal_classifier=FakeCausalClassifier(),
        graph_store=graph,
        vector_store=vector,
        relational_store=relational,
        spacy_model="en_core_web_sm",
    )
    assert result.articles >= 5
    assert result.edges >= 1  # non-empty graph, not an isolated node dump
    assert len(relational.edges) == result.edges


def test_relational_store_autocommit_true_commits_each_write() -> None:
    session = MagicMock()
    session.get.return_value = None
    store = PostgresRelationalStore(session, autocommit=True)
    store.upsert_article({"id": "a1", "title": "t"})
    assert session.commit.called
    assert not session.flush.called


def test_relational_store_autocommit_false_flushes_not_commits() -> None:
    session = MagicMock()
    session.get.return_value = None
    store = PostgresRelationalStore(session, autocommit=False)
    store.upsert_article({"id": "a1", "title": "t"})
    # Per-write only flushes (assigns ids); no commit until explicitly asked.
    assert session.flush.called
    assert not session.commit.called

    store.commit()
    assert session.commit.call_count == 1
