"""FastAPI TestClient tests for the read API (/graph/query, /articles/{id}, /health).

All datastore access is faked with an in-memory ``FakeReadStore`` seeded with a
small fixture graph, so these tests require no live Neo4j/Qdrant/Postgres/OpenAI.
They assert the GraphData JSON contract, that each filter measurably narrows the
node/link set (pruning dangling links), 404 for unknown article ids, and that
/health reports per-store statuses.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import create_app
from app.pipeline.models import ArticleIn, ScoredEdge
from app.routers.deps import get_read_store

NOW = datetime.now(UTC)


def _iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat()


class FakeReadStore:
    """In-memory ``GraphReadStore`` seeded with a fixture graph."""

    def __init__(
        self,
        articles: list[ArticleIn],
        edges: list[ScoredEdge],
        entities: dict[str, list[dict[str, str | None]]] | None = None,
    ) -> None:
        self._articles = {a.id: a for a in articles}
        self._edges = edges
        self._entities = entities or {}

    def list_articles(self) -> list[ArticleIn]:
        return list(self._articles.values())

    def list_edges(self) -> list[ScoredEdge]:
        return list(self._edges)

    def get_article(self, article_id: str) -> ArticleIn | None:
        return self._articles.get(article_id)

    def get_entities_for_article(self, article_id: str) -> list[dict[str, str | None]]:
        return list(self._entities.get(article_id, []))

    def get_edges_for_article(self, article_id: str) -> list[ScoredEdge]:
        return [e for e in self._edges if article_id in (e.source_article_id, e.target_article_id)]


def _fixture_store() -> FakeReadStore:
    articles = [
        ArticleIn(
            id="a1",
            title="RBI hikes repo rate to curb inflation",
            summary="The central bank raised rates.",
            source="Reuters",
            url="https://example.com/a1",
            published_at=_iso(0.2),
            category="economic",
            economic_impact_score=8.0,
            tags=["rbi", "inflation", "rates"],
        ),
        ArticleIn(
            id="a2",
            title="Inflation rates climb as RBI signals more hikes",
            summary="Prices continue to rise.",
            source="Bloomberg",
            url="https://example.com/a2",
            published_at=_iso(0.5),
            category="economic",
            economic_impact_score=2.0,
            tags=["rbi", "inflation", "rates"],
        ),
        ArticleIn(
            id="a3",
            title="Parliament debates new trade policy",
            summary="Political discussion on trade.",
            source="PTI",
            url="https://example.com/a3",
            published_at=_iso(10.0),
            category="political",
            economic_impact_score=5.0,
            tags=["policy", "trade"],
        ),
    ]
    edges = [
        ScoredEdge(
            source_article_id="a1",
            target_article_id="a2",
            semantic=0.8,
            entity_overlap=0.6,
            causal=0.5,
            direction="source->target",
            weight=0.64,
            relationship="related",
        ),
        # Cross-category edge: pruned when filtering to a single category.
        ScoredEdge(
            source_article_id="a1",
            target_article_id="a3",
            semantic=0.3,
            entity_overlap=0.1,
            causal=0.2,
            direction="source->target",
            weight=0.21,
            relationship="tangential",
        ),
    ]
    entities: dict[str, list[dict[str, str | None]]] = {
        "a1": [{"name": "RBI", "label": "CENTRAL_BANK", "canonical": "RBI"}],
        "a2": [{"name": "RBI", "label": "CENTRAL_BANK", "canonical": "RBI"}],
        "a3": [{"name": "Parliament", "label": "ORG", "canonical": "Parliament"}],
    }
    return FakeReadStore(articles, edges, entities)


def _client(store: FakeReadStore) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_read_store] = lambda: store
    return TestClient(app)


def test_graph_query_contract_shape() -> None:
    """/graph/query returns the exact GraphData + correlations + dataSource shape."""
    client = _client(_fixture_store())
    resp = client.get("/graph/query")
    assert resp.status_code == 200
    body = resp.json()

    assert set(body.keys()) == {"nodes", "links", "correlations", "dataSource"}
    assert body["dataSource"] == "live"
    assert len(body["nodes"]) == 3
    assert len(body["links"]) == 2

    node = next(n for n in body["nodes"] if n["id"] == "a1")
    # EconomicNode field names must match lib/types.ts (camelCase).
    for field in (
        "id",
        "articleId",
        "label",
        "category",
        "val",
        "color",
        "title",
        "summary",
        "source",
        "economicImpactScore",
        "tags",
        "url",
    ):
        assert field in node
    assert node["articleId"] == "a1"
    assert node["color"] == "#f59e0b"  # economic

    link = body["links"][0]
    for field in ("source", "target", "strength", "relationship"):
        assert field in link
    a1_a2 = next(
        link for link in body["links"] if link["source"] == "a1" and link["target"] == "a2"
    )
    assert a1_a2["strength"] == 0.64  # strength == composite weight


def test_correlations_present() -> None:
    """Correlations cluster the two RBI/inflation articles."""
    client = _client(_fixture_store())
    body = client.get("/graph/query").json()
    correlations = body["correlations"]
    assert len(correlations) >= 1
    corr = correlations[0]
    for field in ("topicId", "keywords", "articleIds", "changeVelocity", "latestArticleDate"):
        assert field in corr
    assert set(corr["articleIds"]) == {"a1", "a2"}


def test_category_filter_narrows_and_prunes_links() -> None:
    """Category filter narrows nodes AND prunes links whose endpoints were removed."""
    client = _client(_fixture_store())
    body = client.get("/graph/query", params={"category": "economic"}).json()

    node_ids = {n["id"] for n in body["nodes"]}
    assert node_ids == {"a1", "a2"}  # a3 (political) dropped
    # The a1->a3 link must be pruned; only a1->a2 survives.
    assert len(body["links"]) == 1
    assert body["links"][0]["source"] == "a1"
    assert body["links"][0]["target"] == "a2"


def test_sector_alias_matches_category() -> None:
    """The `sector` alias behaves like `category`."""
    client = _client(_fixture_store())
    body = client.get("/graph/query", params={"sector": "political"}).json()
    node_ids = {n["id"] for n in body["nodes"]}
    assert node_ids == {"a3"}
    assert body["links"] == []  # both edges pruned


def test_date_range_filter() -> None:
    """Date-range filter drops articles outside the window and prunes links."""
    client = _client(_fixture_store())
    start = (NOW - timedelta(days=2)).isoformat()
    body = client.get("/graph/query", params={"startDate": start}).json()
    node_ids = {n["id"] for n in body["nodes"]}
    assert node_ids == {"a1", "a2"}  # a3 is 10 days old
    assert len(body["links"]) == 1


def test_sentiment_filter() -> None:
    """Sentiment filter (derived from impact score) narrows the node set."""
    client = _client(_fixture_store())
    # a1 has score 8 -> positive; a2 score 2 -> negative; a3 score 5 -> neutral.
    positive = client.get("/graph/query", params={"sentiment": "positive"}).json()
    assert {n["id"] for n in positive["nodes"]} == {"a1"}
    # Both endpoints of every edge gone/partial -> links pruned.
    assert positive["links"] == []

    negative = client.get("/graph/query", params={"sentiment": "negative"}).json()
    assert {n["id"] for n in negative["nodes"]} == {"a2"}


def test_entity_filter() -> None:
    """Entity filter keeps only articles mentioning the entity."""
    client = _client(_fixture_store())
    body = client.get("/graph/query", params={"entity": "RBI"}).json()
    assert {n["id"] for n in body["nodes"]} == {"a1", "a2"}

    none = client.get("/graph/query", params={"entity": "Nonexistent"}).json()
    assert none["nodes"] == []
    assert none["links"] == []


def test_article_detail() -> None:
    """/articles/{id} returns the article + entities + neighbors."""
    client = _client(_fixture_store())
    resp = client.get("/articles/a1")
    assert resp.status_code == 200
    body = resp.json()

    assert body["id"] == "a1"
    assert body["title"].startswith("RBI hikes")
    assert body["economicImpactScore"] == 8.0
    assert [e["name"] for e in body["entities"]] == ["RBI"]

    neighbor_ids = {n["articleId"] for n in body["neighbors"]}
    assert neighbor_ids == {"a2", "a3"}
    a2_neighbor = next(n for n in body["neighbors"] if n["articleId"] == "a2")
    assert a2_neighbor["direction"] == "outgoing"
    assert a2_neighbor["strength"] == 0.64


def test_article_detail_404() -> None:
    """/articles/{id} returns 404 for an unknown id."""
    client = _client(_fixture_store())
    resp = client.get("/articles/does-not-exist")
    assert resp.status_code == 404


def test_health_reports_store_statuses() -> None:
    """/health reports per-store statuses (all datastore checks patched)."""
    with (
        patch("app.main._check_neo4j", return_value="ok"),
        patch("app.main._check_qdrant", return_value="unavailable"),
        patch("app.main._check_postgres", return_value="ok"),
    ):
        client = TestClient(create_app())
        resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"status", "neo4j", "qdrant", "postgres"}
    assert body["neo4j"] == "ok"
    assert body["qdrant"] == "unavailable"
    assert body["postgres"] == "ok"
    assert body["status"] == "degraded"
