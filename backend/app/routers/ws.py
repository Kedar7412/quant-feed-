"""WebSocket gateway for real-time graph diffs (``/ws/graph``).

Protocol
--------
On connect the client sends a JSON ``subscribe`` message carrying its current
view filters::

    {"type": "subscribe", "filters": {"category": "economic", "sentiment": "positive", ...}}

The gateway registers the connection + a server-side predicate built from those
filters, subscribes to the diff publisher, and for every incoming diff forwards
ONLY the nodes/edges intersecting that client's view (see
``app.realtime.predicate``). The client may send a ``filter-update`` message at
any time to change its subscription without reconnecting::

    {"type": "filter-update", "filters": {...}}

Diffs are pushed to the client as::

    {"type": "diff", "diff": {"addedNodes": [...], "removedNodes": [...], "updatedEdges": [...]}}

On disconnect the connection is removed from the registry and its publisher
subscription is torn down. Everything is dependency-injected so tests can swap in
an ``InMemoryDiffPublisher`` via ``app.dependency_overrides``; no live Redis.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Annotated, Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.realtime.diff_publisher import GraphDiff, Publisher
from app.realtime.predicate import ClientFilters, prune_edges
from app.routers.deps import get_diff_publisher

router = APIRouter(tags=["realtime"])


class ConnectionRegistry:
    """Tracks live WebSocket connections (for cleanup + introspection/tests)."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    def add(self, ws: WebSocket) -> None:
        self._connections.add(ws)

    def remove(self, ws: WebSocket) -> None:
        self._connections.discard(ws)

    @property
    def count(self) -> int:
        return len(self._connections)


# Module-level registry so tests can assert connections clean up on disconnect.
registry = ConnectionRegistry()


def _narrow(diff: GraphDiff, filters: ClientFilters) -> GraphDiff:
    """Apply the client predicate to a diff, returning only the intersecting parts."""
    kept_nodes = filters.filter_diff(diff.added_nodes)
    kept_ids = {n.id for n in kept_nodes}
    # Removals always forward (the client should drop the node if it had it).
    removed = list(diff.removed_nodes)
    # Only forward edges whose endpoints survive the client's node filter.
    kept_edges = prune_edges(diff.updated_edges, kept_ids)
    return GraphDiff(
        added_nodes=kept_nodes,
        removed_nodes=removed,
        updated_edges=kept_edges,
    )


async def _receive_loop(ws: WebSocket, state: dict[str, Any]) -> None:
    """Read client messages, updating the active filters on ``filter-update``."""
    while True:
        message = await ws.receive_json()
        msg_type = message.get("type")
        if msg_type == "filter-update":
            state["filters"] = ClientFilters.from_message(message.get("filters"))
        elif msg_type == "subscribe":
            # Allow re-subscribe to also update filters.
            state["filters"] = ClientFilters.from_message(message.get("filters"))


async def _forward_loop(
    ws: WebSocket, publisher: Publisher, state: dict[str, Any]
) -> None:
    """Stream published diffs, narrowed by the client's current filters."""
    async for diff in publisher.subscribe():
        filters: ClientFilters = state["filters"]
        narrowed = _narrow(diff, filters)
        if narrowed.is_empty():
            continue
        await ws.send_json({"type": "diff", "diff": narrowed.to_dict()})


@router.websocket("/ws/graph")
async def graph_ws(
    websocket: WebSocket,
    publisher: Annotated[Publisher, Depends(get_diff_publisher)],
) -> None:
    """Accept a client, register it, and fan out filtered diffs until disconnect."""
    await websocket.accept()
    registry.add(websocket)

    # The first message must be a subscribe carrying the client's filters.
    try:
        first = await websocket.receive_json()
    except WebSocketDisconnect:
        registry.remove(websocket)
        return

    state: dict[str, Any] = {"filters": ClientFilters.from_message(first.get("filters"))}

    receive_task = asyncio.create_task(_receive_loop(websocket, state))
    forward_task = asyncio.create_task(_forward_loop(websocket, publisher, state))

    try:
        done, pending = await asyncio.wait(
            {receive_task, forward_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        # Surface a non-disconnect error from whichever task finished first.
        for task in done:
            exc = task.exception()
            if exc is not None and not isinstance(exc, WebSocketDisconnect):
                raise exc
    except WebSocketDisconnect:
        pass
    finally:
        for task in (receive_task, forward_task):
            if not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
        registry.remove(websocket)
