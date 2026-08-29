"""End-to-end ingestion orchestrator.

``run(articles, ...)`` performs the full pipeline:

    clean -> NER / entity-link -> embed -> upsert vectors to Qdrant
          -> screen candidate pairs -> score three axes -> composite weight
          -> persist articles + entities + edges to Postgres and Neo4j.

All external dependencies (embedder, causal classifier, and the three stores)
are injected, so the orchestrator can be exercised with fakes / in-memory stores
in tests with no live services. Upserts are idempotent (MERGE-style), so a second
run over the same articles does not duplicate nodes or edges.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Protocol

from app.pipeline import schema_map, scoring
from app.pipeline.clean import article_text
from app.pipeline.embeddings import Embedder, cosine_similarity
from app.pipeline.models import ArticleIn, LinkedEntity, ScoredEdge
from app.pipeline.ner import extract_entities
from app.pipeline.scoring import CausalClassifier

if TYPE_CHECKING:
    from app.config import Settings


class GraphStore(Protocol):
    """Subset of ``Neo4jStore`` the orchestrator needs (fakeable)."""

    def upsert_article(self, article_id: str, properties: dict[str, object]) -> None: ...
    def upsert_entity(
        self, name: str, label: str | None = ..., properties: dict[str, object] | None = ...
    ) -> None: ...
    def link_mentions(self, article_id: str, entity_name: str) -> None: ...
    def upsert_relates_to(
        self,
        source_article_id: str,
        target_article_id: str,
        *,
        semantic: float,
        entity_overlap: float,
        causal: float,
        direction: str,
        weight: float,
        computed_at: datetime | None = ...,
    ) -> None: ...


class VectorStore(Protocol):
    """Subset of ``QdrantStore`` the orchestrator needs (fakeable)."""

    def ensure_collection(self) -> None: ...
    def upsert_vectors(
        self, point_id: str | int, vector: list[float], payload: dict[str, object] | None = ...
    ) -> None: ...


class RelationalStore(Protocol):
    """Persist articles/entities/edges to Postgres (fakeable)."""

    def upsert_article(self, row: dict[str, object]) -> None: ...
    def upsert_entity(self, row: dict[str, object]) -> int: ...
    def link_article_entity(self, article_id: str, entity_id: int) -> None: ...
    def upsert_edge(self, row: dict[str, object]) -> None: ...


@dataclass
class RunResult:
    """Summary counts returned by ``run`` (used by backfill + tests)."""

    articles: int = 0
    entities: int = 0
    edges: int = 0
    vectors: int = 0
    candidates: int = 0
    entities_by_article: dict[str, list[LinkedEntity]] = field(default_factory=dict)
    scored_edges: list[ScoredEdge] = field(default_factory=list)


def _entity_sets(entities_by_article: list[list[LinkedEntity]]) -> list[set[str]]:
    return [{e.canonical for e in ents} for ents in entities_by_article]


def run(
    articles: list[ArticleIn],
    *,
    settings: Settings,
    embedder: Embedder,
    causal_classifier: CausalClassifier,
    graph_store: GraphStore,
    vector_store: VectorStore,
    relational_store: RelationalStore,
    spacy_model: str | None = None,
    semantic_threshold: float = 0.15,
    entity_threshold: float = 0.10,
) -> RunResult:
    """Run the full ingestion pipeline over ``articles`` and persist results."""
    result = RunResult()
    if not articles:
        return result

    model_name = spacy_model or settings.spacy_model

    # 1. Clean + NER / entity-link.
    per_article_entities: list[list[LinkedEntity]] = [
        extract_entities(a.title, a.summary, model_name=model_name) for a in articles
    ]

    # 2. Embed cleaned article text.
    texts = [article_text(a.title, a.summary) for a in articles]
    vectors = embedder.embed(texts)

    # 3. Persist articles + entities + vectors (idempotent upserts).
    vector_store.ensure_collection()
    for article, entities, vector in zip(articles, per_article_entities, vectors, strict=True):
        relational_store.upsert_article(schema_map.article_row(article))
        graph_store.upsert_article(article.id, schema_map.neo4j_article_props(article))
        point = schema_map.qdrant_point(article, vector)
        vector_store.upsert_vectors(point["point_id"], point["vector"], point["payload"])
        result.vectors += 1

        for entity in entities:
            entity_id = relational_store.upsert_entity(schema_map.entity_row(entity))
            relational_store.link_article_entity(article.id, entity_id)
            graph_store.upsert_entity(entity.canonical, entity.label)
            graph_store.link_mentions(article.id, entity.canonical)
        result.entities += len(entities)
        result.entities_by_article[article.id] = entities

    result.articles = len(articles)

    # 4. Build semantic + entity-overlap matrices.
    n = len(articles)
    entity_sets = _entity_sets(per_article_entities)
    weights = scoring.idf_weights(entity_sets)

    semantic_matrix = [[0.0] * n for _ in range(n)]
    entity_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            sem = cosine_similarity(vectors[i], vectors[j])
            ent = scoring.entity_overlap_score(entity_sets[i], entity_sets[j], weights)
            semantic_matrix[i][j] = semantic_matrix[j][i] = sem
            entity_matrix[i][j] = entity_matrix[j][i] = ent

    # 5. Screen candidate pairs, then run the causal classifier on survivors.
    candidates = scoring.screen_candidates(
        semantic_matrix,
        entity_matrix,
        semantic_threshold=semantic_threshold,
        entity_threshold=entity_threshold,
    )
    result.candidates = len(candidates)

    for i, j, sem, ent in candidates:
        src, tgt = articles[i], articles[j]
        causal = causal_classifier.classify(src.title, src.summary, tgt.title, tgt.summary)
        # Orient the edge per the classifier's direction.
        if causal.direction == "target->source":
            src, tgt = articles[j], articles[i]
        weight = scoring.composite_weight(
            sem,
            ent,
            causal.confidence,
            weight_semantic=settings.weight_semantic,
            weight_entity_overlap=settings.weight_entity_overlap,
            weight_causal=settings.weight_causal,
        )
        edge = ScoredEdge(
            source_article_id=src.id,
            target_article_id=tgt.id,
            semantic=sem,
            entity_overlap=ent,
            causal=causal.confidence,
            direction=causal.direction,
            weight=weight,
            relationship=causal.relationship,
        )
        relational_store.upsert_edge(schema_map.edge_row(edge))
        graph_store.upsert_relates_to(**schema_map.neo4j_relates_to(edge))
        result.scored_edges.append(edge)

    result.edges = len(result.scored_edges)
    return result
