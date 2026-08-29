"""Unit tests for the schema-mapping / type-adapter layer.

Assert the Postgres / Qdrant / Neo4j payload shapes and the frontend
GraphData / EconomicEdge contract, including that ``link.strength`` equals the
composite ``ScoredEdge.weight`` and node colors match the frontend
category->color map in ``lib/news/store.ts``.
"""

from __future__ import annotations

from app.pipeline import schema_map
from app.pipeline.models import ArticleIn, LinkedEntity, ScoredEdge


def _article(**kwargs: object) -> ArticleIn:
    base: dict[str, object] = {
        "id": "art-1",
        "title": "RBI holds repo rate steady amid inflation concerns",
        "summary": "The central bank kept rates unchanged.",
        "source": "The Hindu",
        "url": "https://example.com/a1",
        "published_at": "2026-01-01T00:00:00+00:00",
        "category": "economic",
        "economic_impact_score": 8.0,
        "tags": ["monetary policy", "inflation"],
    }
    base.update(kwargs)
    return ArticleIn(**base)


def _edge(weight: float = 0.612) -> ScoredEdge:
    return ScoredEdge(
        source_article_id="art-1",
        target_article_id="art-2",
        semantic=0.8,
        entity_overlap=0.4,
        causal=0.5,
        direction="source->target",
        weight=weight,
        relationship="related",
    )


def test_category_color_matches_frontend_map() -> None:
    assert schema_map.category_color("domestic") == "#22c55e"
    assert schema_map.category_color("international") == "#3b82f6"
    assert schema_map.category_color("economic") == "#f59e0b"
    assert schema_map.category_color("political") == "#ef4444"


def test_article_row_shape() -> None:
    row = schema_map.article_row(_article())
    assert row["id"] == "art-1"
    assert row["economic_impact_score"] == 8.0
    assert row["tags"] == ["monetary policy", "inflation"]
    assert set(row) == {
        "id",
        "title",
        "summary",
        "source",
        "url",
        "published_at",
        "category",
        "subcategory",
        "economic_impact_score",
        "tags",
        "is_live_data",
    }


def test_entity_row_uses_canonical_name() -> None:
    ent = LinkedEntity(name="RBI", canonical="Reserve Bank of India", label="CENTRAL_BANK")
    row = schema_map.entity_row(ent)
    assert row == {
        "name": "Reserve Bank of India",
        "label": "CENTRAL_BANK",
        "canonical": "Reserve Bank of India",
    }


def test_qdrant_point_shape() -> None:
    point = schema_map.qdrant_point(_article(), [0.1, 0.2, 0.3])
    assert point["point_id"] == "art-1"
    assert point["vector"] == [0.1, 0.2, 0.3]
    assert point["payload"]["article_id"] == "art-1"
    assert point["payload"]["category"] == "economic"


def test_neo4j_article_props_shape() -> None:
    props = schema_map.neo4j_article_props(_article())
    assert props["title"].startswith("RBI holds")
    assert props["category"] == "economic"
    assert "id" not in props  # id is the merge key, not a property here.


def test_neo4j_relates_to_kwargs() -> None:
    kwargs = schema_map.neo4j_relates_to(_edge(0.55))
    assert kwargs["source_article_id"] == "art-1"
    assert kwargs["target_article_id"] == "art-2"
    assert kwargs["weight"] == 0.55
    assert kwargs["direction"] == "source->target"


def test_graph_node_contract() -> None:
    node = schema_map.graph_node(_article())
    assert node["id"] == "art-1"
    assert node["articleId"] == "art-1"
    assert node["category"] == "economic"
    assert node["color"] == "#f59e0b"  # economic -> amber, matches frontend.
    assert node["val"] == 8.0
    assert node["economicImpactScore"] == 8.0
    assert node["tags"] == ["monetary policy", "inflation"]
    # Frontend truncates long titles to 40 chars + "...".
    long_node = schema_map.graph_node(_article(title="x" * 60))
    assert long_node["label"] == "x" * 40 + "..."


def test_graph_link_strength_equals_composite_weight() -> None:
    edge = _edge(0.612)
    link = schema_map.graph_link(edge)
    assert link["strength"] == 0.612
    assert link["strength"] == edge.weight
    assert link["source"] == "art-1"
    assert link["target"] == "art-2"
    assert link["relationship"] == "related"


def test_build_graph_data_shape() -> None:
    articles = [_article(), _article(id="art-2", category="political")]
    edges = [_edge()]
    graph = schema_map.build_graph_data(articles, edges)
    assert set(graph) == {"nodes", "links"}
    assert len(graph["nodes"]) == 2
    assert len(graph["links"]) == 1
    assert graph["nodes"][1]["color"] == "#ef4444"  # political -> red.
    assert graph["links"][0]["strength"] == edges[0].weight
