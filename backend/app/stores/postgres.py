"""Postgres system-of-record via SQLAlchemy 2.0.

Defines the relational models (Article, Entity, ArticleEntity join, Edge) that
mirror the graph/vector stores and act as the durable source of truth. Provides
an engine, a session factory, and a ``get_session`` FastAPI dependency.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    select,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.engine import Engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.config import get_settings


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class Article(Base):
    """A news article; the relational source-of-record for graph nodes."""

    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    subcategory: Mapped[str | None] = mapped_column(String(128), nullable=True)
    economic_impact_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    is_live_data: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    entities: Mapped[list[ArticleEntity]] = relationship(
        back_populates="article", cascade="all, delete-orphan"
    )


class Entity(Base):
    """A named entity extracted from articles."""

    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    canonical: Mapped[str | None] = mapped_column(String(512), nullable=True)

    articles: Mapped[list[ArticleEntity]] = relationship(
        back_populates="entity", cascade="all, delete-orphan"
    )


class ArticleEntity(Base):
    """Join table linking articles to the entities they mention."""

    __tablename__ = "article_entities"
    __table_args__ = (UniqueConstraint("article_id", "entity_id", name="uq_article_entity"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[str] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_id: Mapped[int] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True
    )

    article: Mapped[Article] = relationship(back_populates="entities")
    entity: Mapped[Entity] = relationship(back_populates="articles")


class Edge(Base):
    """A weighted directed relationship between two articles.

    Mirrors the Neo4j ``[:RELATES_TO]`` edge. ``weight`` is the composite score
    that maps onto the frontend ``EconomicEdge.strength`` (0..1).
    """

    __tablename__ = "edges"
    __table_args__ = (
        UniqueConstraint("source_article_id", "target_article_id", name="uq_edge_source_target"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_article_id: Mapped[str] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_article_id: Mapped[str] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    semantic: Mapped[float | None] = mapped_column(Float, nullable=True)
    entity_overlap: Mapped[float | None] = mapped_column(Float, nullable=True)
    causal: Mapped[float | None] = mapped_column(Float, nullable=True)
    direction: Mapped[str | None] = mapped_column(String(32), nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    relationship: Mapped[str | None] = mapped_column(String(255), nullable=True)
    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


@lru_cache
def get_engine() -> Engine:
    """Return a cached SQLAlchemy engine bound to ``DATABASE_URL``."""
    settings = get_settings()
    return create_engine(settings.database_url, pool_pre_ping=True, future=True)


@lru_cache
def _get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), class_=Session, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a scoped SQLAlchemy session."""
    session = _get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


class PostgresRelationalStore:
    """Idempotent Postgres writer implementing the orchestrator ``RelationalStore``.

    Each method upserts by natural key (article id, entity canonical name,
    source/target article pair) so a second ingestion run does not create
    duplicate rows.

    Commit granularity
    ------------------
    Set ``autocommit=True`` (the default) to commit after every upsert, which
    keeps single-write callers simple. For a backfill at scale, pass
    ``autocommit=False`` so each write only ``flush``es (assigning autoincrement
    ids while staying in one transaction) and the caller invokes
    :meth:`commit` once per article or per run, collapsing thousands of tiny
    transactions into a handful. Either way the natural-key upserts remain
    idempotent.
    """

    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._session = session
        self._autocommit = autocommit

    def _sync(self) -> None:
        """Commit when autocommitting, else flush to assign ids within the txn."""
        if self._autocommit:
            self._session.commit()
        else:
            self._session.flush()

    def commit(self) -> None:
        """Commit the current transaction (used when ``autocommit=False``)."""
        self._session.commit()

    def upsert_article(self, row: dict[str, Any]) -> None:
        article = self._session.get(Article, row["id"])
        if article is None:
            article = Article(**row)
            self._session.add(article)
        else:
            for key, value in row.items():
                setattr(article, key, value)
        self._sync()

    def upsert_entity(self, row: dict[str, Any]) -> int:
        stmt = select(Entity).where(Entity.name == row["name"])
        entity = self._session.execute(stmt).scalar_one_or_none()
        if entity is None:
            entity = Entity(**row)
            self._session.add(entity)
        else:
            entity.label = row.get("label")
            entity.canonical = row.get("canonical")
        self._sync()
        return entity.id

    def link_article_entity(self, article_id: str, entity_id: int) -> None:
        stmt = select(ArticleEntity).where(
            ArticleEntity.article_id == article_id,
            ArticleEntity.entity_id == entity_id,
        )
        existing = self._session.execute(stmt).scalar_one_or_none()
        if existing is None:
            self._session.add(ArticleEntity(article_id=article_id, entity_id=entity_id))
            self._sync()

    def upsert_edge(self, row: dict[str, Any]) -> None:
        stmt = select(Edge).where(
            Edge.source_article_id == row["source_article_id"],
            Edge.target_article_id == row["target_article_id"],
        )
        edge = self._session.execute(stmt).scalar_one_or_none()
        if edge is None:
            edge = Edge(**row)
            self._session.add(edge)
        else:
            for key, value in row.items():
                setattr(edge, key, value)
        self._sync()
