import { NextResponse } from "next/server";
import { getArticles, searchArticles, getArticlesByDate } from "@/lib/news/store";
import { mockArticles } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const date = searchParams.get("date");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let articles = getArticles();

    // Fall back to mock data if store is empty
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

    return NextResponse.json({
      articles: paginatedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
