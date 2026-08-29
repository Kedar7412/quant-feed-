"""Tests for the entity-linking layer.

The pure ``canonicalize`` / lexicon tests run unconditionally. The tests that
load a spaCy model to assert the custom finance labels are skipped gracefully if
the model cannot be loaded in the test environment (per the FEAT-002 handoff),
so the unconditional scoring/schema-map coverage is never blocked.
"""

from __future__ import annotations

import pytest

from app.pipeline import ner
from app.pipeline.models import FINANCE_LABELS


def _spacy_available(model: str = "en_core_web_sm") -> bool:
    try:
        import spacy

        spacy.load(model)
        return True
    except Exception:  # noqa: BLE001 - any failure means "skip the live NER tests".
        return False


def test_canonicalize_is_case_and_space_insensitive() -> None:
    assert ner.canonicalize("  the  RBI ") == "the rbi"
    assert ner.canonicalize("Reserve Bank of India") == "reserve bank of india"


def test_alias_index_maps_surface_forms_to_canonical() -> None:
    index = ner._alias_index()
    assert index[ner.canonicalize("RBI")] == ("Reserve Bank of India", "CENTRAL_BANK")
    assert index[ner.canonicalize("Fed")] == ("Federal Reserve", "CENTRAL_BANK")
    assert index[ner.canonicalize("crude oil")] == ("Crude Oil", "COMMODITY")
    assert index[ner.canonicalize("nifty")] == ("Nifty", "ASSET_CLASS")


def test_label_to_sector_covers_finance_labels() -> None:
    assert ner.LABEL_TO_SECTOR["CENTRAL_BANK"] == "Monetary Policy"
    assert ner.LABEL_TO_SECTOR["COMMODITY"] == "Commodities"


pytestmark_reason = "en_core_web_sm not available in this environment"


@pytest.mark.skipif(not _spacy_available(), reason=pytestmark_reason)
def test_ner_emits_custom_finance_labels() -> None:
    entities = ner.extract_entities(
        "RBI raises repo rate as crude oil and gold rally",
        "The Fed and the Sensex react to monetary policy shifts.",
        model_name="en_core_web_sm",
    )
    labels = {e.label for e in entities}
    canonicals = {e.canonical for e in entities}

    # At least some of the custom finance labels must be present.
    assert labels & set(FINANCE_LABELS)
    assert "Reserve Bank of India" in canonicals  # "RBI" canonicalized.
    assert "CENTRAL_BANK" in labels
    # Commodity + policy seeds should surface too.
    assert "Crude Oil" in canonicals
    assert "COMMODITY" in labels


@pytest.mark.skipif(not _spacy_available(), reason=pytestmark_reason)
def test_ner_canonicalizes_and_dedupes() -> None:
    entities = ner.extract_entities(
        "RBI and the RBI discuss repo rate",
        "the rbi meets again",
        model_name="en_core_web_sm",
    )
    rbi = [e for e in entities if e.canonical == "Reserve Bank of India"]
    assert len(rbi) == 1
    assert rbi[0].sector == "Monetary Policy"
