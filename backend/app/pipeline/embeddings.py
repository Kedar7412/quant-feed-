"""Pluggable embedders for semantic similarity.

Defines an ``Embedder`` protocol so a fake can be injected in tests. Two concrete
implementations ship:

* ``OpenAIEmbedder``    - calls the OpenAI embeddings API (``EMBEDDING_MODEL``)
                          with batching + tenacity retry. Never logs the key.
* ``LocalHashEmbedder`` - a deterministic, dependency-free fallback used when
                          ``OPENAI_API_KEY`` is unset so backfill still produces a
                          non-empty graph offline. Hashes tokens into a fixed-size
                          bag-of-words vector; cosine similarity between related
                          texts is meaningfully > 0.

``select_embedder`` picks the right implementation from ``Settings``.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import TYPE_CHECKING, Protocol

from tenacity import retry, stop_after_attempt, wait_exponential

if TYPE_CHECKING:
    from app.config import Settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class Embedder(Protocol):
    """Turns a batch of texts into unit-length embedding vectors."""

    @property
    def dim(self) -> int: ...

    def embed(self, texts: list[str]) -> list[list[float]]: ...


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors, clamped to ``[0, 1]``.

    Negative cosine values are clamped to 0 because relationship strengths are
    non-negative (they map onto ``EconomicEdge.strength`` in ``[0, 1]``).
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    sim = dot / (norm_a * norm_b)
    return max(0.0, min(1.0, sim))


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class LocalHashEmbedder:
    """Deterministic hashing embedder (no network, no API key).

    Produces L2-normalized bag-of-words vectors via feature hashing. Same input
    always yields the same vector, so tests and offline backfill are stable.
    """

    def __init__(self, dim: int = 3072) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    def _embed_one(self, text: str) -> list[float]:
        vec = [0.0] * self._dim
        for token in _tokenize(text):
            digest = hashlib.md5(token.encode("utf-8")).digest()  # noqa: S324
            index = int.from_bytes(digest[:4], "big") % self._dim
            sign = 1.0 if digest[4] & 1 else -1.0
            vec[index] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            return vec
        return [v / norm for v in vec]

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]


class OpenAIEmbedder:
    """OpenAI embeddings with batching + retry. Never logs the API key."""

    def __init__(self, api_key: str, model: str, dim: int, *, batch_size: int = 64) -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key)
        self._model = model
        self._dim = dim
        self._batch_size = batch_size

    @property
    def dim(self) -> int:
        return self._dim

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        reraise=True,
    )
    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        response = self._client.embeddings.create(model=self._model, input=batch)
        return [item.embedding for item in response.data]

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            vectors.extend(self._embed_batch(batch))
        return vectors


def select_embedder(settings: Settings) -> Embedder:
    """Return an OpenAI embedder when a key is present, else the local fallback.

    This is the seam that lets backfill populate a non-empty graph offline: with
    no ``OPENAI_API_KEY`` it degrades to the deterministic local embedder.
    """
    if settings.openai_api_key:
        return OpenAIEmbedder(
            api_key=settings.openai_api_key,
            model=settings.embedding_model,
            dim=settings.embedding_dim,
        )
    return LocalHashEmbedder(dim=settings.embedding_dim)
