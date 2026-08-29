"""Read-side graph service.

Serves the persisted backbone (Postgres system-of-record, with Neo4j
``RELATES_TO`` as an equivalent edge source) as the exact ``GraphData`` contract
the Next.js frontend already consumes.

Design
------
- ``GraphReadStore`` is a ``Protocol`` describing the reads the API needs. This
  lets tests inject an in-memory fake seeded with a small fixture graph without
  a live Postgres/Neo4j.
- ``PostgresReadStore`` is the concrete implementation over a SQLAlchemy
  ``Session`` (the FEAT-001 ``Article``/``Entity``/``ArticleEntity``/``Edge``
  models). It rehydrates ``ArticleIn`` from ``Article`` rows and ``ScoredEdge``
  from ``Edge`` rows.
- The filtering + assembly logic (``build_graph_query_response``) is a pure
  function operating on plain ``ArticleIn``/``ScoredEdge`` lists so filters are
  unit-testable and each filter measurably narrows the node/link set (pruning
  dangling links, mirroring ``app/api/graph/route.ts``).

Correlations are computed analogously to ``lib/freshness/topic-tracker.ts``
(Jaccard union-find over article keyword fingerprints).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pipeline import schema_map
from app.pipeline.models import ArticleIn, ScoredEdge
from app.services.correlations import build_topic_correlations
from app.stores.postgres import Article, ArticleEntity, Edge, Entity


class GraphReadStore(Protocol):
    """Reads the API layer needs from the persisted backbone."""

    def list_articles(self) -> list[ArticleIn]:
        """Return every persisted article as an ``ArticleIn``."""
        ...

    def list_edges(self) -> list[ScoredEdge]:
        """Return every persisted relationship as a ``ScoredEdge``."""
        ...

    def get_article(self, article_id: str) -> ArticleIn | None:
        """Return a single article by id, or ``None`` when absent."""
        ...

    def get_entities_for_article(self, article_id: str) -> list[dict[str, Any]]:
        """Return linked entities ({name,label,canonical}) for an article."""
        ...

    def get_edges_for_article(self, article_id: str) -> list[ScoredEdge]:
        """Return edges where the article is source or target."""
        ...


def _article_from_row(row: Article) -> ArticleIn:
    """Rehydrate an ``ArticleIn`` from a Postgres ``Article`` row.

    ``published_at`` is stored as a timestamp in Postgres but ``ArticleIn``
    carries it as an ISO string (matching the frontend ``publishedAt``).
    """
    published = row.published_at
    published_str = published.isoformat() if isinstance(published, datetime) else (published or "")
    return ArticleIn(
        id=row.id,
        title=row.title,
        summary=row.summary or "",
        source=row.source or "",
        url=row.url or "",
        published_at=published_str or datetime.now().astimezone().isoformat(),
        category=row.category or "economic",
        subcategory=row.subcategory or "Indian National",
        economic_impact_score=(
            row.economic_impact_score if row.economic_impact_score is not None else 5.0
        ),
        tags=list(row.tags or []),
        is_live_data=bool(row.is_live_data),
    )


def _edge_from_row(row: Edge) -> ScoredEdge:
    """Rehydrate a ``ScoredEdge`` from a Postgres ``Edge`` row."""
    return ScoredEdge(
        source_article_id=row.source_article_id,
        target_article_id=row.target_article_id,
        semantic=row.semantic if row.semantic is not None else 0.0,
        entity_overlap=row.entity_overlap if row.entity_overlap is not None else 0.0,
        causal=row.causal if row.causal is not None else 0.0,
        direction=row.direction or "none",
        weight=row.weight if row.weight is not None else 0.0,
        relationship=row.relationship or "related",
        computed_at=row.computed_at or datetime.now().astimezone(),
    )


class PostgresReadStore:
    """Concrete ``GraphReadStore`` over a SQLAlchemy ``Session``."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list_articles(self) -> list[ArticleIn]:
        rows = self._session.execute(select(Article)).scalars().all()
        return [_article_from_row(row) for row in rows]

    def list_edges(self) -> list[ScoredEdge]:
        rows = self._session.execute(select(Edge)).scalars().all()
        return [_edge_from_row(row) for row in rows]

    def get_article(self, article_id: str) -> ArticleIn | None:
        row = self._session.get(Article, article_id)
        return _article_from_row(row) if row is not None else None

    def get_entities_for_article(self, article_id: str) -> list[dict[str, Any]]:
        stmt = (
            select(Entity)
            .join(ArticleEntity, ArticleEntity.entity_id == Entity.id)
            .where(ArticleEntity.article_id == article_id)
        )
        rows = self._session.execute(stmt).scalars().all()
        return [{"name": e.name, "label": e.label, "canonical": e.canonical} for e in rows]

    def get_edges_for_article(self, article_id: str) -> list[ScoredEdge]:
        stmt = select(Edge).where(
            (Edge.source_article_id == article_id) | (Edge.target_article_id == article_id)
        )
        rows = self._session.execute(stmt).scalars().all()
        return [_edge_from_row(row) for row in rows]


