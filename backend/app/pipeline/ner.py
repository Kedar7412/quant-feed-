"""Entity recognition + linking with custom finance labels.

Loads the spaCy model named by ``SPACY_MODEL`` (default ``en_core_web_sm``;
``en_core_web_trf`` selectable via env for prod) and layers a rule-based
``EntityRuler`` on top that adds the custom finance labels:

    TICKER, COMMODITY, CENTRAL_BANK, ASSET_CLASS, POLICY

The ruler is seeded with obvious lexicons (RBI/Fed/ECB -> CENTRAL_BANK; crude
oil/gold/gas -> COMMODITY; Sensex/Nifty/NASDAQ -> ASSET_CLASS; etc.). Extracted
entities are canonicalized (case-folded, whitespace-collapsed, mapped through an
alias table) and, where derivable, tagged with a ``Sector``.

The heavy spaCy load is cached; the pure ``canonicalize`` and lexicon helpers are
unit-testable without loading a model.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

from app.pipeline.clean import article_text
from app.pipeline.models import FINANCE_LABELS, LinkedEntity

if TYPE_CHECKING:
    from spacy.language import Language

# Seed lexicon: canonical entity name -> (label, list of surface patterns).
# The first pattern is treated as the canonical display form.
FINANCE_LEXICON: dict[str, tuple[str, list[str]]] = {
    "Reserve Bank of India": ("CENTRAL_BANK", ["RBI", "Reserve Bank of India"]),
    "Federal Reserve": ("CENTRAL_BANK", ["Fed", "Federal Reserve", "US Federal Reserve"]),
    "European Central Bank": ("CENTRAL_BANK", ["ECB", "European Central Bank"]),
    "Bank of England": ("CENTRAL_BANK", ["BoE", "Bank of England"]),
    "Bank of Japan": ("CENTRAL_BANK", ["BoJ", "Bank of Japan"]),
    "Crude Oil": ("COMMODITY", ["crude oil", "brent crude", "wti", "crude"]),
    "Gold": ("COMMODITY", ["gold"]),
    "Natural Gas": ("COMMODITY", ["natural gas", "gas"]),
    "Silver": ("COMMODITY", ["silver"]),
    "Sensex": ("ASSET_CLASS", ["sensex", "bse sensex"]),
    "Nifty": ("ASSET_CLASS", ["nifty", "nifty 50", "nifty50"]),
    "NASDAQ": ("ASSET_CLASS", ["nasdaq"]),
    "S&P 500": ("ASSET_CLASS", ["s&p 500", "s&p500", "sp500"]),
    "Dow Jones": ("ASSET_CLASS", ["dow jones", "dow"]),
    "Repo Rate": ("POLICY", ["repo rate", "reverse repo rate"]),
    "Interest Rate": ("POLICY", ["interest rate", "rate cut", "rate hike"]),
    "Monetary Policy": ("POLICY", ["monetary policy", "quantitative easing", "tapering"]),
    "Tariff": ("POLICY", ["tariff", "tariffs", "import duty"]),
}

# Map a finance label (or canonical entity) to an economic sector where derivable.
LABEL_TO_SECTOR: dict[str, str] = {
    "CENTRAL_BANK": "Monetary Policy",
    "COMMODITY": "Commodities",
    "ASSET_CLASS": "Equities",
    "POLICY": "Policy",
}

# spaCy built-in labels worth keeping as generic entities.
KEEP_SPACY_LABELS = frozenset({"ORG", "GPE", "PERSON", "MONEY", "PERCENT", "LAW", "NORP"})


def canonicalize(name: str) -> str:
    """Return a canonical key for an entity surface form.

    Case-folded and whitespace-collapsed so ``"the  RBI"`` and ``"THE RBI"``
    collapse to the same key. This is the join key used for entity overlap.
    """
    return " ".join(name.strip().lower().split())


@lru_cache
def _alias_index() -> dict[str, tuple[str, str]]:
    """Build a canonical-surface -> (canonical name, label) lookup."""
    index: dict[str, tuple[str, str]] = {}
    for canonical_name, (label, patterns) in FINANCE_LEXICON.items():
        for pattern in patterns:
            index[canonicalize(pattern)] = (canonical_name, label)
    return index


def _entity_ruler_patterns() -> list[dict[str, Any]]:
    """Build EntityRuler patterns from the finance lexicon."""
    patterns: list[dict[str, Any]] = []
    for _canonical_name, (label, surface_forms) in FINANCE_LEXICON.items():
        for surface in surface_forms:
            tokens = surface.split()
            patterns.append(
                {
                    "label": label,
                    "pattern": [{"LOWER": tok.lower()} for tok in tokens],
                }
            )
    return patterns


@lru_cache
def load_nlp(model_name: str) -> Language:
    """Load the spaCy model and attach the finance ``EntityRuler`` (cached)."""
    import spacy

    nlp = spacy.load(model_name)
    if "finance_entity_ruler" not in nlp.pipe_names:
        ruler = nlp.add_pipe(
            "entity_ruler",
            name="finance_entity_ruler",
            before="ner" if "ner" in nlp.pipe_names else None,
            config={"overwrite_ents": True},
        )
        ruler.add_patterns(_entity_ruler_patterns())  # type: ignore[attr-defined]
    return nlp


def _resolve(surface: str, label: str) -> LinkedEntity:
    """Canonicalize a surface form + label into a ``LinkedEntity``."""
    key = canonicalize(surface)
    alias = _alias_index().get(key)
    if alias is not None:
        canonical_name, canonical_label = alias
    else:
        canonical_name, canonical_label = surface.strip(), label
    sector = LABEL_TO_SECTOR.get(canonical_label)
    return LinkedEntity(
        name=surface.strip(),
        canonical=canonical_name,
        label=canonical_label,
        sector=sector,
    )


def extract_entities(title: str, summary: str, *, model_name: str) -> list[LinkedEntity]:
    """Run NER + the finance ruler over an article and return linked entities.

    Entities are de-duplicated by canonical name. Only finance labels and a
    curated set of useful spaCy labels are kept.
    """
    text = article_text(title, summary)
    nlp = load_nlp(model_name)
    doc = nlp(text)

    seen: dict[str, LinkedEntity] = {}
    for ent in doc.ents:
        if ent.label_ not in FINANCE_LABELS and ent.label_ not in KEEP_SPACY_LABELS:
            continue
        linked = _resolve(ent.text, ent.label_)
        key = canonicalize(linked.canonical)
        # Prefer a finance label over a generic spaCy label for the same entity.
        existing = seen.get(key)
        if existing is None or (
            existing.label not in FINANCE_LABELS and linked.label in FINANCE_LABELS
        ):
            seen[key] = linked
    return list(seen.values())
