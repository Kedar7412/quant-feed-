import { NextResponse } from "next/server";
import { getLatestSummary, getPathways } from "@/lib/news/store";
import { mockDailySummary, mockPathways } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let summary = getLatestSummary();
    let pathways = getPathways();

    // Fall back to mock data if store is empty
    if (!summary) {
      summary = mockDailySummary;
    }

    if (pathways.length === 0) {
      pathways = mockPathways;
    }

    return NextResponse.json({
      summary,
      pathways,
    });
  } catch (error) {
    console.error("Error in /api/analysis:", error);
    // Graceful fallback
    return NextResponse.json({
      summary: mockDailySummary,
      pathways: mockPathways,
    });
  }
}
