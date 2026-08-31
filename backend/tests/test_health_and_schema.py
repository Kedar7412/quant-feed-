"""Unit tests for the /health endpoint and Neo4j schema initialization.

These tests must pass WITHOUT any live Neo4j/Qdrant/Postgres/OpenAI services:
all datastore connectivity is patched.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.stores.neo4j_store import SCHEMA_STATEMENTS, Neo4jStore


def test_health_all_ok() -> None:
    """/health returns 200 with all datastores reporting ok when reachable."""
    with (
        patch("app.main._check_neo4j", return_value="ok"),
        patch("app.main._check_qdrant", return_value="ok"),
        patch("app.main._check_postgres", return_value="ok"),
    ):
        client = TestClient(create_app())
        resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"status", "neo4j", "qdrant", "postgres"}
    assert body["status"] == "ok"
    assert body["neo4j"] == "ok"
    assert body["qdrant"] == "ok"
    assert body["postgres"] == "ok"


def test_health_degrades_without_crashing() -> None:
    """/health still returns 200 and 'degraded' when datastores are down."""
    with (
        patch("app.main._check_neo4j", return_value="unavailable"),
        patch("app.main._check_qdrant", return_value="unavailable"),
        patch("app.main._check_postgres", return_value="unavailable"),
    ):
        client = TestClient(create_app())
        resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["neo4j"] == "unavailable"
    assert body["qdrant"] == "unavailable"
    assert body["postgres"] == "unavailable"


def _make_store_with_mock_session() -> tuple[Neo4jStore, MagicMock]:
    settings = Settings()
    mock_session = MagicMock()
    # session() is used as a context manager: `with self.session() as session:`
    with patch.object(Neo4jStore, "__init__", return_value=None):
        store = Neo4jStore.__new__(Neo4jStore)
        store._settings = settings
    store.session = MagicMock()  # type: ignore[method-assign]
    store.session.return_value.__enter__.return_value = mock_session
    store.session.return_value.__exit__.return_value = False
    return store, mock_session


def test_init_schema_emits_expected_cypher() -> None:
    """init_schema() runs exactly the idempotent constraint statements."""
    store, mock_session = _make_store_with_mock_session()

    store.init_schema()

    executed = [call.args[0] for call in mock_session.run.call_args_list]
    assert executed == list(SCHEMA_STATEMENTS)

    # Each keyed label must get an idempotent uniqueness constraint.
    joined = "\n".join(executed)
    assert "IF NOT EXISTS" in joined
    for fragment in (
        "(a:Article) REQUIRE a.id IS UNIQUE",
        "(e:Entity) REQUIRE e.name IS UNIQUE",
        "(a:Asset) REQUIRE a.symbol IS UNIQUE",
        "(s:Sector) REQUIRE s.name IS UNIQUE",
    ):
        assert fragment in joined


def test_relates_to_edge_properties_present() -> None:
    """upsert_relates_to sets all documented RELATES_TO edge properties."""
    store, mock_session = _make_store_with_mock_session()

    store.upsert_relates_to(
        "art-1",
        "art-2",
        semantic=0.5,
        entity_overlap=0.2,
        causal=0.3,
        direction="forward",
        weight=0.42,
    )

    assert mock_session.run.call_count == 1
    query = mock_session.run.call_args.args[0]
    for prop in ("semantic", "entity_overlap", "causal", "direction", "weight", "computed_at"):
        assert f"r.{prop}" in query


def test_config_defaults_match_compose() -> None:
    """Localhost defaults and scoring weights match the documented values."""
    settings = Settings()
    assert settings.embedding_model == "text-embedding-3-large"
    assert settings.embedding_dim == 3072
    assert settings.spacy_model == "en_core_web_sm"
    assert settings.weight_semantic == 0.35
    assert settings.weight_entity_overlap == 0.25
    assert settings.weight_causal == 0.40
    assert settings.weight_semantic + settings.weight_entity_overlap + settings.weight_causal == 1.0
