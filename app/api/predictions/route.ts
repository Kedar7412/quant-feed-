import { NextResponse } from "next/server";
import { getPredictions } from "@/lib/news/store";
import { mockPredictions, applyPredictionExpiry } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let predictions = getPredictions();

    // Track whether we are serving sample data (store empty)
    let dataSource: "live" | "sample" = "live";

    // Fall back to mock data if store is empty
    if (predictions.length === 0) {
      predictions = mockPredictions;
      dataSource = "sample";
    }

    // Mark any active prediction past its target date as expired so stale
    // forecasts never read as live bets.
    predictions = applyPredictionExpiry(predictions);

    // Calculate accuracy metrics
    const total = predictions.length;
    const active = predictions.filter((p) => p.status === "active").length;
    const correct = predictions.filter((p) => p.status === "correct").length;
    const incorrect = predictions.filter((p) => p.status === "incorrect").length;
    const resolved = correct + incorrect;
    const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;

    const expired = predictions.filter((p) => p.status === "expired").length;

    return NextResponse.json({
      predictions,
      dataSource,
      metrics: {
        total,
        active,
        correct,
        incorrect,
        expired,
        accuracy,
      },
    });
  } catch (error) {
    console.error("Error in /api/predictions:", error);
    // Graceful fallback
    const fallback = applyPredictionExpiry(mockPredictions);
    return NextResponse.json({
      predictions: fallback,
      dataSource: "sample" as const,
      metrics: {
        total: fallback.length,
        active: fallback.filter((p) => p.status === "active").length,
        correct: fallback.filter((p) => p.status === "correct").length,
        incorrect: fallback.filter((p) => p.status === "incorrect").length,
        expired: fallback.filter((p) => p.status === "expired").length,
        accuracy: 67,
      },
    });
  }
}
