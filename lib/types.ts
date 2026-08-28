export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: "domestic" | "international" | "economic" | "political";
  subcategory: "Indian Local" | "Indian National" | "International";
  economicImpactScore: number; // 1-10
  tags: string[];
  freshnessScore?: number; // 0-1, exponential decay from publish time
  relevanceScore?: number; // 0-1, combined freshness + impact + velocity
  isLiveData?: boolean; // true = live-fetched, false = mock/cached
}

export interface TopicCorrelation {
  topicId: string;
  keywords: string[];
  articleIds: string[];
  changeVelocity: number;
  latestArticleDate: string;
}

export interface EconomicNode {
  id: string;
  articleId: string;
  label: string;
  category: "domestic" | "international" | "economic" | "political";
  x?: number;
  y?: number;
  val?: number;
  color?: string;
  // Article metadata for node detail panel
  title?: string;
  summary?: string;
  source?: string;
  economicImpactScore?: number;
  tags?: string[];
  url?: string;
  imageUrl?: string;
  freshnessScore?: number;
}

export interface EconomicEdge {
  source: string;
  target: string;
  strength: number; // 0-1
  relationship: string;
}

export interface Pathway {
  id: string;
  title: string;
  description: string;
  steps: PathwayStep[];
  probability: number; // 0-100
  timeframeWeeks: number;
  impactLevel: "micro" | "meso" | "macro";
}

export interface PathwayStep {
  id: string;
  description: string;
  level: "micro" | "meso" | "macro";
  confidence: number;
}

export interface Prediction {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  targetDate: string;
  confidence: number; // 0-100
  status: "active" | "correct" | "incorrect" | "expired";
  category: "domestic" | "international" | "economic" | "political";
  outcome?: string;
}

export interface DailySummary {
  id: string;
  date: string;
  headline: string;
  keyTakeaways: string[];
  economicIndicators: EconomicIndicator[];
  topClusters: NewsCluster[];
  overallSentiment: "bullish" | "bearish" | "neutral";
}

export interface EconomicIndicator {
  name: string;
  value: string;
  change: number;
  trend: "up" | "down" | "stable";
}

export interface NewsCluster {
  id: string;
  title: string;
  articleCount: number;
  category: "domestic" | "international" | "economic" | "political";
  impactScore: number;
}

export interface GraphData {
  nodes: EconomicNode[];
  links: EconomicEdge[];
}
