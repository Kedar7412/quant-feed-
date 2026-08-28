import { NextResponse } from "next/server";
import { getArticles, saveArticles, searchArticles, getArticlesByDate, getLastFetchTimestamp, setLastFetchTimestamp } from "@/lib/news/store";
import { fetchLiveNews } from "@/lib/news/fetcher";
import { mockArticles } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// Minimum interval between live fetches (30 minutes in ms)
const FETCH_INTERVAL_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const date = searchParams.get("date");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

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
        }
      } catch (error) {
        console.error("Live fetch failed, using cached/mock data:", error);
      }
    }

    // Fall back to mock data if store is still empty
    if (articles.length === 0) {
      articles = mockArticles;
    }

    // Apply filters
    if (search) {
      const searchResults = searchArticles(search);
      if (searchResults.length > 0) {
        articles = searchResults;
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
        articles = dateArticles;
      } else {
        articles = articles.filter((a) => a.publishedAt.startsWith(date));
      }
    }

    if (category && category !== "all") {
      articles = articles.filter((a) => a.category === category);
    }

    // Sort by date (newest first)
    articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Paginate
    const total = articles.length;
    const startIndex = (page - 1) * limit;
    const paginatedArticles = articles.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      {
        articles: paginatedArticles,
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
    // Graceful fallback to mock data
    return NextResponse.json({
      articles: mockArticles,
      pagination: {
        page: 1,
        limit: 20,
        total: mockArticles.length,
        totalPages: 1,
      },
    });
  }
}
