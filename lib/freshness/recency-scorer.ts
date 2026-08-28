import { NewsArticle } from "@/lib/types";

/**
 * Exponential decay freshness scoring.
 * Articles from now get score ~1.0, with a half-life of 12 hours.
 * Score decays as: score = e^(-lambda * hoursAgo)
 * where lambda = ln(2) / halfLifeHours
 */

const HALF_LIFE_HOURS = 12;
const LAMBDA = Math.LN2 / HALF_LIFE_HOURS;

/**
 * Compute freshness score for an article based on publish time.
 * Returns a value between 0 and 1, where 1 means just published.
 */
export function computeFreshnessScore(publishedAt: string): number {
  const pubTime = new Date(publishedAt).getTime();
  const now = Date.now();
  const hoursAgo = Math.max(0, (now - pubTime) / (1000 * 60 * 60));

  const score = Math.exp(-LAMBDA * hoursAgo);
  return Math.max(0, Math.min(1, score));
}

/**
 * Compute a combined relevance score for an article.
 * Factors:
 *  - Freshness (weight 0.5): exponential decay based on publish time
 *  - Economic impact (weight 0.3): economicImpactScore / 10
 *  - Topic velocity bonus (weight 0.2): the real change velocity of the topic
 *    cluster this article belongs to, computed by the topic tracker
 *    (buildTopicCorrelations). Articles on fast-moving threads rank higher.
 *
 * `topicVelocity` should be the 0-1 changeVelocity of the article's cluster.
 * When it is omitted (no correlation data available), the velocity term falls
 * back to a coarse tag-count proxy so ranking still degrades gracefully.
 */
export function computeRelevanceScore(
  article: NewsArticle,
  topicVelocity?: number
): number {
  const freshness = computeFreshnessScore(article.publishedAt);
  const impact = (article.economicImpactScore || 5) / 10;
  const velocity =
    topicVelocity !== undefined
      ? Math.max(0, Math.min(1, topicVelocity))
      : Math.min(1, (article.tags?.length || 0) / 6);

  const score = freshness * 0.5 + impact * 0.3 + velocity * 0.2;
  return Math.max(0, Math.min(1, parseFloat(score.toFixed(4))));
}
