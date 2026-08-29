"""GET /articles/{id} — full article record + linked entities + neighbors.

Reads the article from the Postgres system-of-record, its linked entities via
the ``ArticleEntity`` join, and its immediate graph neighbors from the
``RELATES_TO``/``Edge`` relationships. Returns 404 when the id is absent.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.routers.deps import get_read_store
from app.schemas import ArticleDetailResponse, ArticleNeighbor, LinkedEntityOut
from app.services.graph_service import GraphReadStore

router = APIRouter(tags=["articles"])


@router.get("/articles/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: str,
    store: Annotated[GraphReadStore, Depends(get_read_store)],
) -> ArticleDetailResponse:
    """Return the article, its linked entities, and immediate graph neighbors."""
    article = store.get_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail=f"Article '{article_id}' not found")

    entities = [
        LinkedEntityOut(name=e["name"], label=e.get("label"), canonical=e.get("canonical"))
        for e in store.get_entities_for_article(article_id)
    ]

    neighbors: list[ArticleNeighbor] = []
    for edge in store.get_edges_for_article(article_id):
        if edge.source_article_id == article_id:
            neighbor_id = edge.target_article_id
            direction = "outgoing"
        else:
            neighbor_id = edge.source_article_id
            direction = "incoming"
        neighbor_article = store.get_article(neighbor_id)
        neighbors.append(
            ArticleNeighbor(
                article_id=neighbor_id,
                title=neighbor_article.title if neighbor_article else None,
                category=neighbor_article.category if neighbor_article else None,
                direction=direction,
                strength=edge.weight,
                relationship=edge.relationship,
            )
        )

    return ArticleDetailResponse(
        id=article.id,
        title=article.title,
        summary=article.summary,
        source=article.source,
        url=article.url,
        published_at=article.published_at,
        category=article.category,
        subcategory=article.subcategory,
        economic_impact_score=article.economic_impact_score,
        tags=list(article.tags),
        is_live_data=article.is_live_data,
        entities=entities,
        neighbors=neighbors,
    )
