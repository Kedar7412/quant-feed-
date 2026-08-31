"""Python news fetchers mirroring the frontend live sources.

Reproduces the behaviour of ``lib/news/sources.ts``, ``lib/news/fetcher.ts`` and
``lib/news/api-fetcher.ts``:

* Google News RSS search feeds (``when:1d``) + direct publisher RSS feeds.
* Optional Guardian / GNews / NewsData API fetchers, keyed off env vars.
* ``economicImpactScore`` heuristic, tag extraction, category/subcategory.
* A 7-day recency filter and title-similarity dedupe.

All network access is via ``httpx``; RSS/XML is parsed with the stdlib
``xml.etree`` so no extra dependency is required. Fetch failures degrade to an
empty list (mirroring the ``Promise.allSettled`` behaviour on the frontend).
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import quote
from xml.etree import ElementTree as ET

import httpx

from app.pipeline.clean import strip_html
from app.pipeline.models import ArticleIn, Category, Subcategory

logger = logging.getLogger(__name__)

_USER_AGENT = "QuantFeed/1.0 (News Aggregator)"
_TIMEOUT = 8.0
_SEVEN_DAYS = timedelta(days=7)
_MIN_RECENT = 5

_HIGH_IMPACT_TERMS = (
    "gdp",
    "inflation",
    "rate cut",
    "rate hike",
    "rbi",
    "fed",
    "recession",
    "growth",
    "deficit",
    "surplus",
    "crash",
    "rally",
    "crisis",
)
_MED_IMPACT_TERMS = (
    "market",
    "stock",
    "trade",
    "export",
    "import",
    "investment",
    "tax",
    "policy",
    "reform",
    "employment",
)
_TAG_KEYWORDS: dict[str, tuple[str, ...]] = {
    "monetary policy": ("rbi", "repo rate", "interest rate", "fed", "ecb"),
    "stock market": ("sensex", "nifty", "bse", "nse", "stock", "share"),
    "inflation": ("inflation", "cpi", "wpi", "prices", "cost"),
    "trade": ("export", "import", "trade", "tariff", "customs"),
    "technology": ("tech", "ai", "digital", "startup", "it sector"),
    "energy": ("oil", "gas", "solar", "renewable", "energy"),
    "infrastructure": ("infrastructure", "road", "railway", "port", "highway"),
    "employment": ("jobs", "hiring", "unemployment", "layoff", "workforce"),
}


def estimate_economic_impact(title: str, content: str) -> float:
    """Heuristic 1-10 economic-impact score (mirrors the frontend)."""
    text = f"{title} {content}".lower()
    score = 5.0
    for term in _HIGH_IMPACT_TERMS:
        if term in text:
            score += 1.5
    for term in _MED_IMPACT_TERMS:
        if term in text:
            score += 0.5
    return float(min(10, max(1, round(score))))


def extract_tags(title: str, content: str) -> list[str]:
    """Keyword-based tag extraction (mirrors the frontend)."""
    text = f"{title} {content}".lower()
    tags = [tag for tag, kws in _TAG_KEYWORDS.items() if any(k in text for k in kws)]
    return tags[:5] if tags else ["general"]


def _generate_id() -> str:
    return f"art-{uuid.uuid4().hex[:16]}"


def _google_news_rss(query: str, region: str = "IN") -> str:
    encoded = quote(f"{query} when:1d")
    params = "hl=en-US&gl=US&ceid=US:en" if region == "US" else "hl=en-IN&gl=IN&ceid=IN:en"
    return f"https://news.google.com/rss/search?q={encoded}&{params}"


# Source definitions mirroring lib/news/sources.ts.
NewsSourceDef = tuple[str, str, Category, Subcategory]

NEWS_SOURCES: list[NewsSourceDef] = [
    (
        "Google News - India Economy",
        _google_news_rss("india economy"),
        "economic",
        "Indian National",
    ),
    (
        "Google News - RBI Monetary Policy",
        _google_news_rss("RBI monetary policy"),
        "economic",
        "Indian National",
    ),
    (
        "Google News - Sensex Nifty Markets",
        _google_news_rss("sensex nifty stock market"),
        "economic",
        "Indian National",
    ),
    (
        "Google News - India Inflation GDP",
        _google_news_rss("india inflation gdp"),
        "economic",
        "Indian National",
    ),
    (
        "Google News - Global Markets Fed",
        _google_news_rss("global markets fed", "US"),
        "international",
        "International",
    ),
    (
        "Google News - Crude Oil Commodities",
        _google_news_rss("crude oil commodities"),
        "international",
        "International",
    ),
    (
        "Google News - India Politics Policy",
        _google_news_rss("india politics policy"),
        "political",
        "Indian National",
    ),
    (
        "The Hindu - Business",
        "https://www.thehindu.com/business/feeder/default.rss",
        "economic",
        "Indian National",
    ),
    (
        "Economic Times - Markets",
        "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "economic",
        "Indian National",
    ),
    ("Mint - Economy", "https://www.livemint.com/rss/economy", "economic", "Indian National"),
    (
        "Times of India - Business",
        "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",
        "economic",
        "Indian National",
    ),
    (
        "Business Standard - Markets",
        "https://www.business-standard.com/rss/markets-106.rss",
        "economic",
        "Indian National",
    ),
    (
        "Al Jazeera - Economy",
        "https://www.aljazeera.com/xml/rss/all.xml",
        "international",
        "International",
    ),
    (
        "BBC - Business",
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "international",
        "International",
    ),
]


def _parse_pubdate(raw: str | None) -> str:
    """Parse an RSS pubDate into an ISO-8601 string; default to now (UTC)."""
    if raw:
        try:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC).isoformat()
        except (TypeError, ValueError):
            pass
    return datetime.now(UTC).isoformat()


def _parse_google_news_title(raw_title: str) -> tuple[str, str | None]:
    """Split ``"Headline - Source"`` (mirrors the frontend helper)."""
    idx = raw_title.rfind(" - ")
    if 0 < idx < len(raw_title) - 3:
        title = raw_title[:idx].strip()
        source = raw_title[idx + 3 :].strip()
        if title and source and len(source) <= 60:
            return title, source
    return raw_title, None


def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _parse_rss(xml_text: str) -> list[dict[str, Any]]:
    """Parse RSS/Atom XML into a list of item dicts (title, summary, link, date)."""
    items: list[dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    for node in root.iter():
        tag = _strip_ns(node.tag)
        if tag not in ("item", "entry"):
            continue
        item: dict[str, Any] = {}
        for child in node:
            ctag = _strip_ns(child.tag)
            if ctag == "title":
                item["title"] = (child.text or "").strip()
            elif ctag in ("description", "summary", "content"):
                item.setdefault("summary", strip_html(child.text or ""))
            elif ctag == "link":
                href = child.get("href")
                item["link"] = href or (child.text or "").strip()
            elif ctag in ("pubDate", "published", "updated"):
                item.setdefault("pubDate", child.text)
            elif ctag == "source":
                item["source"] = (child.text or "").strip()
        if item.get("title"):
            items.append(item)
    return items


def _fetch_rss(
    client: httpx.Client, name: str, url: str, category: Category, subcategory: Subcategory
) -> list[ArticleIn]:
    try:
        resp = client.get(url)
        resp.raise_for_status()
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        logger.warning("RSS fetch failed for %s: %s", name, exc)
        return []

    is_google = "news.google.com" in url
    articles: list[ArticleIn] = []
    for raw in _parse_rss(resp.text)[:10]:
        raw_title = raw.get("title") or "Untitled"
        content = raw.get("summary") or ""
        title = raw_title
        display_source = name
        if is_google:
            title, parsed_source = _parse_google_news_title(raw_title)
            display_source = raw.get("source") or parsed_source or name
        summary = (content[:300]) or title
        articles.append(
            ArticleIn(
                id=_generate_id(),
                title=title,
                summary=summary,
                source=display_source,
                url=raw.get("link") or url,
                published_at=_parse_pubdate(raw.get("pubDate")),
                category=category,
                subcategory=subcategory,
                economic_impact_score=estimate_economic_impact(title, content),
                tags=extract_tags(title, content),
                is_live_data=True,
            )
        )
    return articles


def fetch_from_rss_sources(client: httpx.Client | None = None) -> list[ArticleIn]:
    """Fetch and normalize articles from every configured RSS source."""
    owns_client = client is None
    client = client or httpx.Client(
        timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT}, follow_redirects=True
    )
    try:
        articles: list[ArticleIn] = []
        for name, url, category, subcategory in NEWS_SOURCES:
            articles.extend(_fetch_rss(client, name, url, category, subcategory))
        return articles
    finally:
        if owns_client:
            client.close()


def fetch_from_guardian(client: httpx.Client) -> list[ArticleIn]:
    """Fetch from The Guardian Open Platform if ``GUARDIAN_API_KEY`` is set."""
    api_key = os.environ.get("GUARDIAN_API_KEY")
    if not api_key:
        return []
    base = "show-fields=trailText,bodyText&page-size=20&order-by=newest"
    root = "https://content.guardianapis.com/search"
    india_query = quote("india economy")
    endpoints = [
        (
            f"{root}?section=business&{base}&api-key={api_key}",
            "international",
            "International",
        ),
        (
            f"{root}?q={india_query}&{base}&api-key={api_key}",
            "economic",
            "Indian National",
        ),
    ]
    articles: list[ArticleIn] = []
    for url, category, subcategory in endpoints:
        try:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Guardian fetch failed: %s", exc)
            continue
        for item in data.get("response", {}).get("results", []):
            title = item.get("webTitle") or "Untitled"
            fields = item.get("fields") or {}
            content = strip_html(fields.get("trailText") or fields.get("bodyText") or "")[:300]
            summary = content or title
            articles.append(
                ArticleIn(
                    id=_generate_id(),
                    title=title,
                    summary=summary,
                    source="The Guardian",
                    url=item.get("webUrl") or "",
                    published_at=_parse_pubdate(item.get("webPublicationDate")),
                    category=category,
                    subcategory=subcategory,
                    economic_impact_score=estimate_economic_impact(title, content),
                    tags=extract_tags(title, content),
                    is_live_data=True,
                )
            )
    return articles


_NORM_RE = re.compile(r"[^a-z0-9\s]")
_WS_RE = re.compile(r"\s+")


def _normalize_title(title: str) -> str:
    return _WS_RE.sub(" ", _NORM_RE.sub("", title.lower().strip())).strip()


def _titles_similar(a: str, b: str) -> bool:
    """80%+ word-overlap similarity (mirrors the frontend dedupe)."""
    na, nb = _normalize_title(a), _normalize_title(b)
    if na == nb:
        return True
    words_a, words_b = na.split(), nb.split()
    shorter, longer = (words_a, words_b) if len(words_a) <= len(words_b) else (words_b, words_a)
    longer_str = " ".join(longer)
    matches = sum(1 for w in shorter if len(w) > 2 and w in longer_str)
    ratio = matches / len(shorter) if shorter else 0.0
    return ratio > 0.8


def deduplicate(articles: list[ArticleIn]) -> list[ArticleIn]:
    """Drop title-similar duplicates, keeping the first occurrence."""
    unique: list[ArticleIn] = []
    for article in articles:
        if not any(_titles_similar(existing.title, article.title) for existing in unique):
            unique.append(article)
    return unique


def _parse_iso(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except ValueError:
        return datetime.now(UTC)


def apply_recency_filter(
    articles: list[ArticleIn], *, now: datetime | None = None
) -> list[ArticleIn]:
    """Drop items older than 7 days, keeping at least ``_MIN_RECENT`` newest.

    Mirrors ``lib/news/fetcher.ts``: never returns an empty feed on a slow news
    day; falls back to the newest items when too few recent ones remain.
    """
    now = now or datetime.now(UTC)
    ordered = sorted(articles, key=lambda a: _parse_iso(a.published_at), reverse=True)
    recent = [a for a in ordered if now - _parse_iso(a.published_at) <= _SEVEN_DAYS]
    if len(recent) >= _MIN_RECENT:
        return recent
    return ordered[: max(_MIN_RECENT, len(recent))]


def fetch_live_news() -> list[ArticleIn]:
    """Fetch from all RSS sources + APIs, dedupe, and apply the recency filter."""
    client = httpx.Client(
        timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT}, follow_redirects=True
    )
    try:
        combined = fetch_from_rss_sources(client)
        combined.extend(fetch_from_guardian(client))
    finally:
        client.close()
    return apply_recency_filter(deduplicate(combined))
