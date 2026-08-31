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
