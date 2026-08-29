"""Schema-mapping / type-adapter layer (pure, fully unit-tested).

Converts pipeline outputs into the four downstream shapes:

1. Postgres rows          -> ``article_row`` / ``entity_row`` / ``edge_row``
2. Qdrant points          -> ``qdrant_point``
3. Neo4j upsert payloads  -> ``neo4j_article_props`` / ``neo4j_relates_to``
4. Frontend GraphData     -> ``graph_node`` / ``graph_link`` / ``build_graph_data``

The GraphData contract matches ``lib/types.ts`` (``EconomicNode`` /
``EconomicEdge`` / ``GraphData``) and the category->color map matches
``lib/news/store.ts``. ``link.strength`` equals the composite ``ScoredEdge.weight``.

FEAT-003 (the FastAPI read API) should reuse ``build_graph_data`` to serve
``GET /graph/query`` and ``article_row``/``graph_node`` shapes for
``GET /articles/{id}``.
"""

from __future__ import annotations

from typing import Any

from app.pipeline.models import ArticleIn, LinkedEntity, ScoredEdge

# Category -> node color. Mirrors the map in lib/news/store.ts exactly.
CATEGORY_COLORS: dict[str, str] = {
    "domestic": "#22c55e",
    "international": "#3b82f6",
    "economic": "#f59e0b",
    "political": "#ef4444",
}

_DEFAULT_COLOR = "#ef4444"  # matches the frontend fall-through (political / else).


def category_color(category: str) -> str:
    """Return the node color for a category (matches the frontend map)."""
    return CATEGORY_COLORS.get(category, _DEFAULT_COLOR)


def _node_label(title: str) -> str:
    """Truncated label for a graph node (mirrors the frontend `.substring(0,40)`)."""
    return title[:40] + "..." if len(title) > 40 else title


# --------------------------------------------------------------------------- #
# Postgres rows
# --------------------------------------------------------------------------- #


def article_row(article: ArticleIn) -> dict[str, Any]:
    """Map an ``ArticleIn`` to keyword args for the Postgres ``Article`` model."""
    return {
        "id": article.id,
        "title": article.title,
        "summary": article.summary,
        "source": article.source,
        "url": article.url,
        "published_at": article.published_at,
        "category": article.category,
        "subcategory": article.subcategory,
        "economic_impact_score": article.economic_impact_score,
        "tags": list(article.tags),
        "is_live_data": article.is_live_data,
    }


def entity_row(entity: LinkedEntity) -> dict[str, Any]:
    """Map a ``LinkedEntity`` to keyword args for the Postgres ``Entity`` model."""
    return {
        "name": entity.canonical,
        "label": entity.label,
        "canonical": entity.canonical,
    }


def edge_row(edge: ScoredEdge) -> dict[str, Any]:
    """Map a ``ScoredEdge`` to keyword args for the Postgres ``Edge`` model."""
    return {
        "source_article_id": edge.source_article_id,
        "target_article_id": edge.target_article_id,
        "semantic": edge.semantic,
        "entity_overlap": edge.entity_overlap,
        "causal": edge.causal,
        "direction": edge.direction,
        "weight": edge.weight,
        "relationship": edge.relationship,
        "computed_at": edge.computed_at,
    }


# --------------------------------------------------------------------------- #
# Qdrant points
# --------------------------------------------------------------------------- #


def qdrant_point(article: ArticleIn, vector: list[float]) -> dict[str, Any]:
    """Build a Qdrant upsert payload (point id, vector, filterable payload)."""
    return {
        "point_id": article.id,
        "vector": vector,
        "payload": {
            "article_id": article.id,
            "category": article.category,
            "subcategory": article.subcategory,
            "published_at": article.published_at,
            "economic_impact_score": article.economic_impact_score,
            "tags": list(article.tags),
        },
    }


# --------------------------------------------------------------------------- #
# Neo4j upsert payloads
# --------------------------------------------------------------------------- #


def neo4j_article_props(article: ArticleIn) -> dict[str, Any]:
    """Property map for a Neo4j ``(:Article {id})`` upsert."""
    return {
        "title": article.title,
        "summary": article.summary,
        "source": article.source,
        "url": article.url,
        "published_at": article.published_at,
        "category": article.category,
        "subcategory": article.subcategory,
        "economic_impact_score": article.economic_impact_score,
        "tags": list(article.tags),
    }


def neo4j_relates_to(edge: ScoredEdge) -> dict[str, Any]:
    """Kwargs for ``Neo4jStore.upsert_relates_to`` from a ``ScoredEdge``."""
    return {
        "source_article_id": edge.source_article_id,
        "target_article_id": edge.target_article_id,
        "semantic": edge.semantic,
        "entity_overlap": edge.entity_overlap,
        "causal": edge.causal,
        "direction": edge.direction,
        "weight": edge.weight,
        "computed_at": edge.computed_at,
    }


# --------------------------------------------------------------------------- #
# Frontend GraphData contract (lib/types.ts)
# --------------------------------------------------------------------------- #


def graph_node(article: ArticleIn) -> dict[str, Any]:
    """Build an ``EconomicNode`` for the frontend GraphData contract."""
    return {
        "id": article.id,
        "articleId": article.id,
        "label": _node_label(article.title),
        "category": article.category,
        "val": article.economic_impact_score,
        "color": category_color(article.category),
        "title": article.title,
        "summary": article.summary,
        "source": article.source,
        "economicImpactScore": article.economic_impact_score,
        "tags": list(article.tags),
        "url": article.url,
    }


def graph_link(edge: ScoredEdge) -> dict[str, Any]:
    """Build an ``EconomicEdge`` (``strength`` == composite weight)."""
    return {
        "source": edge.source_article_id,
        "target": edge.target_article_id,
        "strength": edge.weight,
        "relationship": edge.relationship,
    }


def build_graph_data(
    articles: list[ArticleIn],
    edges: list[ScoredEdge],
) -> dict[str, Any]:
    """Assemble the full ``GraphData`` payload ``{nodes, links}``.

    This is the exact JSON shape the Next.js frontend consumes; FEAT-003's
    ``GET /graph/query`` should return this.
    """
    return {
        "nodes": [graph_node(a) for a in articles],
        "links": [graph_link(e) for e in edges],
    }
