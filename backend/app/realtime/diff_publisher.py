"""Graph-diff pub/sub abstraction for real-time WebSocket streaming.

A ``GraphDiff`` is the transport unit for incremental scene updates: it carries
newly added nodes, removed node ids, and the (rewritten) edge topology. It
serializes to the EXACT camelCase contract the frontend consumes
(``{addedNodes, removedNodes, updatedEdges}``, mirroring ``lib/types.ts``
``EconomicNode``/``EconomicEdge`` and ``lib/graph3d/types.ts`` ``GraphDiff``).

The ``Publisher`` protocol has two concrete implementations:

- ``RedisDiffPublisher`` — publishes diffs on a Redis pub/sub channel via
  ``redis.asyncio`` and yields diffs from a subscription. Constructed lazily so
  importing this module never requires a live broker.
- ``InMemoryDiffPublisher`` — an in-process fan-out fake used by tests (and by
  the WS gateway when realtime is disabled) so the whole path is exercisable
  with no Redis. It supports multiple concurrent subscribers.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Protocol

from app.schemas import EconomicEdge, EconomicNode

if TYPE_CHECKING:
    from app.config import Settings


class GraphDiff:
    """An incremental graph change.

    Field names on the wire are camelCase to match the frontend contract:
    ``{addedNodes, removedNodes, updatedEdges}``.

    CONTRACT: ``addedNodes`` and ``removedNodes`` are incremental patches, but
    ``updatedEdges`` is a FULL REWRITE of the edge topology — the client replaces
    its entire edge buffer with exactly these edges (see ``lib/graph3d/types.ts``
    ``GraphDiff`` and ``store.rewriteEdges``). Producers must therefore always
    populate ``updatedEdges`` with the CUMULATIVE current edge set, not just the
    edges touched by the latest change, or a streamed diff will drop every
    previously loaded edge.
    """

    __slots__ = ("added_nodes", "removed_nodes", "updated_edges")

    def __init__(
        self,
        added_nodes: list[EconomicNode] | None = None,
        removed_nodes: list[str] | None = None,
        updated_edges: list[EconomicEdge] | None = None,
    ) -> None:
        self.added_nodes: list[EconomicNode] = added_nodes or []
        self.removed_nodes: list[str] = removed_nodes or []
        self.updated_edges: list[EconomicEdge] = updated_edges or []

    def to_dict(self) -> dict[str, Any]:
        """Serialize to the camelCase ``{addedNodes, removedNodes, updatedEdges}`` dict."""
        return {
            "addedNodes": [n.model_dump(by_alias=True) for n in self.added_nodes],
            "removedNodes": list(self.removed_nodes),
            "updatedEdges": [e.model_dump(by_alias=True) for e in self.updated_edges],
        }

    def to_json(self) -> str:
        """Serialize to a JSON string for the pub/sub transport."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GraphDiff:
        """Rehydrate a ``GraphDiff`` from a camelCase dict (validates node/edge shape)."""
        return cls(
            added_nodes=[EconomicNode.model_validate(n) for n in data.get("addedNodes", [])],
            removed_nodes=[str(x) for x in data.get("removedNodes", [])],
            updated_edges=[EconomicEdge.model_validate(e) for e in data.get("updatedEdges", [])],
        )

    @classmethod
    def from_json(cls, raw: str) -> GraphDiff:
        """Rehydrate a ``GraphDiff`` from a JSON string."""
        return cls.from_dict(json.loads(raw))

    def is_empty(self) -> bool:
        """True when the diff carries no adds, removals, or edges."""
        return not self.added_nodes and not self.removed_nodes and not self.updated_edges


class Publisher(Protocol):
    """A diff transport: publish diffs and stream them back to subscribers."""

    async def publish(self, diff: GraphDiff) -> None:
        """Publish a diff to all current/future subscribers (best-effort)."""
        ...

    def subscribe(self) -> AsyncIterator[GraphDiff]:
        """Return an async iterator yielding diffs as they are published."""
        ...


class InMemoryDiffPublisher:
    """In-process fan-out fake used by tests and the disabled-realtime path.

    Every call to :meth:`subscribe` gets its own unbounded queue; :meth:`publish`
    delivers a copy of the diff to each live subscriber. No network, no Redis.
    """

    def __init__(self, replay_backlog: bool = True) -> None:
        self._subscribers: list[asyncio.Queue[GraphDiff]] = []
        self.published: list[GraphDiff] = []
        self._replay_backlog = replay_backlog

    async def publish(self, diff: GraphDiff) -> None:
        self.published.append(diff)
        for queue in list(self._subscribers):
            queue.put_nowait(diff)

    async def subscribe(self) -> AsyncIterator[GraphDiff]:
        queue: asyncio.Queue[GraphDiff] = asyncio.Queue()
        # Replay any diffs published before this subscriber registered so a
        # subscribe/publish race (common in tests) does not drop a diff. The WS
        # gateway's per-client predicate still filters replayed diffs.
        if self._replay_backlog:
            for diff in self.published:
                queue.put_nowait(diff)
        self._subscribers.append(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            if queue in self._subscribers:
                self._subscribers.remove(queue)


class RedisDiffPublisher:
    """Redis pub/sub ``Publisher`` (constructed lazily; no broker at import time).

    Uses ``redis.asyncio`` so it slots into FastAPI's async WebSocket handlers.
    The Redis client is created on first use rather than in ``__init__`` so this
    class can be instantiated without a reachable broker.
    """

    def __init__(self, redis_url: str, channel: str) -> None:
        self._redis_url = redis_url
        self._channel = channel
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            # Imported lazily so a missing/optional redis dep never breaks import.
            from redis import asyncio as aioredis

            self._client = aioredis.from_url(self._redis_url)
        return self._client

    async def publish(self, diff: GraphDiff) -> None:
        client = self._get_client()
        await client.publish(self._channel, diff.to_json())

    async def subscribe(self) -> AsyncIterator[GraphDiff]:
        client = self._get_client()
        pubsub = client.pubsub()
        await pubsub.subscribe(self._channel)
        try:
            async for message in pubsub.listen():
                if message is None or message.get("type") != "message":
                    continue
                data = message.get("data")
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                if not isinstance(data, str):
                    continue
                yield GraphDiff.from_json(data)
        finally:
            await pubsub.unsubscribe(self._channel)
            await pubsub.aclose()

    async def aclose(self) -> None:
        """Close the underlying Redis client if one was created."""
        if self._client is not None:
            await self._client.aclose()


def build_publisher(settings: Settings) -> RedisDiffPublisher:
    """Construct a ``RedisDiffPublisher`` from settings (lazy; no broker required)."""
    return RedisDiffPublisher(settings.redis_url, settings.diff_channel)
