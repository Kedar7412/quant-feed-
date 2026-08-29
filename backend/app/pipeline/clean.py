"""Text normalization used before NER and embedding.

Mirrors the frontend ``stripHtml`` helper (in ``lib/news/api-fetcher.ts``) and
adds whitespace collapsing plus optional lowercasing. Keep these functions pure
so they are trivially unit-testable.
"""

from __future__ import annotations

import re

_TAG_RE = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"\s+")


def strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace (mirrors frontend stripHtml)."""
    return _WS_RE.sub(" ", _TAG_RE.sub("", text)).strip()


def collapse_whitespace(text: str) -> str:
    """Collapse runs of whitespace into single spaces and trim."""
    return _WS_RE.sub(" ", text).strip()


def normalize_text(text: str, *, lowercase: bool = False) -> str:
    """Strip HTML, collapse whitespace, and optionally lowercase.

    Lowercasing is applied for keyword-style matching (tags, lexicon lookups),
    but NER and embedding should use the cased form to preserve entity casing.
    """
    cleaned = strip_html(text)
    return cleaned.lower() if lowercase else cleaned


def article_text(title: str, summary: str) -> str:
    """Combine an article's title and summary into a single cleaned string."""
    return collapse_whitespace(f"{strip_html(title)} {strip_html(summary)}")
