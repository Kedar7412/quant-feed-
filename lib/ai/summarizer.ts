import OpenAI from "openai";
import { NewsArticle } from "@/lib/types";

const getOpenAIClient = (): OpenAI | null => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

export async function summarizeArticle(
  article: Pick<NewsArticle, "title" | "summary" | "source" | "category">
): Promise<string> {
  const client = getOpenAIClient();

  if (!client) {
    // Fallback: return the existing summary if no API key
    return article.summary;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an economic analyst. Summarize news articles in 2-3 sentences focusing on economic implications for India. Highlight potential micro and macro economic impacts.",
        },
        {
          role: "user",
          content: `Title: ${article.title}\nSource: ${article.source}\nCategory: ${article.category}\nContent: ${article.summary}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || article.summary;
  } catch (error) {
    console.error("Error summarizing article:", error);
    return article.summary;
  }
}

export async function batchSummarize(
  articles: Pick<NewsArticle, "title" | "summary" | "source" | "category">[]
): Promise<string[]> {
  const BATCH_SIZE = 5;
  const results: string[] = [];

  // Process in batches of BATCH_SIZE to avoid overwhelming OpenAI rate limits
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((article) => summarizeArticle(article))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      results.push(
        result.status === "fulfilled" ? result.value : articles[i + j].summary
      );
    }
  }

  return results;
}
