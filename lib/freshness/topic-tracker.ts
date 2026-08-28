import { NewsArticle } from "@/lib/types";

/**
 * Topic correlation engine.
 * Groups articles by shared keyword fingerprints using Jaccard similarity,
 * computes change velocity (how fast a topic is evolving), and builds
 * correlation clusters.
 */

export interface TopicCorrelation {
  topicId: string;
  keywords: string[];
  articleIds: string[];
  changeVelocity: number;
  latestArticleDate: string;
}

/**
 * Extract a normalized keyword fingerprint from an article.
 * Uses title words (3+ chars) and tags, all lowercased and deduplicated.
 */
export function extractTopicFingerprint(article: NewsArticle): string[] {
  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all",
    "can", "her", "was", "one", "our", "out", "has", "had",
    "its", "with", "from", "this", "that", "will", "been",
    "have", "they", "more", "over", "than", "into", "also",
  ]);

  // Extract words from title (3+ chars, non-stop-words)
  const titleWords = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Include tags (normalized)
  const tagWords = (article.tags || []).map((t) => t.toLowerCase().trim());

  // Deduplicate
  const fingerprint = Array.from(new Set([...titleWords, ...tagWords]));
  return fingerprint;
}

/**
 * Compute Jaccard similarity between two articles' topic fingerprints.
 * Returns a value between 0 and 1.
 */
export function computeTopicOverlap(a: NewsArticle, b: NewsArticle): number {
  const fpA = new Set(extractTopicFingerprint(a));
  const fpB = new Set(extractTopicFingerprint(b));

  if (fpA.size === 0 && fpB.size === 0) return 0;

  let intersection = 0;
  Array.from(fpA).forEach((word) => {
    if (fpB.has(word)) intersection++;
  });

  const union = fpA.size + fpB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

/**
 * Compute change velocity for a topic given articles sorted by date.
 * Higher velocity means more recent articles in the last 24-48 hours.
 * Returns 0-1.
 */
export function computeChangeVelocity(
  articles: NewsArticle[],
  _topicKeywords: string[]
): number {
  if (articles.length <= 1) return 0;

  const now = Date.now();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  // Count articles published in the last 24h and 48h
  let recentCount24h = 0;
  let recentCount48h = 0;

  for (const article of articles) {
    const age = now - new Date(article.publishedAt).getTime();
    if (age <= twentyFourHoursMs) recentCount24h++;
    if (age <= fortyEightHoursMs) recentCount48h++;
  }

  // Velocity is weighted: recent articles count more
  const totalArticles = articles.length;
  const velocity24h = recentCount24h / totalArticles;
  const velocity48h = recentCount48h / totalArticles;

  // Combine: 60% weight on 24h activity, 40% on 48h
  const velocity = velocity24h * 0.6 + velocity48h * 0.4;
  return Math.min(1, velocity);
}

/**
 * Build topic correlations from a list of articles.
 * Groups articles into clusters where any pair has Jaccard >= 0.3.
 * Uses a union-find approach for clustering.
 */
export function buildTopicCorrelations(
  articles: NewsArticle[]
): TopicCorrelation[] {
  if (articles.length === 0) return [];

  const n = articles.length;
  const THRESHOLD = 0.3;

  // Union-Find
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  }

  // Compute pairwise Jaccard and union similar articles
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const overlap = computeTopicOverlap(articles[i], articles[j]);
      if (overlap >= THRESHOLD) {
        union(i, j);
      }
    }
  }

  // Group articles by cluster
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(i);
  }

  // Build correlations for clusters with 2+ articles
  const correlations: TopicCorrelation[] = [];
  let topicCounter = 0;

  Array.from(clusters.entries()).forEach(([, indices]) => {
    if (indices.length < 2) return;

    topicCounter++;
    const clusterArticles = indices.map((i) => articles[i]);

    // Collect all keywords from the cluster and find most common
    const keywordCounts = new Map<string, number>();
    for (const art of clusterArticles) {
      const fp = extractTopicFingerprint(art);
      for (const word of fp) {
        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
      }
    }

    // Top keywords that appear in multiple articles
    const keywords = Array.from(keywordCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word]) => word);

    // Sort cluster articles by date
    const sortedArticles = [...clusterArticles].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const velocity = computeChangeVelocity(sortedArticles, keywords);
    const latestDate = sortedArticles[0].publishedAt;

    correlations.push({
      topicId: `topic-${topicCounter}`,
      keywords,
      articleIds: clusterArticles.map((a) => a.id),
      changeVelocity: parseFloat(velocity.toFixed(4)),
      latestArticleDate: latestDate,
    });
  });

  // Sort correlations by velocity (most active first)
  correlations.sort((a, b) => b.changeVelocity - a.changeVelocity);

  return correlations;
}
