import { NextResponse } from "next/server";
import { getArticles, saveArticles } from "@/lib/news/store";
import { getCachedLiveNews } from "@/lib/news/live-cache";
import { mockArticles } from "@/lib/mock-data";
import { computeFreshnessScore, computeRelevanceScore } from "@/lib/freshness/recency-scorer";
import { buildTopicCorrelations } from "@/lib/freshness/topic-tracker";
import { NewsArticle } from "@/lib/types";

/**
 * Build a map from articleId -> its cluster's changeVelocity so relevance
 * scoring can use the real topic velocity from the correlation engine instead
 * of a tag-count proxy. Articles not in any cluster get velocity 0.
 */
function buildVelocityMap(articles: NewsArticle[]): Map<string, number> {
  const velocityMap = new Map<string, number>();
  const correlations = buildTopicCorrelations(articles);
  for (const correlation of correlations) {
    for (const id of correlation.articleIds) {
      // Keep the highest velocity if an article maps to multiple clusters
      const existing = velocityMap.get(id) ?? 0;
      velocityMap.set(id, Math.max(existing, correlation.changeVelocity));
    }
  }
  return velocityMap;
}

/**
 * Score a set of articles: freshness, relevance (using real per-article topic
 * velocity from the correlation engine), and provenance. Each article keeps its
 * own `isLiveData` flag if it already carries one; otherwise it falls back to
 * whether this request performed a live fetch.
 */
function scoreArticles(
  articles: NewsArticle[],
  liveThisRequest: boolean
): NewsArticle[] {
  const velocityMap = buildVelocityMap(articles);
  return articles.map((article) => ({
    ...article,
    freshnessScore: computeFreshnessScore(article.publishedAt),
    relevanceScore: computeRelevanceScore(
      article,
      velocityMap.get(article.id) ?? 0
    ),
    // Preserve an already-set provenance flag; only fall back to the
    // request-level live status when the article doesn't declare one.
    isLiveData: article.isLiveData ?? liveThisRequest,
  }));
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const date = searchParams.get("date");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "relevance";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Track data source
    let dataSource: "live" | "cached" | "sample" = "cached";

    // Live-fetch-first: fetch fresh news on the request path, backed by a
    // short-lived in-process cache (see lib/news/live-cache.ts) so feeds are
    // not hammered. We do NOT gate on a /tmp timestamp because /tmp is
    // ephemeral on Vercel serverless and cannot be relied on for freshness.
    let articles: NewsArticle[] = [];
    try {
      const liveArticles = await getCachedLiveNews();
      if (liveArticles.length > 0) {
        articles = liveArticles;
        dataSource = "live";
        // Best-effort persist to /tmp for cross-request reuse within a warm
        // instance. Never depend on this succeeding or surviving a cold start.
        try {
          saveArticles(liveArticles);
        } catch (persistError) {
          console.error("Best-effort saveArticles failed:", persistError);
        }
      }
    } catch (error) {
      console.error("Live fetch failed, falling back to cache/mock:", error);
    }

    // If live fetch was empty, try any best-effort /tmp cache before sample.
    if (articles.length === 0) {
      const cached = getArticles();
      if (cached.length > 0) {
        articles = cached;
        dataSource = "cached";
      }
    }

    // Fall back to mock data only when both live fetch AND /tmp are empty.
    if (articles.length === 0) {
      articles = mockArticles;
      dataSource = "sample";
    }

    // Whether a live fetch actually populated results this request. Cached
    // (/tmp) or sample results must not inherit a live flag they didn't earn.
    const liveThisRequest = dataSource === "live";

    // Compute freshness and relevance scores for all articles
    articles = scoreArticles(articles, liveThisRequest);

    // Apply filters (search/date/category) against the in-memory article set so
    // filtering works uniformly for live, cached, and sample data.
    if (search) {
      const lowerSearch = search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(lowerSearch) ||
          a.summary.toLowerCase().includes(lowerSearch) ||
          a.tags.some((t) => t.toLowerCase().includes(lowerSearch))
      );
    }

    if (date) {
      articles = articles.filter((a) => a.publishedAt.startsWith(date));
    }

    if (category && category !== "all") {
      articles = articles.filter((a) => a.category === category);
    }

    // Sort based on requested sort order (default: relevance)
    if (sort === "date") {
      articles.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else if (sort === "impact") {
      articles.sort((a, b) => b.economicImpactScore - a.economicImpactScore);
    } else {
      // Default: sort by relevanceScore descending
      articles.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    // Paginate
    const total = articles.length;
    const startIndex = (page - 1) * limit;
    const paginatedArticles = articles.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      {
        articles: paginatedArticles,
        dataSource,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error in /api/news:", error);
    // Graceful fallback to mock data with scores
    const scored = scoreArticles(mockArticles, false);
    return NextResponse.json({
      articles: scored,
      dataSource: "sample" as const,
      pagination: {
        page: 1,
        limit: 20,
        total: scored.length,
        totalPages: 1,
      },
    });
  }
}
