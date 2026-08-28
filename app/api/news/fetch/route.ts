import { NextRequest, NextResponse } from "next/server";
import { fetchFromAllSources } from "@/lib/news/fetcher";
import { saveArticles, saveEdges, saveDailySummary, savePathways } from "@/lib/news/store";
import { batchSummarize } from "@/lib/ai/summarizer";
import { extractRelationships } from "@/lib/ai/relationship-extractor";
import { generateDailySummary } from "@/lib/ai/daily-summary-generator";
import { analyzePathways } from "@/lib/ai/pathway-analyzer";

export async function POST(request: NextRequest) {
  // Authenticate: require CRON_SECRET to be set and match the auth header
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Step 1: Fetch articles from all sources
    const articles = await fetchFromAllSources();

    if (articles.length === 0) {
      return NextResponse.json(
        { message: "No articles fetched from sources", count: 0 },
        { status: 200 }
      );
    }

    // Step 2: Summarize articles using AI
    const summaries = await batchSummarize(articles);
    for (let i = 0; i < articles.length; i++) {
      articles[i].summary = summaries[i];
    }

    // Step 3: Save articles to store
    saveArticles(articles);

    // Step 4: Extract relationships between articles
    const edges = await extractRelationships(articles);
    saveEdges(edges);

    // Step 5: Generate daily summary
    const today = new Date().toISOString().split("T")[0];
    const dailySummary = await generateDailySummary(articles, today);
    saveDailySummary(dailySummary);

    // Step 6: Analyze pathways
    const pathways = await analyzePathways(articles);
    savePathways(pathways);

    return NextResponse.json({
      message: "Successfully fetched and processed articles",
      count: articles.length,
      edges: edges.length,
      pathways: pathways.length,
    });
  } catch (error) {
    console.error("Error in /api/news/fetch:", error);
    return NextResponse.json(
      { error: "Failed to fetch and process news", detail: String(error) },
      { status: 500 }
    );
  }
}
