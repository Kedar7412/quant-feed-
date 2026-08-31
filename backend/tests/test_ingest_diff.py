"""Tests for the ingestion diff-publish hook (``app.tasks.ingest``).

These exercise the pure diff-builder and the best-effort publish guard without a
live broker or datastores. The publish path must be a no-op when
``realtime_enabled`` is False and must swallow errors so it never fails
ingestion.
"""

from __future__ import annotations

from app.config import Settings
from app.pipeline.models import ArticleIn, ScoredEdge
from app.pipeline.orchestrator import RunResult
from app.tasks.ingest import build_ingestion_diff, publish_ingestion_diff


def _articles() -> list[ArticleIn]:
    return [
        ArticleIn(
            id="a1",
            title="RBI hikes repo rate",
            summary="Rates up.",
            category="economic",
            economic_impact_score=8.0,
            tags=["rbi"],
        ),
        ArticleIn(
            id="a2",
            title="Inflation climbs",
            summary="Prices rise.",
            category="economic",
            economic_impact_score=2.0,
            tags=["inflation"],
        ),
    ]


def _result() -> RunResult:
    result = RunResult(articles=2, edges=1)
    result.scored_edges = [
        ScoredEdge(
            source_article_id="a1",
            target_article_id="a2",
            semantic=0.8,
            entity_overlap=0.5,
            causal=0.4,
            direction="source->target",
            weight=0.64,
            relationship="related",
        )
    ]
    return result


def test_build_ingestion_diff_shape() -> None:
    """The diff carries added nodes + updated edges in the camelCase contract."""
    diff = build_ingestion_diff(_articles(), _result())
    body = diff.to_dict()

    assert set(body.keys()) == {"addedNodes", "removedNodes", "updatedEdges"}
    assert [n["id"] for n in body["addedNodes"]] == ["a1", "a2"]
    assert body["addedNodes"][0]["articleId"] == "a1"
    assert body["addedNodes"][0]["economicImpactScore"] == 8.0
    assert body["removedNodes"] == []
    edge = body["updatedEdges"][0]
    assert edge == {
        "source": "a1",
        "target": "a2",
        "strength": 0.64,
        "relationship": "related",
    }


def test_publish_noop_when_realtime_disabled() -> None:
    """With realtime OFF (the default) publishing does nothing and never raises."""
    settings = Settings(realtime_enabled=False)
    # Must not raise even though no broker is reachable.
    publish_ingestion_diff(settings, _articles(), _result())


def test_publish_best_effort_swallows_errors() -> None:
    """With realtime ON but an unreachable broker, publish fails silently."""
    settings = Settings(
        realtime_enabled=True,
        redis_url="redis://127.0.0.1:1/0",  # nothing listening
    )
    # A connection error inside asyncio.run(publish) must be swallowed.
    publish_ingestion_diff(settings, _articles(), _result())
