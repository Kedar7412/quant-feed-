import OpenAI from "openai";
import { NewsArticle, EconomicEdge } from "@/lib/types";

const getOpenAIClient = (): OpenAI | null => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

export interface ExtractedRelationship {
  sourceArticleId: string;
  targetArticleId: string;
  relationship: string;
  strength: number;
}

export async function extractRelationships(
  articles: NewsArticle[]
): Promise<EconomicEdge[]> {
  const client = getOpenAIClient();

  if (!client) {
    // Fallback: generate basic relationships based on shared tags
    return generateFallbackRelationships(articles);
  }

  try {
    const articleSummaries = articles
      .map(
        (a) =>
          `[${a.id}] "${a.title}" (Category: ${a.category}, Tags: ${a.tags.join(", ")})`
      )
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an economic analyst. Given a list of news articles, identify economic relationships between them. 
Output JSON array of objects with: sourceId, targetId, relationship (brief description), strength (0-1 float).
Focus on causal economic linkages: how one event influences another economically.
Only include relationships with strength > 0.4. Maximum 30 relationships.`,
        },
        {
          role: "user",
          content: `Identify economic relationships between these articles:\n${articleSummaries}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return generateFallbackRelationships(articles);

    const parsed = JSON.parse(content);
    const relationships: Array<{
      sourceId: string;
      targetId: string;
      relationship: string;
      strength: number;
    }> = parsed.relationships || parsed.edges || [];

    return relationships.map((rel) => ({
      source: rel.sourceId,
      target: rel.targetId,
      relationship: rel.relationship,
      strength: Math.min(1, Math.max(0, rel.strength)),
    }));
  } catch (error) {
    console.error("Error extracting relationships:", error);
    return generateFallbackRelationships(articles);
  }
}

function generateFallbackRelationships(articles: NewsArticle[]): EconomicEdge[] {
  const edges: EconomicEdge[] = [];

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const sharedTags = articles[i].tags.filter((tag) =>
        articles[j].tags.includes(tag)
      );

      if (sharedTags.length > 0) {
        const strength = Math.min(1, sharedTags.length * 0.3);
        if (strength >= 0.3) {
          edges.push({
            source: articles[i].id,
            target: articles[j].id,
            relationship: `Connected via: ${sharedTags.join(", ")}`,
            strength,
          });
        }
      } else if (articles[i].category === articles[j].category) {
        edges.push({
          source: articles[i].id,
          target: articles[j].id,
          relationship: `Same sector: ${articles[i].category}`,
          strength: 0.3,
        });
      }
    }
  }

  return edges.slice(0, 30);
}
