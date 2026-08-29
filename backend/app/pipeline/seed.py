"""Deterministic seed articles for a truly-offline backfill.

``fetch_live_news`` needs network access (RSS/Guardian over ``httpx``); with no
network it returns ``[]`` and the backfill would produce an empty graph. The
offline embedder + heuristic causal classifier make the *scoring* half
offline-safe, but not the *fetch* half. These seed articles close that gap so
``scripts.backfill --seed`` (or an auto-fallback on an empty live fetch) still
populates a non-empty, related graph without any network.

The set is intentionally small and topically clustered (RBI/inflation,
markets/Fed, oil/commodities) so the pipeline produces real entity-overlap and
semantic edges rather than an isolated node dump.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.pipeline.models import ArticleIn


def seed_articles(*, now: datetime | None = None) -> list[ArticleIn]:
    """Return a deterministic, network-free set of related seed articles."""
    now = now or datetime.now(UTC)

    def iso(hours_ago: float) -> str:
        return (now - timedelta(hours=hours_ago)).isoformat()

    return [
        ArticleIn(
            id="seed-rbi-repo-hike",
            title="RBI raises repo rate by 25 bps to tame stubborn inflation",
            summary=(
                "The Reserve Bank of India lifted the repo rate as retail "
                "inflation stayed above the central bank's tolerance band."
            ),
            source="Seed Feed",
            url="https://example.com/seed/rbi-repo-hike",
            published_at=iso(2),
            category="economic",
            subcategory="Indian National",
            economic_impact_score=8.0,
            tags=["monetary policy", "inflation"],
            is_live_data=False,
        ),
        ArticleIn(
            id="seed-inflation-cpi",
            title="India CPI inflation climbs, keeping pressure on the RBI",
            summary=(
                "Consumer price inflation accelerated on higher food costs, "
                "reinforcing expectations of further RBI rate action."
            ),
            source="Seed Feed",
            url="https://example.com/seed/inflation-cpi",
            published_at=iso(5),
            category="economic",
            subcategory="Indian National",
            economic_impact_score=7.0,
            tags=["inflation", "monetary policy"],
            is_live_data=False,
        ),
        ArticleIn(
            id="seed-sensex-selloff",
            title="Sensex and Nifty slide as rate-hike fears grip markets",
            summary=(
                "Indian equity benchmarks fell sharply after the RBI's move, "
                "with banking and rate-sensitive stocks leading losses."
            ),
            source="Seed Feed",
            url="https://example.com/seed/sensex-selloff",
            published_at=iso(1),
            category="economic",
            subcategory="Indian National",
            economic_impact_score=6.0,
            tags=["stock market"],
            is_live_data=False,
        ),
        ArticleIn(
            id="seed-fed-global-markets",
            title="Global markets wobble as the Fed signals higher-for-longer",
            summary=(
                "US Federal Reserve commentary on persistent inflation pushed "
                "global equities lower and lifted the dollar."
            ),
            source="Seed Feed",
            url="https://example.com/seed/fed-global-markets",
            published_at=iso(3),
            category="international",
            subcategory="International",
            economic_impact_score=7.0,
            tags=["monetary policy", "stock market"],
            is_live_data=False,
        ),
        ArticleIn(
            id="seed-crude-oil",
            title="Crude oil prices rally on supply concerns and OPEC cuts",
            summary=(
                "Brent crude climbed as OPEC output curbs tightened supply, "
                "adding to imported-inflation risk for oil importers like India."
            ),
            source="Seed Feed",
            url="https://example.com/seed/crude-oil",
            published_at=iso(4),
            category="international",
            subcategory="International",
            economic_impact_score=6.0,
            tags=["energy", "inflation"],
            is_live_data=False,
        ),
        ArticleIn(
            id="seed-trade-policy",
            title="Parliament debates new trade policy amid export slowdown",
            summary=(
                "Lawmakers discussed measures to support exporters as global "
                "demand softened and the trade deficit widened."
            ),
            source="Seed Feed",
            url="https://example.com/seed/trade-policy",
            published_at=iso(6),
            category="political",
            subcategory="Indian National",
            economic_impact_score=5.0,
            tags=["trade"],
            is_live_data=False,
        ),
    ]
