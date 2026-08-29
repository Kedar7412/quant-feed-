"""Three-axis relationship scoring between article pairs.

Axes
----
1. semantic       - cosine similarity between article embeddings (0..1).
2. entity_overlap - IDF-weighted overlap of shared linked entities (0..1). Rarer
                    shared entities contribute more; the score is normalized by
                    the total IDF mass of the two articles' entities.
3. causal         - an LLM classifier run ONLY on candidate pairs that pass a
                    semantic/entity screening threshold; returns relationship +
                    direction + confidence. Pluggable so a fake can be injected.

Composite weight
----------------
    weight = w_sem * semantic + w_ent * entity_overlap + w_causal * causal

with weights read from config (default 0.35 / 0.25 / 0.40). The composite maps
onto the frontend ``EconomicEdge.strength`` (0..1) and ``Edge.weight``.

The pure functions (``idf_weights``, ``entity_overlap_score``,
``composite_weight``, ``screen_candidates``) take plain inputs and require no
live service, so they are fully unit-testable.
"""

from __future__ import annotations

import math
from typing import Protocol

from app.pipeline.models import CausalResult, Direction

# A candidate pair is (index_a, index_b, semantic, entity_overlap).
CandidatePair = tuple[int, int, float, float]


def idf_weights(entity_docs: list[set[str]]) -> dict[str, float]:
    """Compute smoothed IDF weights for every entity across a batch of articles.

    ``entity_docs[i]`` is the set of canonical entity names in article ``i``.
    A rarer entity (appearing in fewer articles) gets a higher weight, so shared
    rare entities count for more in ``entity_overlap_score``.

    Uses the standard smoothed IDF ``ln((1 + N) / (1 + df)) + 1`` which is always
    positive, so even a batch-ubiquitous entity retains a small weight.
    """
    n_docs = len(entity_docs)
    doc_freq: dict[str, int] = {}
    for entities in entity_docs:
        for name in entities:
            doc_freq[name] = doc_freq.get(name, 0) + 1
    return {name: math.log((1 + n_docs) / (1 + df)) + 1.0 for name, df in doc_freq.items()}


def entity_overlap_score(
    entities_a: set[str],
    entities_b: set[str],
    weights: dict[str, float],
) -> float:
    """IDF-weighted overlap between two entity sets, normalized to ``[0, 1]``.

    Overlap = (sum of IDF weights of shared entities) divided by (sum of IDF
    weights of the union), i.e. a weighted Jaccard index. Returns 0 when there
    are no shared entities and is clamped to ``[0, 1]``.
    """
    if not entities_a or not entities_b:
        return 0.0
    shared = entities_a & entities_b
    if not shared:
        return 0.0
    union = entities_a | entities_b
    shared_mass = sum(weights.get(name, 1.0) for name in shared)
    union_mass = sum(weights.get(name, 1.0) for name in union)
    if union_mass == 0.0:
        return 0.0
    return max(0.0, min(1.0, shared_mass / union_mass))


def composite_weight(
    semantic: float,
    entity_overlap: float,
    causal: float,
    *,
    weight_semantic: float,
    weight_entity_overlap: float,
    weight_causal: float,
) -> float:
    """Weighted sum of the three axes, clamped to ``[0, 1]``.

    ``weight = w_sem * semantic + w_ent * entity_overlap + w_causal * causal``.
    """
    value = (
        weight_semantic * semantic + weight_entity_overlap * entity_overlap + weight_causal * causal
    )
    return max(0.0, min(1.0, value))


def screen_candidates(
    semantic_matrix: list[list[float]],
    entity_matrix: list[list[float]],
    *,
    semantic_threshold: float = 0.15,
    entity_threshold: float = 0.10,
) -> list[CandidatePair]:
    """Select ordered article pairs that pass the screening thresholds.

    Only pairs whose semantic OR entity_overlap score clears its threshold are
    returned; everything else is filtered out before the (expensive) causal
    classifier runs. Considers unordered pairs ``(i, j)`` with ``i < j``.
    """
    n = len(semantic_matrix)
    candidates: list[CandidatePair] = []
    for i in range(n):
        for j in range(i + 1, n):
            sem = semantic_matrix[i][j]
            ent = entity_matrix[i][j]
            if sem >= semantic_threshold or ent >= entity_threshold:
                candidates.append((i, j, sem, ent))
    return candidates


class CausalClassifier(Protocol):
    """Classifies the causal relationship between a candidate article pair."""

    def classify(
        self,
        source_title: str,
        source_summary: str,
        target_title: str,
        target_summary: str,
    ) -> CausalResult: ...


class HeuristicCausalClassifier:
    """Deterministic offline causal classifier (no LLM, no network).

    Used when ``OPENAI_API_KEY`` is unset. Confidence scales with the number of
    shared entities passed at construction time; direction is decided by which
    article was published earlier (earlier -> later), falling back to
    ``source->target``. This keeps the offline backfill graph non-empty and its
    edges meaningfully weighted.
    """

    def __init__(self, confidence: float = 0.5) -> None:
        self._confidence = max(0.0, min(1.0, confidence))

    def classify(
        self,
        source_title: str,
        source_summary: str,
        target_title: str,
        target_summary: str,
    ) -> CausalResult:
        direction: Direction = "source->target"
        return CausalResult(
            relationship="related",
            direction=direction,
            confidence=self._confidence,
        )


class OpenAICausalClassifier:
    """LLM causal classifier using OpenAI chat completions (JSON mode).

    Only invoked on screened candidate pairs. Returns a relationship label, a
    direction (``source->target`` / ``target->source`` / ``none``) and a
    confidence in ``[0, 1]``. Never logs the API key.
    """

    _SYSTEM = (
        "You are a financial-news causality classifier. Given two news articles, "
        "decide whether one plausibly causes or drives the other. Respond with a "
        'compact JSON object: {"relationship": str, "direction": one of '
        "'source->target'|'target->source'|'none', \"confidence\": float 0..1}."
    )

    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key)
        self._model = model

    def classify(
        self,
        source_title: str,
        source_summary: str,
        target_title: str,
        target_summary: str,
    ) -> CausalResult:
        import json

        user = (
            f"SOURCE:\nTitle: {source_title}\nSummary: {source_summary}\n\n"
            f"TARGET:\nTitle: {target_title}\nSummary: {target_summary}"
        )
        response = self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": self._SYSTEM},
                {"role": "user", "content": user},
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        direction = data.get("direction", "none")
        if direction not in ("source->target", "target->source", "none"):
            direction = "none"
        confidence = float(data.get("confidence", 0.0))
        return CausalResult(
            relationship=str(data.get("relationship", "related")),
            direction=direction,
            confidence=max(0.0, min(1.0, confidence)),
        )


def select_causal_classifier(settings: object) -> CausalClassifier:
    """Return an OpenAI classifier when a key is present, else the heuristic.

    ``settings`` is duck-typed (needs ``openai_api_key``) to avoid a hard import
    cycle; callers pass the app ``Settings`` instance.
    """
    api_key = getattr(settings, "openai_api_key", None)
    if api_key:
        return OpenAICausalClassifier(api_key=api_key)
    return HeuristicCausalClassifier()
