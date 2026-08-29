import { NewsArticle } from "@/lib/types";

function generateId(): string {
  return `art-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function estimateEconomicImpact(title: string, content: string): number {
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

function extractTags(title: string, content: string): string[] {
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

// ---- GNews API Fetcher ----

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  publishedAt: string;
  source: { name: string; url: string };
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

export async function fetchFromGNews(): Promise<NewsArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];

  const endpoints = [
    // Indian business news
    `https://gnews.io/api/v4/top-headlines?category=business&country=in&max=10&token=${apiKey}`,
    // International business news in English
    `https://gnews.io/api/v4/top-headlines?category=business&lang=en&max=10&token=${apiKey}`,
  ];

  const articles: NewsArticle[] = [];

  const results = await Promise.allSettled(
    endpoints.map(async (url, index) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          console.error(`GNews API error (${response.status}): ${response.statusText}`);
          return [];
        }

        const data: GNewsResponse = await response.json();
        const category = index === 0 ? "economic" : "international";
        const subcategory = index === 0 ? "Indian National" : "International";

        return (data.articles || []).map((item): NewsArticle => {
          const title = item.title || "Untitled";
          const content = item.description || item.content || "";

          return {
            id: generateId(),
            title,
            summary: content.substring(0, 300) || title,
            source: item.source?.name || "GNews",
            url: item.url || "",
            publishedAt: item.publishedAt || new Date().toISOString(),
            category,
            subcategory,
            economicImpactScore: estimateEconomicImpact(title, content),
            tags: extractTags(title, content),
          };
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error("GNews fetch error:", error);
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  return articles;
}

// ---- NewsData.io API Fetcher ----

interface NewsDataArticle {
  article_id: string;
  title: string;
  description: string | null;
  content: string | null;
  link: string;
  pubDate: string;
  source_id: string;
  source_name: string;
  category: string[];
  country: string[];
}

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
}

export async function fetchFromNewsData(): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return [];

  const endpoints = [
    // Indian business news
    `https://newsdata.io/api/1/latest?country=in&category=business&apikey=${apiKey}`,
    // International business news
    `https://newsdata.io/api/1/latest?category=business&language=en&apikey=${apiKey}`,
  ];

  const articles: NewsArticle[] = [];

  const results = await Promise.allSettled(
    endpoints.map(async (url, index) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          console.error(`NewsData API error (${response.status}): ${response.statusText}`);
          return [];
        }

        const data: NewsDataResponse = await response.json();
        const category = index === 0 ? "economic" : "international";
        const subcategory = index === 0 ? "Indian National" : "International";

        return (data.results || []).map((item): NewsArticle => {
          const title = item.title || "Untitled";
          const content = item.description || item.content || "";

          return {
            id: generateId(),
            title,
            summary: (content || "").substring(0, 300) || title,
            source: item.source_name || item.source_id || "NewsData",
            url: item.link || "",
            publishedAt: item.pubDate
              ? new Date(item.pubDate).toISOString()
              : new Date().toISOString(),
            category,
            subcategory,
            economicImpactScore: estimateEconomicImpact(title, content || ""),
            tags: extractTags(title, content || ""),
          };
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error("NewsData fetch error:", error);
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  return articles;
}

// ---- The Guardian Open Platform API Fetcher ----

interface GuardianResult {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: {
    trailText?: string;
    thumbnail?: string;
    bodyText?: string;
  };
}

interface GuardianResponse {
  response: {
    status: string;
    total: number;
    results: GuardianResult[];
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export async function fetchFromGuardian(): Promise<NewsArticle[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) return [];

  const baseParams =
    "show-fields=trailText,thumbnail,bodyText&page-size=20&order-by=newest";

  const endpoints = [
    // Global business news
    `https://content.guardianapis.com/search?section=business&${baseParams}&api-key=${apiKey}`,
    // India economy focused
    `https://content.guardianapis.com/search?q=${encodeURIComponent("india economy")}&${baseParams}&api-key=${apiKey}`,
    // Indian markets focused
    `https://content.guardianapis.com/search?q=${encodeURIComponent('RBI OR sensex OR "indian markets"')}&${baseParams}&api-key=${apiKey}`,
  ];

  const articles: NewsArticle[] = [];

  const results = await Promise.allSettled(
    endpoints.map(async (url, index) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          console.error("Guardian API error", response.status);
          return [];
        }

        const data: GuardianResponse = await response.json();
        // index 0 = global business, index 1+ = india focused
        const category = index === 0 ? "international" : "economic";
        const subcategory = index === 0 ? "International" : "Indian National";

        return (data.response?.results || []).map((item): NewsArticle => {
          const title = item.webTitle || "Untitled";
          const trailText = item.fields?.trailText
            ? stripHtml(item.fields.trailText)
            : "";
          const bodyText = item.fields?.bodyText
            ? stripHtml(item.fields.bodyText).substring(0, 300)
            : "";
          const summary = trailText || bodyText || title;
          const content = trailText || bodyText || title;

          return {
            id: generateId(),
            title,
            summary,
            source: "The Guardian",
            url: item.webUrl || "",
            publishedAt: item.webPublicationDate
              ? new Date(item.webPublicationDate).toISOString()
              : new Date().toISOString(),
            category,
            subcategory,
            economicImpactScore: estimateEconomicImpact(title, content),
            tags: extractTags(title, content),
          };
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error("Guardian fetch error:", error);
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  return articles;
}

// ---- Combined API Fetcher ----

export async function fetchFromAllAPIs(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled([
    fetchFromGNews(),
    fetchFromNewsData(),
    fetchFromGuardian(),
  ]);

  const articles: NewsArticle[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  return articles;
}
