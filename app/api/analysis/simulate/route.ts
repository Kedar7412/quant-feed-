import { NextResponse } from "next/server";
import { analyzePathways } from "@/lib/ai/pathway-analyzer";
import { getArticles } from "@/lib/news/store";
import { mockArticles, mockPathways } from "@/lib/mock-data";
import { NewsArticle } from "@/lib/types";

// Simple in-memory rate limiter: max 20 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20;

const requestCounts = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    // Rate limiting to prevent abuse of OpenAI calls
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { articleIds } = body as { articleIds: string[] };

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json(
        { error: "Please provide an array of articleIds" },
        { status: 400 }
      );
    }

    // Get articles from store, falling back to mock data
    let allArticles: NewsArticle[] = getArticles();
    if (allArticles.length === 0) {
      allArticles = mockArticles;
    }

    const selectedArticles = allArticles.filter((a) =>
      articleIds.includes(a.id)
    );

    if (selectedArticles.length === 0) {
      return NextResponse.json(
        { error: "No matching articles found for given IDs" },
        { status: 404 }
      );
    }

    // Analyze pathways based on selected articles
    const pathways = await analyzePathways(selectedArticles);

    // If AI analysis returned nothing, provide mock pathways
    if (pathways.length === 0) {
      return NextResponse.json({
        pathways: mockPathways.slice(0, 2),
        source: "fallback",
        articlesAnalyzed: selectedArticles.length,
      });
    }

    return NextResponse.json({
      pathways,
      source: process.env.OPENAI_API_KEY ? "ai" : "heuristic",
      articlesAnalyzed: selectedArticles.length,
    });
  } catch (error) {
    console.error("Error in /api/analysis/simulate:", error);
    return NextResponse.json(
      { error: "Failed to simulate pathways", detail: String(error) },
      { status: 500 }
    );
  }
}
