"""Server-side per-client diff predicate.

Each WebSocket client subscribes with its current view filters
(``category``/``sector``, ``startDate``, ``endDate``, ``sentiment``, ``entity``).
The gateway narrows every incoming :class:`GraphDiff` to only the nodes/edges
that intersect that client's view BEFORE forwarding, so streamed diffs narrow
the graph identically to ``GET /graph/query``.

The node-level rules here reuse the EXACT derivations in
``app.services.graph_service`` (category match; sentiment derived from
``economicImpactScore`` with >=7 positive / <=3 negative / else neutral) so the
WS and REST paths agree.

Best-effort DATE/ENTITY handling (INTENTIONAL, needs product sign-off):
diff nodes do not carry the fields these two filters really need, so the
predicate cannot enforce them the way ``GET /graph/query`` does over persisted
articles:

- Date window: a diff node has NO ``publishedAt``, so the window CANNOT be
  applied and the add is KEPT. An entity-/date-scoped client may therefore
  receive adds it cannot positively exclude until the next REST window
  re-authoritatively narrows the graph. This is deliberate (diffs are additive
  and best-effort) and flagged for product sign-off.
- Entity: the diff node carries only tags + label/title/summary (not linked
  entities), so entity match is a best-effort substring test over those fields;
  a node with no textual mention is dropped to avoid spamming an entity-focused
  client with unrelated adds.
"""

from __future__ import annotations

from app.schemas import EconomicEdge, EconomicNode
from app.services.graph_service import _parse_date

# Sentiment thresholds — identical to graph_service.filter_articles.
_POSITIVE_MIN = 7
_NEGATIVE_MAX = 3


def derive_sentiment(score: float | None) -> str:
    """Derive the sentiment bucket from an economic-impact score (>=7 / <=3 / else)."""
    value = 5.0 if score is None else score
    if value >= _POSITIVE_MIN:
        return "positive"
    if value <= _NEGATIVE_MAX:
        return "negative"
    return "neutral"


class ClientFilters:
    """Normalized filter set for one connected client."""

    __slots__ = ("category", "start_date", "end_date", "sentiment", "entity")

    def __init__(
        self,
        *,
        category: str | None = None,
        sector: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sentiment: str | None = None,
        entity: str | None = None,
    ) -> None:
        cat = category or sector
        self.category = cat if cat and cat != "all" else None
        self.start_date = start_date or None
        self.end_date = end_date or None
        self.sentiment = sentiment or None
        self.entity = entity.strip().lower() if entity else None

    @classmethod
    def from_message(cls, payload: dict[str, object] | None) -> ClientFilters:
        """Build filters from a subscribe/filter-update message ``filters`` object."""
        data = payload or {}

        def _s(key: str) -> str | None:
            value = data.get(key)
            return value if isinstance(value, str) else None

        return cls(
            category=_s("category"),
            sector=_s("sector"),
            start_date=_s("startDate"),
            end_date=_s("endDate"),
            sentiment=_s("sentiment"),
            entity=_s("entity"),
        )

    def _node_matches(self, node: EconomicNode) -> bool:
        if self.category is not None and node.category != self.category:
            return False
        if self.sentiment is not None:
            if derive_sentiment(node.economic_impact_score) != self.sentiment:
                return False
        if self.entity is not None:
            # The diff node carries tags + label/title, not linked entities.
            # Keep it when any of those mention the entity; otherwise drop so an
            # entity-focused client is not spammed with unrelated adds.
            haystacks = [node.label, node.title or "", node.summary or ""]
            haystacks.extend(node.tags or [])
            if not any(self.entity in h.lower() for h in haystacks):
                return False
        # Date window cannot be applied — diff nodes do not carry publishedAt —
        # so an add is kept (best-effort, additive). REST still authoritatively
        # windows the initial load.
        return True

    def filter_diff(self, diff_nodes: list[EconomicNode]) -> list[EconomicNode]:
        """Return the subset of added nodes intersecting this client's view."""
        return [n for n in diff_nodes if self._node_matches(n)]

    def intersects(self, node: EconomicNode) -> bool:
        """True when a single node intersects this client's view."""
        return self._node_matches(node)


def prune_edges(
    edges: list[EconomicEdge], visible_ids: set[str]
) -> list[EconomicEdge]:
    """Drop edges whose endpoints are not both visible to the client.

    Mirrors ``graph_service.prune_links`` so streamed edge topology never
    references a node the client filtered out.
    """
    return [e for e in edges if e.source in visible_ids and e.target in visible_ids]


# ``_parse_date`` is re-exported so tests documenting the shared date rule can
# reference the exact helper the REST path uses.
__all__ = ["ClientFilters", "derive_sentiment", "prune_edges", "_parse_date"]
