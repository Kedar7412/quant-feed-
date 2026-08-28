import { NextResponse } from "next/server";
import { getGraphData, getArticles, saveArticles, saveEdges } from "@/lib/news/store";
import { fetchLiveNews } from "@/lib/news/fetcher";
import { extractRelationships } from "@/lib/ai/relationship-extractor";
import { mockGraphData } from "@/lib/mock-data";
import { GraphData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

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
    }

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
      const articles = getArticles();
      const articleMap = new Map(articles.map((a) => [a.id, a]));

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

    return NextResponse.json(graphData, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error in /api/graph:", error);
    // Graceful fallback
    return NextResponse.json(mockGraphData);
  }
}
