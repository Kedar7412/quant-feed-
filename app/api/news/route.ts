import { NextResponse } from "next/server";
import { getArticles, saveArticles, searchArticles, getArticlesByDate, getLastFetchTimestamp, setLastFetchTimestamp } from "@/lib/news/store";
import { fetchLiveNews } from "@/lib/news/fetcher";
import { mockArticles } from "@/lib/mock-data";
import { computeFreshnessScore, computeRelevanceScore } from "@/lib/freshness/recency-scorer";
import { NewsArticle } from "@/lib/types";

export const dynamic = "force-dynamic";

// Minimum interval between live fetches (30 minutes in ms)
const FETCH_INTERVAL_MS = 30 * 60 * 1000;

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

    // Always attempt live fetch if enough time has passed since last fetch
    let articles = getArticles();
    const lastFetch = getLastFetchTimestamp();
    const now = Date.now();
    const shouldFetch = !lastFetch || (now - lastFetch) > FETCH_INTERVAL_MS;

    if (shouldFetch) {
      try {
        const liveArticles = await fetchLiveNews();
        if (liveArticles.length > 0) {
          saveArticles(liveArticles);
          setLastFetchTimestamp(now);
          // Re-read merged articles from store
          articles = getArticles();
          dataSource = "live";
        }
      } catch (error) {
        console.error("Live fetch failed, using cached/mock data:", error);
      }
    }

    // If we got articles from the store (not fresh fetch), mark as cached
    if (articles.length > 0 && dataSource !== "live") {
      dataSource = "cached";
    }

    // Fall back to mock data if store is still empty
    if (articles.length === 0) {
      articles = mockArticles;
      dataSource = "sample";
    }

    // Compute freshness and relevance scores for all articles
    articles = articles.map((article) => ({
      ...article,
      freshnessScore: computeFreshnessScore(article.publishedAt),
      relevanceScore: computeRelevanceScore(article),
      isLiveData: dataSource === "live",
    }));

    // Apply filters
    if (search) {
      const searchResults = searchArticles(search);
      if (searchResults.length > 0) {
        articles = searchResults.map((a) => ({
          ...a,
          freshnessScore: computeFreshnessScore(a.publishedAt),
          relevanceScore: computeRelevanceScore(a),
          isLiveData: dataSource === "live",
        }));
      } else {
        // Fallback search on current articles array
        const lowerSearch = search.toLowerCase();
        articles = articles.filter(
          (a) =>
            a.title.toLowerCase().includes(lowerSearch) ||
            a.summary.toLowerCase().includes(lowerSearch) ||
            a.tags.some((t) => t.toLowerCase().includes(lowerSearch))
        );
      }
    }

    if (date) {
      const dateArticles = getArticlesByDate(date);
      if (dateArticles.length > 0) {
        articles = dateArticles.map((a) => ({
          ...a,
          freshnessScore: computeFreshnessScore(a.publishedAt),
          relevanceScore: computeRelevanceScore(a),
          isLiveData: dataSource === "live",
        }));
      } else {
        articles = articles.filter((a) => a.publishedAt.startsWith(date));
      }
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
    const scored = mockArticles.map((a) => ({
      ...a,
      freshnessScore: computeFreshnessScore(a.publishedAt),
      relevanceScore: computeRelevanceScore(a),
      isLiveData: false,
    }));
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
