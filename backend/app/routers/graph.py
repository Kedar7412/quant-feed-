"""GET /graph/query — serve the persisted graph as the frontend GraphData contract.

Reads articles + relationships from the persisted backbone (Postgres
system-of-record via ``GraphReadStore``), applies the query filters
(category/sector, startDate, endDate, sentiment, entity), prunes dangling links,
computes topic correlations, and returns ``{ nodes, links, correlations,
dataSource }`` in the exact shape ``app/api/graph/route.ts`` returns today.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.routers.deps import get_read_store
from app.schemas import GraphQueryResponse
from app.services.graph_service import GraphReadStore, build_graph_query_response

router = APIRouter(tags=["graph"])


@router.get("/graph/query", response_model=GraphQueryResponse)
def graph_query(
    store: Annotated[GraphReadStore, Depends(get_read_store)],
    category: Annotated[
        str | None,
        Query(description="Filter by category/sector (e.g. 'economic'). 'all' is a no-op."),
    ] = None,
    sector: Annotated[str | None, Query(description="Alias for category.")] = None,
    startDate: Annotated[str | None, Query(description="ISO date lower bound (inclusive).")] = None,
    endDate: Annotated[str | None, Query(description="ISO date upper bound (inclusive).")] = None,
    sentiment: Annotated[
        str | None,
        Query(description="positive/negative/neutral (derived from economicImpactScore)."),
    ] = None,
    entity: Annotated[
        str | None, Query(description="Keep articles mentioning this entity (case-insensitive).")
    ] = None,
) -> GraphQueryResponse:
    """Return the filtered graph plus correlations and the data source."""
    articles = store.list_articles()
    edges = store.list_edges()

    entities_by_article: dict[str, list[str]] = {}
    if entity:
        for article in articles:
            names = [e["name"] for e in store.get_entities_for_article(article.id)]
            entities_by_article[article.id] = names

    payload = build_graph_query_response(
        articles,
        edges,
        category=category or sector,
        start_date=startDate,
        end_date=endDate,
        sentiment=sentiment,
        entity=entity,
        entities_by_article=entities_by_article,
        data_source="live",
    )
    return GraphQueryResponse.model_validate(payload)
