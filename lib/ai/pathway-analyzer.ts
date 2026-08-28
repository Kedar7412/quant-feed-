import OpenAI from "openai";
import { NewsArticle, Pathway, PathwayStep } from "@/lib/types";

const getOpenAIClient = (): OpenAI | null => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

export async function analyzePathways(
  articles: NewsArticle[]
): Promise<Pathway[]> {
  const client = getOpenAIClient();

  if (!client) {
    return generateFallbackPathways(articles);
  }

  try {
    const articleSummaries = articles
      .map(
        (a) =>
          `"${a.title}" - ${a.summary} (Impact: ${a.economicImpactScore}/10, Category: ${a.category})`
      )
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an economic pathway analyst. Given news events, predict economic pathways from micro to macro level.
Output JSON with "pathways" array. Each pathway has:
- title: short descriptive title
- description: one sentence overview
- steps: array of {description, level ("micro"|"meso"|"macro"), confidence (0-100)}
- probability: overall probability (0-100)
- timeframeWeeks: estimated weeks to play out
- impactLevel: final impact level ("micro"|"meso"|"macro")
Generate 2-4 pathways focusing on Indian economy impacts.`,
        },
        {
          role: "user",
          content: `Analyze these news events and predict economic pathways:\n${articleSummaries}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return generateFallbackPathways(articles);

    const parsed = JSON.parse(content);
    const pathways: Array<{
      title: string;
      description: string;
      steps: Array<{ description: string; level: string; confidence: number }>;
      probability: number;
      timeframeWeeks: number;
      impactLevel: string;
    }> = parsed.pathways || [];

    return pathways.map((p, index) => ({
      id: `path-${Date.now()}-${index}`,
      title: p.title,
      description: p.description,
      steps: p.steps.map((s, sIndex) => ({
        id: `step-${index}-${sIndex}`,
        description: s.description,
        level: (s.level as "micro" | "meso" | "macro") || "meso",
        confidence: Math.min(100, Math.max(0, s.confidence)),
      })),
      probability: Math.min(100, Math.max(0, p.probability)),
      timeframeWeeks: p.timeframeWeeks || 12,
      impactLevel: (p.impactLevel as "micro" | "meso" | "macro") || "macro",
    }));
  } catch (error) {
    console.error("Error analyzing pathways:", error);
    return generateFallbackPathways(articles);
  }
}

function generateFallbackPathways(articles: NewsArticle[]): Pathway[] {
  const pathways: Pathway[] = [];

  // Group articles by category
  const economicArticles = articles.filter((a) => a.category === "economic");
  const politicalArticles = articles.filter((a) => a.category === "political");

  if (economicArticles.length > 0) {
    const steps: PathwayStep[] = economicArticles.slice(0, 4).map((a, i) => ({
      id: `fallback-step-${i}`,
      description: a.title,
      level: (i === 0 ? "micro" : i < 3 ? "meso" : "macro") as
        | "micro"
        | "meso"
        | "macro",
      confidence: Math.max(30, 80 - i * 15),
    }));

    pathways.push({
      id: `path-fallback-1`,
      title: "Economic Trend Pathway",
      description:
        "Projected economic trajectory based on current market signals",
      steps,
      probability: 55,
      timeframeWeeks: 24,
      impactLevel: "macro",
    });
  }

  if (politicalArticles.length > 0) {
    const steps: PathwayStep[] = politicalArticles.slice(0, 3).map((a, i) => ({
      id: `fallback-step-pol-${i}`,
      description: a.title,
      level: (i === 0 ? "micro" : i < 2 ? "meso" : "macro") as
        | "micro"
        | "meso"
        | "macro",
      confidence: Math.max(25, 70 - i * 20),
    }));

    pathways.push({
      id: `path-fallback-2`,
      title: "Policy Impact Pathway",
      description:
        "How current policy decisions may cascade through the economy",
      steps,
      probability: 45,
      timeframeWeeks: 36,
      impactLevel: "macro",
    });
  }

  return pathways;
}
