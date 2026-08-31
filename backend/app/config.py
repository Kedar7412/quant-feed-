"""Application configuration via pydantic-settings.

All configuration is sourced from environment variables (optionally a local
``.env`` file). Localhost defaults line up with ``backend/docker-compose.yml`` so
that development and tests work with no ``.env`` present. Secrets (API keys,
passwords) must always come from the environment and never be committed.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from the environment.

    Defaults intentionally match ``docker-compose.yml`` so the backend and its
    test-suite run against the local dev stack without extra configuration.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Neo4j graph store ---
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "quantfeed_dev"

    # --- Qdrant vector store ---
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None

    # --- Postgres system-of-record ---
    database_url: str = "postgresql+psycopg://quantfeed:quantfeed_dev@localhost:5432/quantfeed"

    # --- Redis (Celery broker/backend) ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Real-time WebSocket graph diffs (FEAT-004, optional) ---
    # OFF by default so nothing changes unless explicitly enabled. When True,
    # ``run_ingestion`` best-effort publishes a graph diff to the pub/sub channel
    # below and the ``/ws/graph`` gateway fans it out to connected clients. A
    # disabled/unreachable Redis stays a no-op and never fails ingestion.
    realtime_enabled: bool = False
    # Redis pub/sub channel carrying serialized graph diffs.
    diff_channel: str = "quantfeed:graph-diffs"

    # --- OpenAI (embeddings + causal classifier, used in FEAT-002) ---
    openai_api_key: str | None = None

    # --- Pipeline tunables ---
    spacy_model: str = "en_core_web_sm"
    embedding_model: str = "text-embedding-3-large"
    embedding_dim: int = 3072

    # --- Relationship scoring weights (composite RELATES_TO weight) ---
    weight_semantic: float = 0.35
    weight_entity_overlap: float = 0.25
    weight_causal: float = 0.40

    # --- CORS ---
    frontend_origin: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance.

    Field names map case-insensitively to env vars, so ``NEO4J_URI`` populates
    ``neo4j_uri``, ``WEIGHT_SEMANTIC`` populates ``weight_semantic`` etc.
    """
    return Settings()
