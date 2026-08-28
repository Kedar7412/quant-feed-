import { NewsArticle } from "@/lib/types";
import { NewsSource, newsSources } from "./sources";
import { fetchFromAllAPIs } from "./api-fetcher";

// eslint-disable-next-line no-undef
const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "QuantFeed/1.0 (News Aggregator)",
  },
});

interface RSSItem {
  title?: string;
  contentSnippet?: string;
  content?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  categories?: string[];
}

function generateId(): string {
  return `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function estimateEconomicImpact(title: string, content: string): number {
  const highImpactTerms = [
    "gdp", "inflation", "rate cut", "rate hike", "rbi", "fed",
    "recession", "growth", "deficit", "surplus", "crash", "rally", "crisis",
  ];
  const medImpactTerms = [
    "market", "stock", "trade", "export", "import", "investment",
    "tax", "policy", "reform", "employment",
  ];

  const text = `${title} ${content}`.toLowerCase();
  let score = 5;

  for (const term of highImpactTerms) {
    if (text.includes(term)) score += 1.5;
  }
  for (const term of medImpactTerms) {
    if (text.includes(term)) score += 0.5;
  }

  return Math.min(10, Math.max(1, Math.round(score)));
}

export function extractTags(title: string, content: string): string[] {
  const commonTags: Record<string, string[]> = {
    "monetary policy": ["rbi", "repo rate", "interest rate", "fed", "ecb"],
    "stock market": ["sensex", "nifty", "bse", "nse", "stock", "share"],
    inflation: ["inflation", "cpi", "wpi", "prices", "cost"],
    trade: ["export", "import", "trade", "tariff", "customs"],
    technology: ["tech", "ai", "digital", "startup", "it sector"],
    energy: ["oil", "gas", "solar", "renewable", "energy"],
    infrastructure: ["infrastructure", "road", "railway", "port", "highway"],
    employment: ["jobs", "hiring", "unemployment", "layoff", "workforce"],
  };

  const text = `${title} ${content}`.toLowerCase();
  const tags: string[] = [];

  for (const [tag, keywords] of Object.entries(commonTags)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags.slice(0, 5) : ["general"];
}

async function fetchFromRSS(source: NewsSource): Promise<NewsArticle[]> {
  try {
    const feed = await parser.parseURL(source.url);
    const items: RSSItem[] = feed.items || [];

    return items.slice(0, 10).map((item: RSSItem) => {
      const title = item.title || "Untitled";
      const content = item.contentSnippet || item.content || "";

      return {
        id: generateId(),
        title,
        summary: content.substring(0, 300) || title,
        source: source.name,
        url: item.link || source.url,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        category: source.category,
        subcategory: source.subcategory,
        economicImpactScore: estimateEconomicImpact(title, content),
        tags: extractTags(title, content),
      };
    });
  } catch (error) {
    console.error(`Error fetching RSS from ${source.name}:`, error);
    return [];
  }
}

// ---- Deduplication ----

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function titlesAreSimilar(a: string, b: string): boolean {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);

  // Exact match after normalization
  if (normA === normB) return true;

  // Check substring overlap: if one contains 80%+ of the other's words
  const wordsA = normA.split(" ");
  const wordsB = normB.split(" ");
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length <= wordsB.length ? wordsB : wordsA;

  const longerStr = longer.join(" ");
  let matchCount = 0;
  for (const word of shorter) {
    if (word.length > 2 && longerStr.includes(word)) {
      matchCount++;
    }
  }

  const overlapRatio = shorter.length > 0 ? matchCount / shorter.length : 0;
  return overlapRatio > 0.8;
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const unique: NewsArticle[] = [];

  for (const article of articles) {
    const isDuplicate = unique.some((existing) =>
      titlesAreSimilar(existing.title, article.title)
    );
    if (!isDuplicate) {
      unique.push(article);
    }
  }

  return unique;
}

// ---- Public Exports ----

export async function fetchFromAllSources(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    newsSources.map((source) => fetchFromRSS(source))
  );

  const articles: NewsArticle[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  return articles;
}

/**
 * Fetch live news from all RSS feeds and APIs combined.
 * Deduplicates articles by title similarity and sorts by date (newest first).
 * Has a total timeout of 10 seconds so pages don't hang.
 */
export async function fetchLiveNews(): Promise<NewsArticle[]> {
  // Race both RSS and API fetchers against a 10-second timeout
  const timeoutPromise = new Promise<NewsArticle[]>((resolve) => {
    setTimeout(() => resolve([]), 10000);
  });

  const fetchPromise = (async () => {
    const [rssArticles, apiArticles] = await Promise.allSettled([
      fetchFromAllSources(),
      fetchFromAllAPIs(),
    ]);

    const combined: NewsArticle[] = [];

    if (rssArticles.status === "fulfilled") {
      combined.push(...rssArticles.value);
    }
    if (apiArticles.status === "fulfilled") {
      combined.push(...apiArticles.value);
    }

    return combined;
  })();

  const articles = await Promise.race([fetchPromise, timeoutPromise]);

  // Deduplicate
  const deduplicated = deduplicateArticles(articles);

  // Sort by publishedAt descending (newest first)
  deduplicated.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return deduplicated;
}

export async function fetchFromSource(source: NewsSource): Promise<NewsArticle[]> {
  return fetchFromRSS(source);
}

export async function fetchByCategory(
  category: "domestic" | "international" | "economic" | "political"
): Promise<NewsArticle[]> {
  const sources = newsSources.filter((s) => s.category === category);
  const results = await Promise.allSettled(
    sources.map((source) => fetchFromRSS(source))
  );

  const articles: NewsArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  return articles;
}
