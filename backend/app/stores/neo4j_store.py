"""Neo4j graph store wrapper.

Graph model
-----------
Node labels:
    (:Article {id})    - a news article, keyed by a stable article id.
    (:Entity {name})   - a named entity extracted from articles (org, person, ...).
    (:Asset {symbol})  - a tradeable asset / ticker symbol.
    (:Sector {name})   - an economic sector.

Edge (relationship) types:
    [:MENTIONS]        - (:Article)-[:MENTIONS]->(:Entity)
    [:IN_SECTOR]       - (:Entity)-[:IN_SECTOR]->(:Sector) or (:Asset)-[:IN_SECTOR]->(:Sector)
    [:AFFECTS]         - (:Entity)-[:AFFECTS]->(:Asset)
    [:RELATES_TO {semantic, entity_overlap, causal, direction, weight, computed_at}]
                         (:Article)-[:RELATES_TO]->(:Article)

``init_schema`` creates uniqueness constraints (which also back an index) for the
keyed node labels. It is idempotent: ``IF NOT EXISTS`` guards make repeated calls
safe. Scoring/relationship population lands in FEAT-002; the upsert helpers here
provide the seams.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from neo4j import GraphDatabase

if TYPE_CHECKING:
    from neo4j import Driver, Session

    from app.config import Settings

# Cypher statements that establish the graph schema. Each is idempotent.
SCHEMA_STATEMENTS: tuple[str, ...] = (
    "CREATE CONSTRAINT article_id_unique IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT entity_name_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE",
    "CREATE CONSTRAINT asset_symbol_unique IF NOT EXISTS FOR (a:Asset) REQUIRE a.symbol IS UNIQUE",
    "CREATE CONSTRAINT sector_name_unique IF NOT EXISTS FOR (s:Sector) REQUIRE s.name IS UNIQUE",
)


class Neo4jStore:
    """Thin wrapper around the official Neo4j driver."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._driver: Driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )

    def close(self) -> None:
        """Close the underlying driver and release its connection pool."""
        self._driver.close()

    def session(self) -> Session:
        """Open a new Neo4j session (caller is responsible for closing)."""
        return self._driver.session()

    def verify_connectivity(self) -> bool:
        """Best-effort connectivity check for the /health endpoint."""
        self._driver.verify_connectivity()
        return True

    def init_schema(self) -> None:
        """Create constraints/indexes idempotently for the graph model."""
        with self.session() as session:
            for statement in SCHEMA_STATEMENTS:
                session.run(statement)

    # --- upsert helpers (bodies used by FEAT-002 scoring/ingestion) ---

    def upsert_article(self, article_id: str, properties: dict[str, Any]) -> None:
        """Merge an (:Article {id}) node and set/refresh its properties."""
        with self.session() as session:
            session.run(
                "MERGE (a:Article {id: $id}) SET a += $props",
                id=article_id,
                props=properties,
            )

    def upsert_entity(
        self, name: str, label: str | None = None, properties: dict[str, Any] | None = None
    ) -> None:
        """Merge an (:Entity {name}) node, optionally setting a NER label."""
        props: dict[str, Any] = dict(properties or {})
        if label is not None:
            props["label"] = label
        with self.session() as session:
            session.run(
                "MERGE (e:Entity {name: $name}) SET e += $props",
                name=name,
                props=props,
            )

    def link_mentions(self, article_id: str, entity_name: str) -> None:
        """Create an (:Article)-[:MENTIONS]->(:Entity) edge idempotently."""
        with self.session() as session:
            session.run(
                "MERGE (a:Article {id: $article_id}) "
                "MERGE (e:Entity {name: $entity_name}) "
                "MERGE (a)-[:MENTIONS]->(e)",
                article_id=article_id,
                entity_name=entity_name,
            )

    def upsert_relates_to(
        self,
        source_article_id: str,
        target_article_id: str,
        *,
        semantic: float,
        entity_overlap: float,
        causal: float,
        direction: str,
        weight: float,
        computed_at: datetime | None = None,
    ) -> None:
        """Merge a weighted (:Article)-[:RELATES_TO]->(:Article) edge."""
        ts = (computed_at or datetime.now(UTC)).isoformat()
        with self.session() as session:
            session.run(
                "MERGE (s:Article {id: $source_id}) "
                "MERGE (t:Article {id: $target_id}) "
                "MERGE (s)-[r:RELATES_TO]->(t) "
                "SET r.semantic = $semantic, "
                "    r.entity_overlap = $entity_overlap, "
                "    r.causal = $causal, "
                "    r.direction = $direction, "
                "    r.weight = $weight, "
                "    r.computed_at = $computed_at",
                source_id=source_article_id,
                target_id=target_article_id,
                semantic=semantic,
                entity_overlap=entity_overlap,
                causal=causal,
                direction=direction,
                weight=weight,
                computed_at=ts,
            )
