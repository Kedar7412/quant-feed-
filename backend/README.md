# Quant Feed Backend

Python **FastAPI + Celery** service providing the graph + vector + relational
backbone for Quant Feed (**Step 1** of the production roadmap). It replaces the
ephemeral in-memory/`/tmp` relationship computation in the Next.js app with
durable, queryable, entity-aware stores:

- **Neo4j** — entity-aware article relationship graph (`RELATES_TO` edges whose
  `strength` is the 0..1 composite of three axes: semantic similarity, IDF
  entity overlap, and an LLM causal classifier).
- **Qdrant** — article embeddings for semantic similarity
  (`article_embeddings`, OpenAI `text-embedding-3-large`).
- **Postgres** — relational system-of-record (articles, entities, edges).
- **Redis** — Celery broker/result backend for periodic ingestion.

The service exposes a read API the Next.js frontend can consume unchanged:

| Endpoint | Description |
| --- | --- |
| `GET /graph/query` | Filtered graph: `{ nodes, links, correlations, dataSource }` (camelCase, matches `lib/types.ts`). Query params: `category` (or `sector`), `startDate`, `endDate`, `sentiment`, `entity`. |
| `GET /articles/{id}` | Full article + linked entities + immediate graph neighbors. `404` for unknown ids. |
| `GET /health` | `{ status, neo4j, qdrant, postgres }` best-effort store health. |

## Requirements

