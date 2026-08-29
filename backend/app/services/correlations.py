"""Topic-correlation clustering.

A Python port of ``lib/freshness/topic-tracker.ts``: groups articles into
clusters by shared keyword fingerprints using Jaccard similarity (union-find,
threshold 0.3), computes change velocity, and returns ``TopicCorrelation`` dicts
in the frontend's camelCase shape (``topicId``, ``keywords``, ``articleIds``,
``changeVelocity``, ``latestArticleDate``).
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from app.pipeline.models import ArticleIn

_STOP_WORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "are",
        "but",
        "not",
        "you",
        "all",
        "can",
        "her",
        "was",
        "one",
        "our",
        "out",
        "has",
        "had",
        "its",
        "with",
        "from",
        "this",
        "that",
        "will",
        "been",
        "have",
        "they",
        "more",
        "over",
        "than",
        "into",
        "also",
    }
)

_THRESHOLD = 0.3
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")


def extract_topic_fingerprint(article: ArticleIn) -> list[str]:
    """Normalized keyword fingerprint: title words (3+ chars) + tags."""
    cleaned = _NON_ALNUM.sub("", article.title.lower())
    title_words = [w for w in cleaned.split() if len(w) >= 3 and w not in _STOP_WORDS]
    tag_words = [t.lower().strip() for t in (article.tags or [])]
    seen: dict[str, None] = {}
    for word in [*title_words, *tag_words]:
        seen.setdefault(word, None)
    return list(seen.keys())


def compute_topic_overlap(a: ArticleIn, b: ArticleIn) -> float:
    """Jaccard similarity between two articles' fingerprints (0..1)."""
    fp_a = set(extract_topic_fingerprint(a))
    fp_b = set(extract_topic_fingerprint(b))
    if not fp_a and not fp_b:
        return 0.0
    intersection = len(fp_a & fp_b)
    union = len(fp_a) + len(fp_b) - intersection
    if union == 0:
        return 0.0
    return intersection / union


def _parse_dt(value: str) -> datetime | None:
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def compute_change_velocity(articles: list[ArticleIn]) -> float:
    """Weighted fraction of articles published in the last 24h/48h (0..1)."""
    if len(articles) <= 1:
        return 0.0
    now = datetime.now(UTC)
    recent_24h = 0
    recent_48h = 0
    for article in articles:
        pub = _parse_dt(article.published_at)
        if pub is None:
            continue
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=UTC)
        age_hours = (now - pub).total_seconds() / 3600.0
        if age_hours <= 24:
            recent_24h += 1
        if age_hours <= 48:
            recent_48h += 1
    total = len(articles)
    velocity = (recent_24h / total) * 0.6 + (recent_48h / total) * 0.4
    return min(1.0, velocity)


def build_topic_correlations(articles: list[ArticleIn]) -> list[dict[str, Any]]:
    """Cluster articles into topic correlations (2+ articles per cluster)."""
    n = len(articles)
    if n == 0:
        return []

    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_a] = root_b

    for i in range(n):
        for j in range(i + 1, n):
            if compute_topic_overlap(articles[i], articles[j]) >= _THRESHOLD:
                union(i, j)

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(i)

    correlations: list[dict[str, Any]] = []
    topic_counter = 0
    for indices in clusters.values():
        if len(indices) < 2:
            continue
        topic_counter += 1
        cluster_articles = [articles[i] for i in indices]

        keyword_counts: dict[str, int] = {}
        for art in cluster_articles:
            for word in extract_topic_fingerprint(art):
                keyword_counts[word] = keyword_counts.get(word, 0) + 1

        keywords = [
            word
            for word, _ in sorted(
                ((w, c) for w, c in keyword_counts.items() if c >= 2),
                key=lambda item: item[1],
                reverse=True,
            )[:6]
        ]

        sorted_articles = sorted(
            cluster_articles,
            key=lambda a: _parse_dt(a.published_at) or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        velocity = round(compute_change_velocity(sorted_articles), 4)
        latest_date = sorted_articles[0].published_at

        correlations.append(
            {
                "topicId": f"topic-{topic_counter}",
                "keywords": keywords,
                "articleIds": [a.id for a in cluster_articles],
                "changeVelocity": velocity,
                "latestArticleDate": latest_date,
            }
        )

    correlations.sort(key=lambda c: c["changeVelocity"], reverse=True)
    return correlations
