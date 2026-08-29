"""Pydantic response models for the read API.

These mirror the frontend TypeScript contract in ``lib/types.ts``
(``EconomicNode``, ``EconomicEdge``, ``GraphData``, ``TopicCorrelation``) so the
JSON returned by ``GET /graph/query`` and ``GET /articles/{id}`` can be consumed
by the Next.js frontend unchanged, and so the contract is documented in OpenAPI.

Field names use the frontend's camelCase (``articleId``, ``economicImpactScore``,
``changeVelocity``, ``latestArticleDate``, ``dataSource``); models are configured
to populate/serialize by those aliases.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["domestic", "international", "economic", "political"]
DataSource = Literal["live", "cached", "sample"]


class EconomicNode(BaseModel):
    """A graph node, mirroring ``EconomicNode`` in ``lib/types.ts``."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    article_id: str = Field(serialization_alias="articleId", validation_alias="articleId")
    label: str
    category: Category
    val: float | None = None
    color: str | None = None
    title: str | None = None
    summary: str | None = None
    source: str | None = None
    economic_impact_score: float | None = Field(
        default=None,
        serialization_alias="economicImpactScore",
        validation_alias="economicImpactScore",
    )
    tags: list[str] | None = None
    url: str | None = None


class EconomicEdge(BaseModel):
    """A graph link, mirroring ``EconomicEdge`` in ``lib/types.ts``."""

    source: str
    target: str
    strength: float  # 0-1 composite weight
    relationship: str


class TopicCorrelation(BaseModel):
    """A topic-correlation cluster, mirroring ``TopicCorrelation``."""

    model_config = ConfigDict(populate_by_name=True)

    topic_id: str = Field(serialization_alias="topicId", validation_alias="topicId")
    keywords: list[str]
    article_ids: list[str] = Field(serialization_alias="articleIds", validation_alias="articleIds")
    change_velocity: float = Field(
        serialization_alias="changeVelocity", validation_alias="changeVelocity"
    )
    latest_article_date: str = Field(
        serialization_alias="latestArticleDate", validation_alias="latestArticleDate"
    )


class GraphQueryResponse(BaseModel):
    """Response for ``GET /graph/query``.

    Matches the shape ``app/api/graph/route.ts`` returns today:
    ``{ nodes, links, correlations, dataSource }``.
    """

    model_config = ConfigDict(populate_by_name=True)

    nodes: list[EconomicNode]
    links: list[EconomicEdge]
    correlations: list[TopicCorrelation]
    data_source: DataSource = Field(serialization_alias="dataSource", validation_alias="dataSource")


class LinkedEntityOut(BaseModel):
    """An entity linked to an article (from the Postgres join table)."""

    name: str
    label: str | None = None
    canonical: str | None = None


class ArticleNeighbor(BaseModel):
    """An immediate graph neighbor of an article via a RELATES_TO edge."""

    article_id: str = Field(serialization_alias="articleId", validation_alias="articleId")
    title: str | None = None
    category: Category | None = None
    direction: Literal["outgoing", "incoming"]
    strength: float | None = None
    relationship: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class ArticleDetailResponse(BaseModel):
    """Response for ``GET /articles/{id}``.

    The full article record plus its linked entities and immediate graph
    neighbors.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    summary: str | None = None
    source: str | None = None
    url: str | None = None
    published_at: str | None = Field(
        default=None, serialization_alias="publishedAt", validation_alias="publishedAt"
    )
    category: Category | None = None
    subcategory: str | None = None
    economic_impact_score: float | None = Field(
        default=None,
        serialization_alias="economicImpactScore",
        validation_alias="economicImpactScore",
    )
    tags: list[str] = Field(default_factory=list)
    is_live_data: bool = Field(
        default=False, serialization_alias="isLiveData", validation_alias="isLiveData"
    )
    entities: list[LinkedEntityOut] = Field(default_factory=list)
    neighbors: list[ArticleNeighbor] = Field(default_factory=list)
