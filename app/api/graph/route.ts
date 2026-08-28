import { NextResponse } from "next/server";
import { getGraphData, getArticles } from "@/lib/news/store";
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

    // Fall back to mock data if store is empty
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

    return NextResponse.json(graphData);
  } catch (error) {
    console.error("Error in /api/graph:", error);
    // Graceful fallback
    return NextResponse.json(mockGraphData);
  }
}
