"""WebSocket gateway tests for the real-time graph-diff fan-out (``/ws/graph``).

Everything runs against an ``InMemoryDiffPublisher`` injected via
``app.dependency_overrides`` (mirroring the ``get_read_store`` override in
``test_graph_api.py``), so no live Redis/Neo4j/Qdrant/Postgres/spaCy is needed.
FastAPI's TestClient drives the socket via ``websocket_connect``.

Delivery is made deterministic by the publisher's replay-backlog: diffs are
seeded onto the ``InMemoryDiffPublisher`` BEFORE the client subscribes, so the
subscribe/publish ordering race that would otherwise flake these tests cannot
drop a diff. The WS gateway's per-client predicate still filters replayed diffs
exactly as it filters live ones.

Coverage:
    1. subscribe -> receive a diff that intersects the client's view
    2. server-side predicate DROPS a non-intersecting diff (wrong category /
       wrong sentiment)
    3. a ``filter-update`` message changes what the client subsequently receives
    4. diff JSON serializes to the exact camelCase
       ``{addedNodes, removedNodes, updatedEdges}`` contract
    5. disconnect cleans up the connection registry
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.realtime.diff_publisher import GraphDiff, InMemoryDiffPublisher
from app.routers import ws as ws_module
from app.routers.deps import get_diff_publisher
from app.schemas import EconomicEdge, EconomicNode


def _node(node_id: str, category: str, score: float) -> EconomicNode:
    return EconomicNode.model_validate(
        {
            "id": node_id,
            "articleId": node_id,
            "label": f"label-{node_id}",
            "category": category,
            "economicImpactScore": score,
            "tags": [],
        }
    )


def _client(publisher: InMemoryDiffPublisher) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_diff_publisher] = lambda: publisher
    return TestClient(app)


def _seed(publisher: InMemoryDiffPublisher, *diffs: GraphDiff) -> None:
    """Record diffs on the publisher backlog (delivered on next subscribe)."""
    publisher.published.extend(diffs)


async def _yield_event_loop() -> None:
    """Yield control on the app event loop so pending reads (e.g. a queued
    filter-update) are processed before the next publish."""
    import asyncio

    await asyncio.sleep(0.05)


def test_subscribe_receives_intersecting_diff() -> None:
    """A client subscribed to 'economic' receives an added economic node."""
    publisher = InMemoryDiffPublisher()
    _seed(publisher, GraphDiff(added_nodes=[_node("a1", "economic", 8.0)]))
    client = _client(publisher)

    with client.websocket_connect("/ws/graph") as ws:
        ws.send_json({"type": "subscribe", "filters": {"category": "economic"}})
        message = ws.receive_json()

    assert message["type"] == "diff"
    assert [n["id"] for n in message["diff"]["addedNodes"]] == ["a1"]


def test_predicate_drops_non_intersecting_diff() -> None:
    """A diff whose only node is the wrong category/sentiment is not forwarded."""
    publisher = InMemoryDiffPublisher()
    # political + negative node -> dropped; economic + positive node -> kept.
    _seed(
        publisher,
        GraphDiff(added_nodes=[_node("p1", "political", 2.0)]),
        GraphDiff(added_nodes=[_node("e1", "economic", 9.0)]),
    )
    client = _client(publisher)

    with client.websocket_connect("/ws/graph") as ws:
        ws.send_json(
            {"type": "subscribe", "filters": {"category": "economic", "sentiment": "positive"}}
        )
        # The first (and only) message must be the KEPT diff; the dropped one
        # narrowed to empty and was skipped server-side.
        message = ws.receive_json()

    assert [n["id"] for n in message["diff"]["addedNodes"]] == ["e1"]


def test_filter_update_changes_subscription() -> None:
    """A filter-update message changes which diffs the client subsequently gets.

    Uses the initial-backlog replay for the pre-update assertion, then publishes
    on the app event loop (via the TestClient portal) AFTER the filter-update so
    the gateway's receive loop has applied the new filter before forwarding.
    """
    publisher = InMemoryDiffPublisher()
    _seed(publisher, GraphDiff(added_nodes=[_node("e1", "economic", 8.0)]))
    client = _client(publisher)

    with client, client.websocket_connect("/ws/graph") as ws:
        ws.send_json({"type": "subscribe", "filters": {"category": "economic"}})
        # Pre-update: the economic diff from the backlog is forwarded.
        assert [n["id"] for n in ws.receive_json()["diff"]["addedNodes"]] == ["e1"]

        # Switch the client's view to 'political'. A political diff would have
        # been DROPPED under the original economic filter; receiving it proves
        # the filter-update took effect without a reconnect. Round-trip a small
        # sleep on the app loop first so the receive loop applies the update
        # before we publish.
        ws.send_json({"type": "filter-update", "filters": {"category": "political"}})
        portal = client.portal
        assert portal is not None
        portal.call(_yield_event_loop)
        portal.call(publisher.publish, GraphDiff(added_nodes=[_node("p1", "political", 5.0)]))
        message = ws.receive_json()

    assert [n["id"] for n in message["diff"]["addedNodes"]] == ["p1"]


def test_diff_json_camelcase_contract() -> None:
    """The forwarded diff serializes to the exact camelCase contract."""
    publisher = InMemoryDiffPublisher()
    edge = EconomicEdge(source="e1", target="e2", strength=0.5, relationship="related")
    _seed(
        publisher,
        GraphDiff(
            added_nodes=[_node("e1", "economic", 8.0), _node("e2", "economic", 8.0)],
            removed_nodes=["old1"],
            updated_edges=[edge],
        ),
    )
    client = _client(publisher)

    with client.websocket_connect("/ws/graph") as ws:
        ws.send_json({"type": "subscribe", "filters": {}})
        message = ws.receive_json()

    body = message["diff"]
    assert set(body.keys()) == {"addedNodes", "removedNodes", "updatedEdges"}
    assert body["removedNodes"] == ["old1"]
    node = body["addedNodes"][0]
    assert node["id"] == "e1"
    assert node["articleId"] == "e1"
    assert node["economicImpactScore"] == 8.0
    assert node["category"] == "economic"
    link = body["updatedEdges"][0]
    assert set(link.keys()) == {"source", "target", "strength", "relationship"}
    assert link["source"] == "e1"
    assert link["target"] == "e2"


def test_disconnect_cleans_up_registry() -> None:
    """The connection registry drops the socket after disconnect."""
    publisher = InMemoryDiffPublisher()
    _seed(publisher, GraphDiff(added_nodes=[_node("a1", "economic", 8.0)]))
    client = _client(publisher)

    start = ws_module.registry.count
    with client.websocket_connect("/ws/graph") as ws:
        ws.send_json({"type": "subscribe", "filters": {}})
        ws.receive_json()
        assert ws_module.registry.count == start + 1

    # After the context exits (disconnect) the registry is back to baseline.
    assert ws_module.registry.count == start
