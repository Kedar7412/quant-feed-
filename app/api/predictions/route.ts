import { NextResponse } from "next/server";
import { getPredictions } from "@/lib/news/store";
import { mockPredictions } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let predictions = getPredictions();

    // Fall back to mock data if store is empty
    if (predictions.length === 0) {
      predictions = mockPredictions;
    }

    // Calculate accuracy metrics
    const total = predictions.length;
    const active = predictions.filter((p) => p.status === "active").length;
    const correct = predictions.filter((p) => p.status === "correct").length;
    const incorrect = predictions.filter((p) => p.status === "incorrect").length;
    const resolved = correct + incorrect;
    const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;

    return NextResponse.json({
      predictions,
      metrics: {
        total,
        active,
        correct,
        incorrect,
        accuracy,
      },
    });
  } catch (error) {
    console.error("Error in /api/predictions:", error);
    // Graceful fallback
    return NextResponse.json({
      predictions: mockPredictions,
      metrics: {
        total: mockPredictions.length,
        active: mockPredictions.filter((p) => p.status === "active").length,
        correct: mockPredictions.filter((p) => p.status === "correct").length,
        incorrect: mockPredictions.filter((p) => p.status === "incorrect").length,
        accuracy: 67,
      },
    });
  }
}
