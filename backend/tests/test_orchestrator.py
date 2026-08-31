"""End-to-end orchestrator test using fakes + in-memory stores.

Runs ``orchestrator.run`` over a small fixture article set with a fake embedder,
a fake causal classifier and in-memory stores, asserting nodes/edges are
upserted and that a second run is idempotent (no duplicate nodes/edges).
"""

from __future__ import annotations

from app.config import Settings
from app.pipeline import orchestrator
from app.pipeline.models import ArticleIn
from tests.conftest import (
    FakeCausalClassifier,
    FakeEmbedder,
    InMemoryGraphStore,
    InMemoryRelationalStore,
    InMemoryVectorStore,
)

SPACY_MODEL = "en_core_web_sm"


def _fixture_articles() -> list[ArticleIn]:
    return [
        ArticleIn(
            id="a1",
            title="RBI holds repo rate to fight inflation",
            summary="The Reserve Bank of India kept the repo rate steady as inflation stays high.",
            category="economic",
        ),
        ArticleIn(
            id="a2",
            title="Inflation pressures push RBI rate decision",
            summary="RBI weighs interest rate moves amid inflation and GDP data.",
            category="economic",
        ),
        ArticleIn(
            id="a3",
            title="Crude oil prices rally on supply cuts",
            summary="Global crude oil and gold prices rally as supply tightens.",
            category="international",
        ),
    ]


def _run(
    articles: list[ArticleIn],
    graph: InMemoryGraphStore,
    vector: InMemoryVectorStore,
    relational: InMemoryRelationalStore,
    classifier: FakeCausalClassifier,
) -> orchestrator.RunResult:
    settings = Settings(openai_api_key=None)
    return orchestrator.run(
        articles,
        settings=settings,
        embedder=FakeEmbedder(),
        causal_classifier=classifier,
        graph_store=graph,
        vector_store=vector,
        relational_store=relational,
        spacy_model=SPACY_MODEL,
    )


def test_orchestrator_populates_all_stores() -> None:
    articles = _fixture_articles()
    graph, vector, relational = (
        InMemoryGraphStore(),
        InMemoryVectorStore(),
        InMemoryRelationalStore(),
    )
    classifier = FakeCausalClassifier()

    result = _run(articles, graph, vector, relational, classifier)

    # Articles + vectors written for every input.
    assert result.articles == 3
    assert result.vectors == 3
    assert len(graph.articles) == 3
    assert len(relational.articles) == 3
    assert vector.collection_ready is True
    assert len(vector.points) == 3

    # NER produced entities (RBI etc.) that got linked.
    assert result.entities > 0
    assert len(relational.links) > 0
    assert len(graph.mentions) > 0

    # The two inflation/RBI articles should relate; at least one edge exists.
    assert result.edges >= 1
    assert len(graph.relates_to) == result.edges
    assert len(relational.edges) == result.edges

    # Composite weight is in [0, 1] and combines the axes.
    for edge in result.scored_edges:
        assert 0.0 <= edge.weight <= 1.0
        assert edge.relationship == "related"


def test_orchestrator_is_idempotent() -> None:
    articles = _fixture_articles()
    graph, vector, relational = (
        InMemoryGraphStore(),
        InMemoryVectorStore(),
        InMemoryRelationalStore(),
    )

    first = _run(articles, graph, vector, relational, FakeCausalClassifier())
    articles_after_first = dict(graph.articles)
    edges_after_first = dict(graph.relates_to)
    entities_after_first = dict(relational.entities)

    second = _run(articles, graph, vector, relational, FakeCausalClassifier())

    # Counts are stable and no duplicate nodes/edges were created.
    assert second.articles == first.articles
    assert second.edges == first.edges
    assert graph.articles.keys() == articles_after_first.keys()
    assert graph.relates_to.keys() == edges_after_first.keys()
    assert relational.entities == entities_after_first
    assert len(vector.points) == 3


def test_orchestrator_empty_input() -> None:
    graph, vector, relational = (
        InMemoryGraphStore(),
        InMemoryVectorStore(),
        InMemoryRelationalStore(),
    )
    result = _run([], graph, vector, relational, FakeCausalClassifier())
    assert result.articles == 0
    assert result.edges == 0
    assert len(graph.articles) == 0
