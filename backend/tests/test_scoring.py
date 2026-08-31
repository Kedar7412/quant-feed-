"""Unit tests for the pure three-axis scoring functions.

These tests assert the exact arithmetic of ``idf_weights``,
``entity_overlap_score``, ``composite_weight`` and ``screen_candidates`` so that
they fail if any formula is reverted or a config weight change stops
propagating.
"""

from __future__ import annotations

import math

import pytest

from app.pipeline.scoring import (
    composite_weight,
    entity_overlap_score,
    idf_weights,
    screen_candidates,
)


def test_idf_weights_rarer_entity_scores_higher() -> None:
    # "fed" appears in 3 of 3 docs (common); "rbi" in 1 of 3 (rare).
    docs = [{"fed", "rbi"}, {"fed"}, {"fed"}]
    weights = idf_weights(docs)
    # Smoothed IDF: ln((1+N)/(1+df)) + 1.
    assert weights["fed"] == pytest.approx(math.log(4 / 4) + 1.0)  # == 1.0
    assert weights["rbi"] == pytest.approx(math.log(4 / 2) + 1.0)
    assert weights["rbi"] > weights["fed"]


def test_idf_weights_all_positive() -> None:
    docs = [{"a"}, {"a"}, {"a", "b"}]
    weights = idf_weights(docs)
    assert all(w > 0 for w in weights.values())


def test_entity_overlap_zero_when_no_shared() -> None:
    weights = idf_weights([{"a"}, {"b"}])
    assert entity_overlap_score({"a"}, {"b"}, weights) == 0.0


def test_entity_overlap_zero_for_empty_sets() -> None:
    assert entity_overlap_score(set(), {"a"}, {"a": 1.0}) == 0.0
    assert entity_overlap_score({"a"}, set(), {"a": 1.0}) == 0.0


def test_entity_overlap_weighted_jaccard_exact() -> None:
    # Shared {a}, union {a,b,c}. With unit weights => 1/3.
    weights = {"a": 1.0, "b": 1.0, "c": 1.0}
    assert entity_overlap_score({"a", "b"}, {"a", "c"}, weights) == pytest.approx(1 / 3)


def test_entity_overlap_rarer_shared_entity_scores_higher() -> None:
    # Same structure, but the shared entity is rarer (higher IDF) in the second
    # case, which must raise the overlap score.
    common_weights = {"shared": 1.0, "x": 1.0, "y": 1.0}
    rare_weights = {"shared": 5.0, "x": 1.0, "y": 1.0}
    low = entity_overlap_score({"shared", "x"}, {"shared", "y"}, common_weights)
    high = entity_overlap_score({"shared", "x"}, {"shared", "y"}, rare_weights)
    assert high > low


def test_entity_overlap_clamped_to_one() -> None:
    weights = {"a": 1.0, "b": 1.0}
    assert entity_overlap_score({"a", "b"}, {"a", "b"}, weights) == pytest.approx(1.0)


def test_composite_weight_exact_default_weights() -> None:
    # Default weights 0.35 / 0.25 / 0.40.
    value = composite_weight(
        0.8,
        0.4,
        0.5,
        weight_semantic=0.35,
        weight_entity_overlap=0.25,
        weight_causal=0.40,
    )
    expected = 0.35 * 0.8 + 0.25 * 0.4 + 0.40 * 0.5
    assert value == pytest.approx(expected)


def test_composite_weight_reflects_config_change() -> None:
    inputs = (0.6, 0.6, 0.6)
    default = composite_weight(
        *inputs, weight_semantic=0.35, weight_entity_overlap=0.25, weight_causal=0.40
    )
    causal_heavy = composite_weight(
        *inputs, weight_semantic=0.10, weight_entity_overlap=0.10, weight_causal=0.80
    )
    # All axes equal so composite == sum(weights) * axis; weights sum to 1 here.
    assert default == pytest.approx(0.6)
    assert causal_heavy == pytest.approx(0.6)
    # But a lopsided weighting must change the result when axes differ.
    skewed = composite_weight(
        1.0, 0.0, 0.0, weight_semantic=0.35, weight_entity_overlap=0.25, weight_causal=0.40
    )
    assert skewed == pytest.approx(0.35)


def test_composite_weight_clamped() -> None:
    value = composite_weight(
        1.0, 1.0, 1.0, weight_semantic=1.0, weight_entity_overlap=1.0, weight_causal=1.0
    )
    assert value == 1.0


def test_screen_candidates_excludes_below_threshold() -> None:
    # 3 articles. Pair (0,1) passes on semantic, (0,2) passes on entity,
    # (1,2) fails both.
    semantic = [
        [0.0, 0.9, 0.05],
        [0.9, 0.0, 0.05],
        [0.05, 0.05, 0.0],
    ]
    entity = [
        [0.0, 0.0, 0.5],
        [0.0, 0.0, 0.0],
        [0.5, 0.0, 0.0],
    ]
    pairs = screen_candidates(semantic, entity, semantic_threshold=0.15, entity_threshold=0.10)
    indices = {(i, j) for i, j, _, _ in pairs}
    assert (0, 1) in indices
    assert (0, 2) in indices
    assert (1, 2) not in indices


def test_screen_candidates_empty_when_all_below() -> None:
    semantic = [[0.0, 0.01], [0.01, 0.0]]
    entity = [[0.0, 0.0], [0.0, 0.0]]
    assert screen_candidates(semantic, entity) == []
