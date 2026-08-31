# QuantFeed - AI-Powered Economic Intelligence

An AI-powered news analysis platform that visualizes economic interconnections as a neural network graph, providing pathway predictions from micro to macro economics for the Indian and global economy.

## Overview

QuantFeed aggregates news from Indian (local + national) and international sources, summarizes them using AI, and presents the economic linkages between events as an interactive force-directed graph. Users can explore how different news events connect, simulate economic pathways, and track quantifiable predictions.

## Features

- **Neural Network Graph**: Interactive force-directed visualization showing how news articles are economically linked. Nodes colored by category (domestic, international, economic, political), with edges representing causal relationships.
- **AI Daily Analysis**: Automated economic summary covering micro to macro signals with key takeaways and economic indicators.
- **Pathway Simulator**: Interactive tool where users can toggle news events on/off and see how predicted economic pathways change in real-time.
- **News Feed**: Filterable, categorized news articles from Indian Local, Indian National, and International sources with economic impact scores.
- **Predictions Tracker**: Historical and active predictions with confidence scores, accuracy tracking, and outcome verification for fact-checking.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Graph Visualization**: react-force-graph-2d
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Deployment**: Vercel

## Architecture

```
app/                    # Next.js App Router pages
  page.tsx              # Dashboard - daily summary and key metrics
  network/page.tsx      # Force-directed graph visualization
  news/page.tsx         # Filterable news feed
  analysis/page.tsx     # AI analysis with pathway simulator
  predictions/page.tsx  # Prediction tracking and accuracy
  api/                  # API routes (backend processing)

components/             # Reusable React components
  NetworkGraph.tsx      # Force-directed graph with controls
  NewsCard.tsx          # Article display card
  PathwaySimulator.tsx  # Interactive pathway simulation
  DailySummary.tsx      # Economic summary display
  Sidebar.tsx           # Navigation sidebar

lib/                    # Utilities and data
  types.ts              # TypeScript interfaces
  mock-data.ts          # Development mock data
```

## Backend: Graph/Vector Backbone (Step 1)

An optional Python **FastAPI + Celery** backend provides a durable, queryable,
entity-aware graph + vector backbone (Neo4j + Qdrant + Postgres) that can serve
the network graph in place of the built-in live-fetch computation. It lives in
[`backend/`](./backend) — see [`backend/README.md`](./backend/README.md) for
local dev, backfill, environment variables, and production deployment
(Neo4j Aura / Qdrant Cloud / Railway·Render·Fly.io).

Integration is opt-in and safe: set `BACKEND_URL` on the frontend to proxy
`/api/graph` to the backend. When it is unset (or the backend is unreachable),
the frontend falls back to its existing live-fetch behavior, so the deployed
prototype never breaks.

## Step 2: custom WebGL engine + real-time WS diffs

Step 2 replaces the prototype's `react-force-graph-3d` network view with a
custom **React Three Fiber / Three.js** engine and adds an optional real-time
graph stream. The architecture:

- **Instanced WebGL engine** — nodes render as a single `InstancedMesh` (one
  draw call) backed by pre-allocated typed-array scene buffers in a vanilla
  Zustand store (`lib/graph3d/`). Each node owns a stable "slot"; a free-list
  recycles slots on removal so filter churn never leaks capacity (the prototype
  leaked here). A DOM HUD overlays the canvas.
- **Web-worker force sim** — `d3-force-3d` runs in a Web Worker
  (`lib/graph3d/forceWorker.worker.ts`); tick positions are scattered into the
  shared position buffer off the React render path.
- **Zustand outside React** — the store is created with `zustand/vanilla` so the
  render loop and worker mutate scene buffers imperatively without triggering
  React re-renders; only the HUD subscribes to selector slices.
- **Real-time WS diffs (optional)** — a FastAPI WebSocket gateway
  (`/ws/graph`, backend `app/routers/ws.py`) fans out incremental graph diffs
  `{ addedNodes, removedNodes, updatedEdges }` published over Redis pub/sub by
  the ingestion task. Each client subscribes with its current filters and the
  gateway forwards ONLY diffs intersecting that client's view (server-side
  predicate reusing the REST filter rules). The frontend client
  (`lib/realtime/graphSocket.ts`) does one initial `/api/graph` load, then
  streams diffs into the store via `applyDiff`, reconnects with capped
  exponential backoff, re-syncs on reconnect, and sends `filter-update` messages
  when the HUD filters change.
- **Graceful fallback** — realtime is gated entirely on `NEXT_PUBLIC_WS_URL`
  (frontend) and `REALTIME_ENABLED` (backend), both **unset/off by default**.
  With them unset, no WebSocket is ever constructed and the `/network` page
  renders from `/api/graph` exactly as before — real-time is purely additive.

**What can be validated in this environment**: the store/diff logic, the WS
gateway predicate, the client's diff-apply + backoff + filter contract, and a
headless canvas-mount smoke are all covered by `bun test` and
`cd backend && uv run pytest`. **What needs your real browser + GPU**: 60 FPS
rendering and visual correctness of the instanced scene (cannot be measured
headless). **What needs managed Redis + a deployed backend**: the live
end-to-end WS loop (ingestion → Redis pub/sub → gateway → browser). Set
`NEXT_PUBLIC_WS_URL` to your gateway URL and `REALTIME_ENABLED=true` +
`REDIS_URL` on the backend to exercise it live.

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: use nvm)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Kedar7412/quant-feed-.git
cd quant-feed-

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Add your API keys to .env.local
# NEWS_API_KEY - for fetching news articles
# OPENAI_API_KEY - for AI analysis and summarization
# DATABASE_URL - for storing articles and predictions
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Deployment

This project is configured for deployment on Vercel:

1. Push your code to GitHub
2. Connect the repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## How It Works

1. **News Collection**: Articles are fetched from multiple Indian and international news sources
2. **AI Summarization**: Each article is summarized to save space while preserving key economic signals
3. **Relationship Mapping**: AI identifies economic linkages between articles (causal, correlative, sector-based)
4. **Graph Construction**: Articles become nodes, relationships become edges in the neural network
5. **Pathway Analysis**: AI predicts economic pathways from micro events to macro outcomes
6. **Prediction Tracking**: Quantifiable predictions are logged and tracked for accuracy over time
7. **User Exploration**: Users can fact-check, simulate scenarios, and explore interconnections

## Categories

- **Domestic**: Indian local and national news (green nodes)
- **International**: Global news affecting India (blue nodes)
- **Economic**: Financial, market, and monetary policy news (amber nodes)
- **Political**: Policy, governance, and geopolitical news (red nodes)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

ISC
