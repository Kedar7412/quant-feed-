import { fetchFromAllSources } from "./fetcher";
import { saveArticles, saveEdges, saveDailySummary, savePathways } from "./store";
import { batchSummarize } from "@/lib/ai/summarizer";
import { extractRelationships } from "@/lib/ai/relationship-extractor";
import { generateDailySummary } from "@/lib/ai/daily-summary-generator";
import { analyzePathways } from "@/lib/ai/pathway-analyzer";

export interface SchedulerResult {
  success: boolean;
  articlesProcessed: number;
  edgesCreated: number;
  pathwaysGenerated: number;
  error?: string;
}

/**
 * Main scheduler function - fetches, processes, and stores news.
 * Designed to be called by a Vercel cron job endpoint.
 */
export async function runScheduledFetch(): Promise<SchedulerResult> {
  try {
    // Fetch articles from all configured RSS sources
    const articles = await fetchFromAllSources();

    if (articles.length === 0) {
      return {
        success: true,
        articlesProcessed: 0,
        edgesCreated: 0,
        pathwaysGenerated: 0,
      };
    }

    // AI summarization
    const summaries = await batchSummarize(articles);
    for (let i = 0; i < articles.length; i++) {
      articles[i].summary = summaries[i];
    }

    // Persist articles
    saveArticles(articles);

    // Extract economic relationships
    const edges = await extractRelationships(articles);
    saveEdges(edges);

    // Generate daily summary
    const today = new Date().toISOString().split("T")[0];
    const dailySummary = await generateDailySummary(articles, today);
    saveDailySummary(dailySummary);

    // Analyze economic pathways
    const pathways = await analyzePathways(articles);
    savePathways(pathways);

    return {
      success: true,
      articlesProcessed: articles.length,
      edgesCreated: edges.length,
      pathwaysGenerated: pathways.length,
    };
  } catch (error) {
    console.error("Scheduler error:", error);
    return {
      success: false,
      articlesProcessed: 0,
      edgesCreated: 0,
      pathwaysGenerated: 0,
      error: String(error),
    };
  }
}
