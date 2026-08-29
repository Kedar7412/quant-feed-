# Quant Feed Backend

Python FastAPI + Celery service providing the graph + vector + relational
backbone for Quant Feed. This replaces the ephemeral in-memory relationship
computation with durable, queryable stores:

- **Neo4j** — entity-aware article relationship graph (`RELATES_TO` edges).
- **Qdrant** — article embeddings for semantic similarity (`article_embeddings`).
- **Postgres** — relational system-of-record (articles, entities, edges).
- **Redis** — Celery broker/backend for periodic ingestion.

> This is the foundation (FEAT-001). NLP/NER, embeddings, and relationship
> scoring land in FEAT-002; the backfill script and API query surface in later
> features. Full documentation lands in FEAT-004.

## Requirements

- [uv](https://docs.astral.sh/uv/) (manages the Python 3.11 toolchain)
- Docker + Docker Compose (local datastore stack)

## Setup

```bash
cd backend
uv python install 3.11   # if not already installed
uv sync                  # create the venv and install deps
cp .env.example .env      # then fill in secrets (OPENAI_API_KEY, etc.)
```

## Local datastore stack

```bash
docker compose -f docker-compose.yml up -d neo4j qdrant postgres redis
uv run alembic upgrade head          # create Postgres tables
uv run python -c "from app.stores.neo4j_store import Neo4jStore; from app.config import get_settings; s=Neo4jStore(get_settings()); s.init_schema(); s.close()"
```

Tear down with `docker compose -f docker-compose.yml down`.

## Run the API

```bash
uv run uvicorn app.main:app --reload
```

`GET /health` reports best-effort status of each datastore.

## Quality gates

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest
```
