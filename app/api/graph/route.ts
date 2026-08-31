import { NextResponse } from "next/server";
import { getGraphData, getArticles, saveArticles, saveEdges } from "@/lib/news/store";
import { getCachedLiveNews } from "@/lib/news/live-cache";
import { extractRelationships } from "@/lib/ai/relationship-extractor";
import { mockGraphData, mockArticles } from "@/lib/mock-data";
import { GraphData, NewsArticle, EconomicNode } from "@/lib/types";
import { computeFreshnessScore } from "@/lib/freshness/recency-scorer";
import { buildTopicCorrelations } from "@/lib/freshness/topic-tracker";
import {
  isBackendEnabled,
  fetchGraphFromBackend,
  pingBackendHealthy,
} from "@/lib/backend-client";

export const dynamic = "force-dynamic";

// Category -> node placeholder image, mirrored between the backend-proxy branch
// and the live-fetch enrichment below so proxied nodes look identical to today.
const categoryPlaceholders: Record<string, string> = {
  domestic: "https://placehold.co/120x80/1a2e1a/22c55e?text=Domestic",
  international: "https://placehold.co/120x80/1a1a2e/3b82f6?text=Global",
  economic: "https://placehold.co/120x80/2e2a1a/f59e0b?text=Economic",
  political: "https://placehold.co/120x80/2e1a1a/ef4444?text=Political",
};

/**
 * Client-side node enrichment applied AFTER data is sourced (whether from the
 * backend proxy or the live-fetch path). The backend does not add
 * freshnessScore/imageUrl, so we compute them here just like the live path.
 */
function enrichNodes(
  nodes: EconomicNode[],
  articleMap: Map<string, NewsArticle>
): EconomicNode[] {
  return nodes.map((node) => {
    const article = articleMap.get(node.articleId);
    return {
      ...node,
      freshnessScore: article
        ? computeFreshnessScore(article.publishedAt)
        : node.freshnessScore ?? 0,
      url: article?.url ?? node.url,
      imageUrl:
        node.imageUrl ||
        categoryPlaceholders[node.category] ||
        "https://placehold.co/120x80/1a1a2e/6366f1?text=News",
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sentiment = searchParams.get("sentiment");
    const entity = searchParams.get("entity");

    // Backend-backed path (Step 1 graph/vector backbone), gated on BACKEND_URL.
    // A short /health pre-check runs first: a reachable-but-slow or down backend
    // costs at most the health budget (~800ms) instead of the full 4s graph
    // timeout on every request before falling back. Only when /health responds
    // 2xx in time do we proxy to /graph/query with the same filters. On a
    // non-empty graph, enrich nodes exactly like the live path and return
    // preserving the existing response shape + no-store headers. On
    // unhealthy/null/empty/error, fall through to the UNCHANGED live-fetch-first
    // -> /tmp -> mock logic below.
    if (isBackendEnabled() && (await pingBackendHealthy())) {
      try {
        const backendGraph = await fetchGraphFromBackend({
          category,
          startDate,
          endDate,
          sentiment,
          entity,
        });
        if (backendGraph && backendGraph.nodes && backendGraph.nodes.length > 0) {
          const backendArticleMap = new Map<string, NewsArticle>();
          const enriched: GraphData = {
            nodes: enrichNodes(backendGraph.nodes, backendArticleMap),
            links: backendGraph.links ?? [],
          };
          return NextResponse.json(
            {
              ...enriched,
              correlations: backendGraph.correlations ?? [],
              dataSource: backendGraph.dataSource ?? "live",
            },
            {
              headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
              },
            }
          );
        }
      } catch (error) {
        console.error("Backend graph proxy failed, falling back:", error);
      }
    }

    let dataSource: "live" | "cached" | "sample" = "cached";
    let graphData: GraphData = { nodes: [], links: [] };
    // Article set used to annotate nodes and build correlations below.
    let articles: NewsArticle[] = [];

    // Live-fetch-first: build the graph from freshly fetched articles so the
    // network reflects current news even when the /tmp store is empty (the
    // common Vercel serverless case). Falls back to /tmp, then sample data.
    try {
      const liveArticles = await getCachedLiveNews();
      if (liveArticles.length > 0) {
        articles = liveArticles;
        dataSource = "live";
        try {
          saveArticles(liveArticles);
        } catch (persistError) {
          console.error("Best-effort saveArticles failed:", persistError);
        }
        const edges = await extractRelationships(liveArticles);
        try {
          saveEdges(edges);
        } catch (persistError) {
          console.error("Best-effort saveEdges failed:", persistError);
        }
        graphData = getGraphData();
      }
    } catch (error) {
      console.error("Error generating live graph data:", error);
    }

    // Fall back to any /tmp-persisted graph data if the live fetch was empty.
    if (graphData.nodes.length === 0) {
      const stored = getGraphData();
      if (stored.nodes.length > 0) {
        graphData = stored;
        articles = getArticles();
        dataSource = "cached";
      }
    }

    // Final fallback to mock data if still empty.
    if (graphData.nodes.length === 0) {
      graphData = mockGraphData;
      articles = mockArticles;
      dataSource = "sample";
    }

    // Add freshnessScore to each node
    if (articles.length === 0) {
      articles = getArticles().length > 0 ? getArticles() : mockArticles;
    }
    const articleMap = new Map(articles.map((a) => [a.id, a]));

    graphData = {
      ...graphData,
      nodes: enrichNodes(graphData.nodes, articleMap),
    };

    // Filter by category
    if (category && category !== "all") {
      const filteredNodes = graphData.nodes.filter(
        (n) => n.category === category
      );
      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredLinks = graphData.links.filter(
        (l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
      );
      graphData = { nodes: filteredNodes, links: filteredLinks };
    }

    // Filter by date range
    if (startDate || endDate) {
      const filteredNodes = graphData.nodes.filter((node) => {
        const article = articleMap.get(node.articleId);
        if (!article) return true; // Keep nodes without articles
        const pubDate = new Date(article.publishedAt);
        if (startDate && pubDate < new Date(startDate)) return false;
        if (endDate && pubDate > new Date(endDate)) return false;
        return true;
      });

      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredLinks = graphData.links.filter(
        (l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
      );
      graphData = { nodes: filteredNodes, links: filteredLinks };
    }

    // Filter by sentiment (Step-1 approximation, symmetric with the backend).
    // There is no real sentiment signal yet, so both the backend
    // (services/graph_service.py) and this fallback derive it from the node's
    // economicImpactScore: >=7 positive, <=3 negative, else neutral. Keeping the
    // derivation identical means `?sentiment=` narrows the graph the same way
    // whether or not BACKEND_URL is set.
    if (sentiment) {
      const filteredNodes = graphData.nodes.filter((node) => {
        const score = node.economicImpactScore ?? node.val ?? 5;
        const derived =
          score >= 7 ? "positive" : score <= 3 ? "negative" : "neutral";
        return derived === sentiment;
      });
      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredLinks = graphData.links.filter(
        (l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
      );
      graphData = { nodes: filteredNodes, links: filteredLinks };
    }

    // Build topic correlations from available articles
    const correlations = buildTopicCorrelations(articles);

    return NextResponse.json(
      {
        ...graphData,
        correlations,
        dataSource,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error in /api/graph:", error);
    // Graceful fallback
    const correlations = buildTopicCorrelations(mockArticles);
    return NextResponse.json({
      ...mockGraphData,
      correlations,
      dataSource: "sample",
    });
  }
}
