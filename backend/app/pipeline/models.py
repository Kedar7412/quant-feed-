"""Typed data structures shared across the ingestion pipeline.

``ArticleIn`` mirrors the frontend ``NewsArticle`` shape in ``lib/types.ts`` so
the Python pipeline and the Next.js frontend agree on the article contract.
``LinkedEntity`` is the NER output, and ``ScoredEdge`` captures a scored
relationship between two articles.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["domestic", "international", "economic", "political"]
Subcategory = Literal["Indian Local", "Indian National", "International"]

# Custom finance NER labels applied on top of the base spaCy model.
FINANCE_LABELS = ("TICKER", "COMMODITY", "CENTRAL_BANK", "ASSET_CLASS", "POLICY")

# Direction of a causal relationship between a (source, target) article pair.
Direction = Literal["source->target", "target->source", "none"]


class ArticleIn(BaseModel):
    """A normalized news article, matching the frontend ``NewsArticle`` fields."""

    id: str
    title: str
    summary: str = ""
    source: str = ""
    url: str = ""
    published_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    category: Category = "economic"
    subcategory: Subcategory = "Indian National"
    economic_impact_score: float = 5.0
    tags: list[str] = Field(default_factory=list)
    is_live_data: bool = False


class LinkedEntity(BaseModel):
    """An entity linked to an article, with a canonicalized name and label."""

    name: str
    canonical: str
    label: str
    sector: str | None = None


class CausalResult(BaseModel):
    """Result of the LLM causal classifier for one candidate article pair."""

    relationship: str
    direction: Direction
    confidence: float


class ScoredEdge(BaseModel):
    """A scored relationship between two articles (source -> target)."""

    source_article_id: str
    target_article_id: str
    semantic: float
    entity_overlap: float
    causal: float
    direction: Direction
    weight: float
    relationship: str
    computed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
