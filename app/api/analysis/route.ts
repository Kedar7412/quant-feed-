import { NextResponse } from "next/server";
import { getLatestSummary, getPathways } from "@/lib/news/store";
import { mockDailySummary, mockPathways } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let summary = getLatestSummary();
    let pathways = getPathways();

    // Track whether the summary is real (from the store) or sample data.
    let dataSource: "live" | "sample" = "live";

    // Fall back to mock data if store is empty
    if (!summary) {
      summary = mockDailySummary;
      dataSource = "sample";
    }

    if (pathways.length === 0) {
      pathways = mockPathways;
    }

    return NextResponse.json({
      summary,
      pathways,
      dataSource,
    });
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
