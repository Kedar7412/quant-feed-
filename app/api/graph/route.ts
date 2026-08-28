import { NextResponse } from "next/server";
import { getGraphData, getArticles, saveArticles, saveEdges } from "@/lib/news/store";
import { fetchLiveNews } from "@/lib/news/fetcher";
import { extractRelationships } from "@/lib/ai/relationship-extractor";
import { mockGraphData, mockArticles } from "@/lib/mock-data";
import { GraphData } from "@/lib/types";
import { computeFreshnessScore } from "@/lib/freshness/recency-scorer";
import { buildTopicCorrelations } from "@/lib/freshness/topic-tracker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let dataSource: "live" | "cached" | "sample" = "cached";
    let graphData: GraphData = getGraphData();

    // If graph store is empty, attempt to fetch live data and generate relationships
    if (graphData.nodes.length === 0) {
      try {
        let articles = getArticles();

        // If article store is also empty, try a live fetch
        if (articles.length === 0) {
          const liveArticles = await fetchLiveNews();
          if (liveArticles.length > 0) {
            saveArticles(liveArticles);
            articles = liveArticles;
            dataSource = "live";
          }
        }

        // Generate relationships from articles using tag-matching fallback
        if (articles.length > 0) {
          const edges = await extractRelationships(articles);
          saveEdges(edges);
          // Re-read graph data from store (now populated)
          graphData = getGraphData();
        }
      } catch (error) {
        console.error("Error generating live graph data:", error);
      }
    }

    // Final fallback to mock data if still empty
    if (graphData.nodes.length === 0) {
      graphData = mockGraphData;
      dataSource = "sample";
    }

    // Add freshnessScore to each node
    const articles = getArticles().length > 0 ? getArticles() : mockArticles;
    const articleMap = new Map(articles.map((a) => [a.id, a]));

    graphData = {
      ...graphData,
      nodes: graphData.nodes.map((node) => {
        const article = articleMap.get(node.articleId);
        return {
          ...node,
          freshnessScore: article
            ? computeFreshnessScore(article.publishedAt)
            : 0,
          url: article?.url,
        };
      }),
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
