import { NewsArticle } from "@/lib/types";
import { fetchLiveNews } from "./fetcher";

/**
 * Short-lived, in-process cache for live-fetched news.
 *
 * The target runtime is Vercel serverless where the /tmp filesystem is
 * ephemeral (resets on cold start) and therefore cannot be relied on to gate
 * freshness. Instead of a /tmp-timestamp throttle, every request fetches live
 * news, but a module-scope memo (shared for the lifetime of a warm serverless
 * instance) prevents hammering the upstream feeds when requests arrive close
 * together. The cache is intentionally simple and process-local; it degrades
 * gracefully to a fresh fetch on any cold start.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface LiveCache {
  articles: NewsArticle[];
  fetchedAt: number;
}

// Module-scope memo. Lives for the duration of a warm serverless instance.
let cache: LiveCache | null = null;
// De-dupe concurrent fetches within the same instance.
let inFlight: Promise<NewsArticle[]> | null = null;

/**
 * Return live articles, using the in-process cache when it is still fresh
 * (< TTL). On a cache miss it performs a single live fetch (shared across
 * concurrent callers) and memoizes a non-empty result. Returns an empty array
 * if the live fetch yields nothing, letting callers decide on a fallback.
 */
export async function getCachedLiveNews(): Promise<NewsArticle[]> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS && cache.articles.length > 0) {
    return cache.articles;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const articles = await fetchLiveNews();
      if (articles.length > 0) {
        cache = { articles, fetchedAt: Date.now() };
      }
      return articles;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