# --------------------------------------------------------------------------- #
# Pure filtering + assembly
# --------------------------------------------------------------------------- #


def _parse_date(value: str) -> datetime | None:
    """Best-effort ISO date parse; returns ``None`` when unparseable."""
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _as_naive(dt: datetime) -> datetime:
    """Drop tzinfo so naive/aware datetimes compare without raising."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


def filter_articles(
    articles: list[ArticleIn],
    *,
    category: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sentiment: str | None = None,
    entity: str | None = None,
    entities_by_article: dict[str, list[str]] | None = None,
) -> list[ArticleIn]:
    """Apply the read filters to a list of articles.

    - ``category``/``sector``: keep articles whose category matches (``all`` /
      ``None`` is a no-op).
    - ``start_date``/``end_date``: keep articles whose ``published_at`` falls in
      the inclusive range.
    - ``sentiment`` (``positive``/``negative``/``neutral``): derived from the
      article's ``economic_impact_score`` (>=7 positive, <=3 negative, else
      neutral) so the filter measurably narrows the set without a dedicated
      column.
    - ``entity``: keep articles that mention the given entity (case-insensitive
      match against the article's linked entities in ``entities_by_article``).
    """
    entities_by_article = entities_by_article or {}
    start = _parse_date(start_date) if start_date else None
    end = _parse_date(end_date) if end_date else None
    entity_norm = entity.strip().lower() if entity else None

    result: list[ArticleIn] = []
    for article in articles:
        if category and category != "all" and article.category != category:
            continue

        if start is not None or end is not None:
            pub = _parse_date(article.published_at)
            if pub is not None:
                pub_cmp = _as_naive(pub)
                if start is not None and pub_cmp < _as_naive(start):
                    continue
                if end is not None and pub_cmp > _as_naive(end):
                    continue

        if sentiment:
            score = article.economic_impact_score
            derived = "positive" if score >= 7 else "negative" if score <= 3 else "neutral"
            if derived != sentiment:
                continue

        if entity_norm:
            linked = [e.lower() for e in entities_by_article.get(article.id, [])]
            if entity_norm not in linked and not any(entity_norm in name for name in linked):
                continue

        result.append(article)

    return result


def prune_links(edges: list[ScoredEdge], node_ids: set[str]) -> list[ScoredEdge]:
    """Drop edges whose endpoints are not both in ``node_ids``.

    Mirrors the dangling-link pruning in ``app/api/graph/route.ts``.
    """
    return [e for e in edges if e.source_article_id in node_ids and e.target_article_id in node_ids]


def build_graph_query_response(
    articles: list[ArticleIn],
    edges: list[ScoredEdge],
    *,
    category: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sentiment: str | None = None,
    entity: str | None = None,
    entities_by_article: dict[str, list[str]] | None = None,
    data_source: str = "live",
) -> dict[str, Any]:
    """Build the ``{ nodes, links, correlations, dataSource }`` payload.

    Reuses ``schema_map.build_graph_data`` for the node/link contract, applies
    the filters, prunes dangling links, and computes topic correlations from the
    surviving articles.
    """
    filtered = filter_articles(
        articles,
        category=category,
        start_date=start_date,
        end_date=end_date,
        sentiment=sentiment,
        entity=entity,
        entities_by_article=entities_by_article,
    )
    node_ids = {a.id for a in filtered}
    kept_edges = prune_links(edges, node_ids)

    graph_data = schema_map.build_graph_data(filtered, kept_edges)
    correlations = build_topic_correlations(filtered)

    return {
        "nodes": graph_data["nodes"],
        "links": graph_data["links"],
        "correlations": correlations,
        "dataSource": data_source,
    }
