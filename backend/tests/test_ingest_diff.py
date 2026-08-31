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


def test_diff_uses_cumulative_edges_not_just_this_run() -> None:
    """Regression: the diff must carry the FULL edge set, not just this run's.

    The client applies ``updatedEdges`` as a full rewrite of its edge buffer, so
    a diff carrying only the latest run's scored edges would drop every
    previously loaded/streamed edge. ``build_ingestion_diff`` must emit the
    cumulative edge set when one is supplied.
    """
    # This run scored a single a1->a2 edge...
    result = _result()
    # ...but the persisted graph already contains an earlier a2->a3 edge too.
    cumulative = [
        result.scored_edges[0],
        ScoredEdge(
            source_article_id="a2",
            target_article_id="a3",
            semantic=0.5,
            entity_overlap=0.3,
            causal=0.2,
            direction="source->target",
            weight=0.4,
            relationship="related",
        ),
    ]

    diff = build_ingestion_diff(_articles(), result, cumulative_edges=cumulative)
    body = diff.to_dict()

    pairs = {(e["source"], e["target"]) for e in body["updatedEdges"]}
    # Both the new edge AND the pre-existing edge must be present, so a full
    # rewrite on the client does not wipe prior topology.
    assert pairs == {("a1", "a2"), ("a2", "a3")}
    assert len(body["updatedEdges"]) == 2


def test_diff_falls_back_to_run_edges_without_cumulative() -> None:
    """Without a cumulative set the builder falls back to this run's edges."""
    diff = build_ingestion_diff(_articles(), _result())
    body = diff.to_dict()
    pairs = {(e["source"], e["target"]) for e in body["updatedEdges"]}
    assert pairs == {("a1", "a2")}


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
