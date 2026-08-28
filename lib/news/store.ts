import { NewsArticle, EconomicEdge, DailySummary, Pathway, Prediction, GraphData } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
  }
  return defaultValue;
}

function writeJsonFile<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
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
export function saveEdges(edges: EconomicEdge[]): void {
  writeJsonFile("edges.json", edges);
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
