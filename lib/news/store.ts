import { NewsArticle, EconomicEdge, DailySummary, Pathway, Prediction, GraphData } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

// On Vercel, process.cwd() is read-only. Use /tmp for writes (ephemeral cache).
// For reads, try /tmp first (cache hit), then fall back to bundled data/ directory (mock/seed data).
const WRITE_DIR = path.join("/tmp", "quant-feed-data");
const READ_FALLBACK_DIR = path.join(process.cwd(), "data");

function ensureWriteDir(): void {
  if (!fs.existsSync(WRITE_DIR)) {
    fs.mkdirSync(WRITE_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  // Try /tmp first (writable cache), then fall back to bundled data directory
  const tmpPath = path.join(WRITE_DIR, filename);
  const fallbackPath = path.join(READ_FALLBACK_DIR, filename);

  try {
    if (fs.existsSync(tmpPath)) {
      const data = fs.readFileSync(tmpPath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filename} from /tmp:`, error);
  }

  try {
    if (fs.existsSync(fallbackPath)) {
      const data = fs.readFileSync(fallbackPath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filename} from fallback:`, error);
  }

  return defaultValue;
}

function writeJsonFile<T>(filename: string, data: T): void {
  ensureWriteDir();
  const filePath = path.join(WRITE_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Articles
export function saveArticle(article: NewsArticle): void {
  const articles = getArticles();
  const existingIndex = articles.findIndex((a) => a.id === article.id);
  if (existingIndex >= 0) {
    articles[existingIndex] = article;
  } else {
    articles.push(article);
  }
  writeJsonFile("articles.json", articles);
}

export function saveArticles(newArticles: NewsArticle[]): void {
  const articles = getArticles();
  for (const article of newArticles) {
    const existingIndex = articles.findIndex((a) => a.id === article.id);
    if (existingIndex >= 0) {
      articles[existingIndex] = article;
    } else {
      articles.push(article);
    }
  }
  writeJsonFile("articles.json", articles);
}

export function getArticles(): NewsArticle[] {
  return readJsonFile<NewsArticle[]>("articles.json", []);
}

export function getArticleById(id: string): NewsArticle | undefined {
  const articles = getArticles();
  return articles.find((a) => a.id === id);
}

export function getArticlesByDate(date: string): NewsArticle[] {
  const articles = getArticles();
  return articles.filter((a) => a.publishedAt.startsWith(date));
}

export function searchArticles(query: string): NewsArticle[] {
  const articles = getArticles();
  const lowerQuery = query.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(lowerQuery) ||
      a.summary.toLowerCase().includes(lowerQuery) ||
      a.tags.some((t) => t.toLowerCase().includes(lowerQuery))
  );
}

// Edges/Graph
export function saveEdges(newEdges: EconomicEdge[]): void {
  const existingEdges = getEdges();
  for (const edge of newEdges) {
    const existingIndex = existingEdges.findIndex(
      (e) => e.source === edge.source && e.target === edge.target
    );
    if (existingIndex >= 0) {
      existingEdges[existingIndex] = edge;
    } else {
      existingEdges.push(edge);
    }
  }
  writeJsonFile("edges.json", existingEdges);
}

export function getEdges(): EconomicEdge[] {
  return readJsonFile<EconomicEdge[]>("edges.json", []);
}

export function getGraphData(): GraphData {
  const articles = getArticles();
  const edges = getEdges();

  const nodes = articles.map((article) => ({
    id: article.id,
    articleId: article.id,
    label: article.title.substring(0, 40) + "...",
    category: article.category,
    val: article.economicImpactScore,
    color:
      article.category === "domestic"
        ? "#22c55e"
        : article.category === "international"
          ? "#3b82f6"
          : article.category === "economic"
            ? "#f59e0b"
            : "#ef4444",
    // Include article metadata for the detail panel
    title: article.title,
    summary: article.summary,
    source: article.source,
    economicImpactScore: article.economicImpactScore,
    tags: article.tags,
  }));

  return { nodes, links: edges };
}

// Daily Summary
export function saveDailySummary(summary: DailySummary): void {
  const summaries = readJsonFile<DailySummary[]>("summaries.json", []);
  const existingIndex = summaries.findIndex((s) => s.date === summary.date);
  if (existingIndex >= 0) {
    summaries[existingIndex] = summary;
  } else {
    summaries.push(summary);
  }
  writeJsonFile("summaries.json", summaries);
}

export function getLatestSummary(): DailySummary | null {
  const summaries = readJsonFile<DailySummary[]>("summaries.json", []);
  if (summaries.length === 0) return null;
  return summaries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}

// Pathways
export function savePathways(pathways: Pathway[]): void {
  writeJsonFile("pathways.json", pathways);
}

export function getPathways(): Pathway[] {
  return readJsonFile<Pathway[]>("pathways.json", []);
}

// Predictions
export function savePredictions(predictions: Prediction[]): void {
  writeJsonFile("predictions.json", predictions);
}

export function getPredictions(): Prediction[] {
  return readJsonFile<Prediction[]>("predictions.json", []);
}

export function savePrediction(prediction: Prediction): void {
  const predictions = getPredictions();
  const existingIndex = predictions.findIndex((p) => p.id === prediction.id);
  if (existingIndex >= 0) {
    predictions[existingIndex] = prediction;
  } else {
    predictions.push(prediction);
  }
  writeJsonFile("predictions.json", predictions);
}
