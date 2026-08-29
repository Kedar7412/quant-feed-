"""Shared test fakes: in-memory stores, a fake embedder, a fake causal classifier."""

from __future__ import annotations

from typing import Any

from app.pipeline.models import CausalResult, Direction


class FakeEmbedder:
    """Deterministic tiny embedder keyed on presence of seed tokens.

    Produces small fixed-dim vectors so that articles sharing tokens are close
    in cosine space without any heavy model or network.
    """

    _VOCAB = ("rbi", "rate", "oil", "fed", "market", "inflation", "gold", "gdp")

    def __init__(self, dim: int = 8) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            lower = text.lower()
            vec = [1.0 if token in lower else 0.0 for token in self._VOCAB[: self._dim]]
            if not any(vec):
                vec[0] = 1.0
            vectors.append(vec)
        return vectors


class FakeCausalClassifier:
    """Returns a fixed relationship + confidence for every pair."""

    def __init__(self, confidence: float = 0.6, direction: Direction = "source->target") -> None:
        self._confidence = confidence
        self._direction: Direction = direction
        self.calls = 0

    def classify(
        self,
        source_title: str,
        source_summary: str,
        target_title: str,
        target_summary: str,
    ) -> CausalResult:
        self.calls += 1
        return CausalResult(
            relationship="related",
            direction=self._direction,
            confidence=self._confidence,
        )


class InMemoryGraphStore:
    """In-memory stand-in for Neo4jStore (MERGE-style idempotent upserts)."""

    def __init__(self) -> None:
        self.articles: dict[str, dict[str, Any]] = {}
        self.entities: dict[str, str | None] = {}
        self.mentions: set[tuple[str, str]] = set()
        self.relates_to: dict[tuple[str, str], dict[str, Any]] = {}

    def upsert_article(self, article_id: str, properties: dict[str, Any]) -> None:
        self.articles[article_id] = dict(properties)

    def upsert_entity(
        self, name: str, label: str | None = None, properties: dict[str, Any] | None = None
    ) -> None:
        self.entities[name] = label

    def link_mentions(self, article_id: str, entity_name: str) -> None:
        self.mentions.add((article_id, entity_name))

    def upsert_relates_to(
        self,
        source_article_id: str,
        target_article_id: str,
        **kwargs: Any,
    ) -> None:
        self.relates_to[(source_article_id, target_article_id)] = kwargs


class InMemoryVectorStore:
    """In-memory stand-in for QdrantStore."""

    def __init__(self) -> None:
        self.collection_ready = False
        self.points: dict[str | int, tuple[list[float], dict[str, Any] | None]] = {}

    def ensure_collection(self) -> None:
        self.collection_ready = True

    def upsert_vectors(
        self, point_id: str | int, vector: list[float], payload: dict[str, Any] | None = None
    ) -> None:
        self.points[point_id] = (vector, payload)


class InMemoryRelationalStore:
    """In-memory stand-in for PostgresRelationalStore."""

    def __init__(self) -> None:
        self.articles: dict[str, dict[str, Any]] = {}
        self.entities: dict[str, int] = {}
        self.entity_rows: dict[int, dict[str, Any]] = {}
        self.links: set[tuple[str, int]] = set()
        self.edges: dict[tuple[str, str], dict[str, Any]] = {}
        self._next_entity_id = 1

    def upsert_article(self, row: dict[str, Any]) -> None:
        self.articles[row["id"]] = dict(row)

    def upsert_entity(self, row: dict[str, Any]) -> int:
        name = row["name"]
        if name in self.entities:
            entity_id = self.entities[name]
        else:
            entity_id = self._next_entity_id
            self._next_entity_id += 1
            self.entities[name] = entity_id
        self.entity_rows[entity_id] = dict(row)
        return entity_id

    def link_article_entity(self, article_id: str, entity_id: int) -> None:
        self.links.add((article_id, entity_id))

    def upsert_edge(self, row: dict[str, Any]) -> None:
        key = (row["source_article_id"], row["target_article_id"])
        self.edges[key] = dict(row)
