import { NextResponse } from "next/server";
import { getLatestSummary, getPathways } from "@/lib/news/store";
import { getCachedLiveNews } from "@/lib/news/live-cache";
import { generateDailySummary } from "@/lib/ai/daily-summary-generator";
import { mockDailySummary, mockPathways } from "@/lib/mock-data";
import { DailySummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Track whether the summary is real (live/computed) or sample data.
    let dataSource: "live" | "sample" = "live";
    let summary: DailySummary | null = null;

    // Live-fetch-first: compute today's summary from freshly fetched articles
    // so the dashboard reflects current news even when the /tmp store is empty
    // (the common Vercel serverless case). generateDailySummary already has a
    // key-free deterministic fallback when OPENAI_API_KEY is absent, so the
    // computed summary is always available from live articles.
    try {
      const liveArticles = await getCachedLiveNews();
      if (liveArticles.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        summary = await generateDailySummary(liveArticles, today);
        dataSource = "live";
      }
    } catch (error) {
      console.error("Error computing live analysis summary:", error);
    }

    // Fall back to a /tmp-persisted summary if live computation was empty.
    if (!summary) {
      const stored = getLatestSummary();
      if (stored) {
        summary = stored;
        dataSource = "live";
      }
    }

    // Fall back to mock data only when no live/computed/stored summary exists.
    if (!summary) {
      summary = mockDailySummary;
      dataSource = "sample";
    }

    let pathways = getPathways();
    if (pathways.length === 0) {
      pathways = mockPathways;
    }

    return NextResponse.json(
      {
        summary,
        pathways,
        dataSource,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error in /api/analysis:", error);
    // Graceful fallback
    return NextResponse.json({
      summary: mockDailySummary,
      pathways: mockPathways,
      dataSource: "sample" as const,
    });
  }
}
