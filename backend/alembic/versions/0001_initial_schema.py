"""initial schema: articles, entities, article_entities, edges

Revision ID: 0001
Revises:
Create Date: 2026-08-29 00:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "articles",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("category", sa.String(length=128), nullable=True),
        sa.Column("subcategory", sa.String(length=128), nullable=True),
        sa.Column("economic_impact_score", sa.Float(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("is_live_data", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "entities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=True),
        sa.Column("canonical", sa.String(length=512), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "article_entities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("article_id", sa.String(length=128), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entity_id"], ["entities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article_id", "entity_id", name="uq_article_entity"),
    )
    op.create_index(
        "ix_article_entities_article_id", "article_entities", ["article_id"], unique=False
    )
    op.create_index(
        "ix_article_entities_entity_id", "article_entities", ["entity_id"], unique=False
    )

    op.create_table(
        "edges",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_article_id", sa.String(length=128), nullable=False),
        sa.Column("target_article_id", sa.String(length=128), nullable=False),
        sa.Column("semantic", sa.Float(), nullable=True),
        sa.Column("entity_overlap", sa.Float(), nullable=True),
        sa.Column("causal", sa.Float(), nullable=True),
        sa.Column("direction", sa.String(length=32), nullable=True),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("relationship", sa.String(length=255), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["source_article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_article_id", "target_article_id", name="uq_edge_source_target"),
    )
    op.create_index("ix_edges_source_article_id", "edges", ["source_article_id"], unique=False)
    op.create_index("ix_edges_target_article_id", "edges", ["target_article_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_edges_target_article_id", table_name="edges")
    op.drop_index("ix_edges_source_article_id", table_name="edges")
    op.drop_table("edges")
    op.drop_index("ix_article_entities_entity_id", table_name="article_entities")
    op.drop_index("ix_article_entities_article_id", table_name="article_entities")
    op.drop_table("article_entities")
    op.drop_table("entities")
    op.drop_table("articles")
