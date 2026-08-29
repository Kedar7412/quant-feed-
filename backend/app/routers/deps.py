"""Shared FastAPI dependencies for the read API routers.

``get_read_store`` yields a ``GraphReadStore`` backed by Postgres. Tests override
this dependency via ``app.dependency_overrides`` with an in-memory fake seeded
with a fixture graph, so the API can be exercised without live datastores.
"""

from __future__ import annotations

from collections.abc import Iterator

from app.services.graph_service import GraphReadStore, PostgresReadStore
from app.stores.postgres import _get_sessionmaker


def get_read_store() -> Iterator[GraphReadStore]:
    """Yield a Postgres-backed ``GraphReadStore`` bound to a fresh session."""
    session = _get_sessionmaker()()
    try:
        yield PostgresReadStore(session)
    finally:
        session.close()