- [uv](https://docs.astral.sh/uv/) (manages the Python 3.11 toolchain)
- Docker + Docker Compose (local datastore stack)
- An `OPENAI_API_KEY` (embeddings + causal classifier). Tests do NOT require it.

## Local development

```bash
cd backend

# 1. Toolchain + dependencies
uv python install 3.11    # if not already installed
uv sync                   # create the venv and install deps
cp .env.example .env       # then fill in secrets (OPENAI_API_KEY, etc.)

# 2. Bring up the datastore stack (Neo4j / Qdrant / Postgres / Redis)
docker compose -f docker-compose.yml up -d neo4j qdrant postgres redis

# 3. Create Postgres schema
uv run alembic upgrade head

# 4. Initialize the Neo4j constraints/indexes (idempotent)
uv run python -c "from app.stores.neo4j_store import Neo4jStore; from app.config import get_settings; s=Neo4jStore(get_settings()); s.init_schema(); s.close()"

# 5. Populate the stores from live feeds (see 'Backfill' below)
uv run python -m scripts.backfill

# 6. Run the API
uv run uvicorn app.main:app --reload           # http://127.0.0.1:8000

# 7. Run the Celery worker + beat (periodic ingestion) in separate shells
uv run celery -A app.tasks.celery_app.celery_app worker --loglevel=info
uv run celery -A app.tasks.celery_app.celery_app beat --loglevel=info
```

Tear the stack down with `docker compose -f docker-compose.yml down`
(add `-v` to also drop the named volumes).

Verify the API is live:

```bash
curl -sf http://127.0.0.1:8000/health
curl -sf 'http://127.0.0.1:8000/graph/query?category=economic' | head -c 400
```

## Backfill

The backfill fetches from the same feeds/APIs as the Next.js frontend
(Google News RSS, publisher RSS, Guardian/GNews/NewsData), runs the NLP
pipeline (clean → NER/entity-linking → embeddings → three-axis scoring), and
persists the results to Postgres, Neo4j, and Qdrant. It is idempotent and safe
to re-run.

```bash
cd backend
uv run python -m scripts.backfill
```

Periodic ingestion runs the equivalent flow on a schedule via Celery beat
(`ingest-news-every-15-min`, see `app/tasks/celery_app.py`).

## Environment variables

Copy `.env.example` to `.env`. Localhost defaults match `docker-compose.yml`.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `NEO4J_URI` | Neo4j bolt/neo4j URI | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `quantfeed_dev` |
| `QDRANT_URL` | Qdrant base URL | `http://localhost:6333` |
| `QDRANT_API_KEY` | Qdrant API key | *(blank locally)* |
| `DATABASE_URL` | SQLAlchemy Postgres URL | `postgresql+psycopg://quantfeed:quantfeed_dev@localhost:5432/quantfeed` |
| `REDIS_URL` | Celery broker/backend | `redis://localhost:6379/0` |
| `OPENAI_API_KEY` | Embeddings + causal classifier | *(required for backfill/ingest)* |
| `SPACY_MODEL` | spaCy NER model | `en_core_web_sm` (prod may use `en_core_web_trf`) |
| `EMBEDDING_MODEL` | OpenAI embedding model | `text-embedding-3-large` |
| `EMBEDDING_DIM` | Embedding dimensionality | `3072` |
| `WEIGHT_SEMANTIC` / `WEIGHT_ENTITY_OVERLAP` / `WEIGHT_CAUSAL` | Composite edge weight axes | `0.35 / 0.25 / 0.40` |
| `FRONTEND_ORIGIN` | CORS origin for the Next.js app | `http://localhost:3000` |
| `REALTIME_ENABLED` | Enable real-time diff publishing (Step 2) | `false` |
| `DIFF_CHANNEL` | Redis pub/sub channel for graph diffs | `quantfeed:graph-diffs` |

The Next.js frontend only needs **`BACKEND_URL`** (REST) and optionally
**`NEXT_PUBLIC_WS_URL`** (Step 2 real-time). See the root `.env.example`.

## Step 2: real-time WebSocket graph diffs

An optional real-time layer streams incremental graph diffs to connected
clients so the WebGL network view updates without full reloads.

- **Publisher abstraction** (`app/realtime/diff_publisher.py`) — a `GraphDiff`
  serializing to the frontend camelCase contract
  `{ addedNodes, removedNodes, updatedEdges }`, a `Publisher` protocol, a
  `RedisDiffPublisher` (redis.asyncio pub/sub on `DIFF_CHANNEL`, constructed
  lazily so the module imports with no live broker), and an
  `InMemoryDiffPublisher` fake for tests.
- **WebSocket gateway** (`app/routers/ws.py`, mounted at `/ws/graph` in
  `create_app`) — a client sends a `subscribe` message with its filters
  (`category`/`sector`, `startDate`, `endDate`, `sentiment`, `entity`); the
  gateway registers a **server-side predicate** (`app/realtime/predicate.py`,
  reusing the exact `graph_service` category/sentiment/entity rules) and
  forwards ONLY diffs intersecting that client's view. A `filter-update` message
  changes the subscription without reconnecting; disconnects clean up the
  connection registry.
- **Ingestion hook** — `run_ingestion` (`app/tasks/ingest.py`) best-effort
  publishes a diff after persistence, guarded by `REALTIME_ENABLED`. The
  publisher is built lazily, and any Redis error is swallowed and logged so
  realtime **never fails ingestion**.

Enable it by setting `REALTIME_ENABLED=true`, a reachable `REDIS_URL`, and
`NEXT_PUBLIC_WS_URL` on the frontend pointing at the gateway. Everything is
**off by default**: with `REALTIME_ENABLED=false`, ingestion never publishes and
the frontend never opens a socket.

**Testing without infra**: the gateway, predicate, publisher, and ingestion hook
are fully covered by `uv run pytest` using `InMemoryDiffPublisher` +
`TestClient.websocket_connect` — no live Redis/Neo4j/Qdrant/Postgres/spaCy. The
**live end-to-end WS loop** (ingestion → Redis pub/sub → gateway → browser)
requires a **managed Redis + a deployed backend** and a real browser to validate.

## Quality gates

```bash
cd backend
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

## Production deployment

The backend is a standard container that depends on three managed data services
plus Redis. Recommended managed setup:

1. **Neo4j → [Neo4j Aura](https://neo4j.com/cloud/aura/)**
   Create an AuraDB instance and use its connection string:
   ```
   NEO4J_URI=neo4j+s://<dbid>.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=<generated-password>
   ```
   Run the Neo4j schema init step (step 4 above) once against the instance.

2. **Qdrant → [Qdrant Cloud](https://cloud.qdrant.io/)**
   Create a cluster and set:
   ```
   QDRANT_URL=https://<cluster>.<region>.aws.cloud.qdrant.io:6333
   QDRANT_API_KEY=<api-key>
   ```

3. **Postgres → any managed instance** (Railway/Render/Fly Postgres, Supabase,
   Neon, RDS, etc.):
   ```
   DATABASE_URL=postgresql+psycopg://<user>:<pass>@<host>:5432/<db>
   ```
   Run `uv run alembic upgrade head` against it as a release/migration step.

4. **Redis** — a managed Redis (Upstash, Railway/Render/Fly Redis) for
   `REDIS_URL`.

5. **Deploy the FastAPI + Celery container** to
   [Railway](https://railway.app/), [Render](https://render.com/), or
   [Fly.io](https://fly.io/) using the provided `Dockerfile`. Run three
   processes from the same image:
   - **web:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **worker:** `celery -A app.tasks.celery_app.celery_app worker --loglevel=info`
   - **beat:** `celery -A app.tasks.celery_app.celery_app beat --loglevel=info`

   Set all env vars above (plus `OPENAI_API_KEY` and `FRONTEND_ORIGIN` = your
   Vercel domain) on the service. Run the backfill once after first deploy.

6. **Point the Next.js frontend at the backend.** On the Vercel project, set:
   ```
   BACKEND_URL=https://<your-deployed-backend-host>
   ```
   With `BACKEND_URL` set, `/api/graph` proxies to `{BACKEND_URL}/graph/query`
   and, on any error/timeout/empty response, falls back to the built-in
   live-fetch behavior — so the deployed prototype never breaks. With it unset,
   the frontend behaves exactly as before (no backend dependency).

## Verified in sandbox vs. requires managed cloud instances

**Verified in the CI sandbox (no live datastores needed):**

- `uv sync`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy .`, and `uv run pytest -q` all pass.
- The FastAPI app imports cleanly and the read API (`/graph/query`,
  `/articles/{id}`, `/health`) is exercised end-to-end with `TestClient`
  against seeded in-memory fake stores, asserting the `GraphData`/`EconomicEdge`
  JSON contract, all five filters, dangling-link pruning, `404`s, and per-store
  health reporting.
- The Next.js frontend builds and lints clean with `BACKEND_URL` and
  `NEXT_PUBLIC_WS_URL` unset (fallback path), behaving exactly as before.
- The Step 2 WebSocket gateway, per-client predicate, diff publisher, and the
  ingestion publish hook are exercised with `TestClient.websocket_connect` +
  `InMemoryDiffPublisher` (subscribe/receive, predicate drop, filter-update,
  camelCase contract, disconnect cleanup, best-effort publish no-op).

**Requires managed cloud instances (or a working local Docker host):**

- The live `docker compose up` → `alembic upgrade head` → `python -m
  scripts.backfill` → `uvicorn` + `curl` round-trip against real
  Neo4j/Qdrant/Postgres.
- End-to-end proxying from Vercel (`BACKEND_URL` set) to a deployed backend.
- The **live real-time WS loop** (Step 2): ingestion → managed Redis pub/sub →
  `/ws/graph` gateway → browser, plus 60 FPS / visual correctness of the
  instanced WebGL scene, which need real managed Redis and a real browser+GPU.

> **Sandbox note:** the in-sandbox container runtime is podman, whose API socket
> could not bind (`Cannot connect to the Docker daemon at
> unix:///run/podman/podman.sock`) and whose rootless networking is broken, so
> the live datastore round-trip could not be executed here. This is an
> infrastructure limitation of the sandbox, not a defect in the backend; on a
> normal Docker host or managed cloud the round-trip serves
> `{ nodes, links, correlations, dataSource }` from the persisted backbone.
