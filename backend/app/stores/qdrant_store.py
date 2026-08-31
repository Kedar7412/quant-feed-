"""Qdrant vector store wrapper.

Manages the ``article_embeddings`` collection (size = ``EMBEDDING_DIM``, Cosine
distance) used for semantic similarity between articles. Embedding generation
lands in FEAT-002; this wrapper provides the collection lifecycle plus upsert /
search seams.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

if TYPE_CHECKING:
    from app.config import Settings

COLLECTION_NAME = "article_embeddings"


class QdrantStore:
    """Thin wrapper around ``QdrantClient`` for article embeddings."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._dim = settings.embedding_dim
        self._client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
        )

    @property
    def client(self) -> QdrantClient:
        return self._client

    def close(self) -> None:
        """Close the Qdrant client."""
        self._client.close()

    def ping(self) -> bool:
        """Best-effort connectivity check for the /health endpoint."""
        self._client.get_collections()
        return True

    def ensure_collection(self) -> None:
        """Create the ``article_embeddings`` collection if it is missing."""
        if self._client.collection_exists(COLLECTION_NAME):
            return
        self._client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
        )

    def upsert_vectors(
        self, point_id: str | int, vector: list[float], payload: dict[str, Any] | None = None
    ) -> None:
        """Upsert a single embedding point into the collection."""
        self._client.upsert(
            collection_name=COLLECTION_NAME,
            points=[PointStruct(id=point_id, vector=vector, payload=payload or {})],
        )

    def search(
        self,
        vector: list[float],
        top_k: int = 10,
        query_filter: Any | None = None,
    ) -> list[Any]:
        """Return the ``top_k`` nearest neighbours to ``vector``."""
        response = self._client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=top_k,
            query_filter=query_filter,
        )
        return list(response.points)
