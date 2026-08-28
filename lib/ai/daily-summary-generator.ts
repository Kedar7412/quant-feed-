import OpenAI from "openai";
import { NewsArticle, DailySummary, NewsCluster, EconomicIndicator } from "@/lib/types";

const getOpenAIClient = (): OpenAI | null => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

export async function generateDailySummary(
  articles: NewsArticle[],
  date: string
): Promise<DailySummary> {
  const client = getOpenAIClient();

  if (!client) {
    return generateFallbackSummary(articles, date);
  }

  try {
    const articleSummaries = articles
      .map(
        (a) =>
          `"${a.title}" [${a.category}/${a.subcategory}] - ${a.summary} (Impact: ${a.economicImpactScore}/10)`
      )
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an economic intelligence analyst. Generate a comprehensive daily summary analyzing all news.
Output JSON with:
- headline: one-sentence market overview
- keyTakeaways: array of 4-6 key points
- topClusters: array of {title, articleCount, category ("domestic"|"international"|"economic"|"political"), impactScore (1-10)}
- overallSentiment: "bullish"|"bearish"|"neutral"
- economicIndicators: array of {name, value, change (number), trend ("up"|"down"|"stable")}
Focus on Indian economic context.`,
        },
        {
          role: "user",
          content: `Generate daily economic summary for ${date} based on:\n${articleSummaries}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return generateFallbackSummary(articles, date);

    const parsed = JSON.parse(content);

    return {
      id: `summary-${date}`,
      date,
      headline: parsed.headline || "Daily Economic Summary",
      keyTakeaways: parsed.keyTakeaways || [],
      economicIndicators: (parsed.economicIndicators || []).map(
        (ind: { name: string; value: string; change: number; trend: string }) => ({
          name: ind.name,
          value: ind.value,
          change: ind.change,
          trend: ind.trend as "up" | "down" | "stable",
        })
      ),
      topClusters: (parsed.topClusters || []).map(
        (
          cluster: {
            title: string;
            articleCount: number;
            category: string;
            impactScore: number;
          },
          index: number
        ) => ({
          id: `cluster-${date}-${index}`,
          title: cluster.title,
          articleCount: cluster.articleCount,
          category: cluster.category as
            | "domestic"
            | "international"
            | "economic"
            | "political",
          impactScore: cluster.impactScore,
        })
      ),
      overallSentiment: parsed.overallSentiment || "neutral",
    };
  } catch (error) {
    console.error("Error generating daily summary:", error);
    return generateFallbackSummary(articles, date);
  }
}

function generateFallbackSummary(
  articles: NewsArticle[],
  date: string
): DailySummary {
  const categories = ["domestic", "international", "economic", "political"] as const;

  const clusters: NewsCluster[] = categories
    .map((cat, index) => {
      const catArticles = articles.filter((a) => a.category === cat);
      if (catArticles.length === 0) return null;
      const avgImpact =
        catArticles.reduce((sum, a) => sum + a.economicImpactScore, 0) /
        catArticles.length;
      return {
        id: `cluster-${date}-${index}`,
        title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} News Cluster`,
        articleCount: catArticles.length,
        category: cat,
        impactScore: Math.round(avgImpact),
      };
    })
    .filter((c): c is NewsCluster => c !== null);

  const avgImpact =
    articles.length > 0
      ? articles.reduce((sum, a) => sum + a.economicImpactScore, 0) /
        articles.length
      : 5;

  const indicators: EconomicIndicator[] = [
    { name: "Articles Analyzed", value: String(articles.length), change: 0, trend: "stable" },
    { name: "Avg Impact Score", value: avgImpact.toFixed(1), change: 0, trend: "stable" },
  ];

  const topArticle = articles.sort(
    (a, b) => b.economicImpactScore - a.economicImpactScore
  )[0];

  return {
    id: `summary-${date}`,
    date,
    headline: topArticle
      ? `Key focus: ${topArticle.title}`
      : "No significant news events today",
    keyTakeaways: articles.slice(0, 5).map((a) => a.title),
    economicIndicators: indicators,
    topClusters: clusters,
    overallSentiment: avgImpact > 6 ? "bullish" : avgImpact < 4 ? "bearish" : "neutral",
  };
}
