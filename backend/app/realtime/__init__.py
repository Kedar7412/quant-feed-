"""Real-time WebSocket graph-diff subsystem (FEAT-004).

Publishes incremental graph diffs (``{addedNodes, removedNodes, updatedEdges}``)
from the ingestion path onto a Redis pub/sub channel, and fans them out to
subscribed WebSocket clients via the ``/ws/graph`` gateway. Everything is gated
behind ``Settings.realtime_enabled`` and designed to be unit-testable without a
live broker (see ``InMemoryDiffPublisher``).
"""
