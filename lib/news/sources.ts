export interface NewsSource {
  name: string;
  url: string;
  type: "rss" | "api";
  category: "domestic" | "international" | "economic" | "political";
  subcategory: "Indian Local" | "Indian National" | "International";
}

export const newsSources: NewsSource[] = [
  // Indian News Sources - RSS Feeds
  {
    name: "The Hindu - Business",
    url: "https://www.thehindu.com/business/feeder/default.rss",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "The Hindu - Economy",
    url: "https://www.thehindu.com/business/Economy/feeder/default.rss",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Economic Times - Markets",
    url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Economic Times - Economy",
    url: "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Mint - Economy",
    url: "https://www.livemint.com/rss/economy",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Mint - Markets",
    url: "https://www.livemint.com/rss/markets",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "NDTV - Business",
    url: "https://feeds.feedburner.com/ndtvprofit-latest",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Times of India - Business",
    url: "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Times of India - India",
    url: "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
    type: "rss",
    category: "political",
    subcategory: "Indian National",
  },
  // International News Sources - RSS Feeds
  {
    name: "Reuters - Business",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
    type: "rss",
    category: "international",
    subcategory: "International",
  },
  {
    name: "Bloomberg - Markets",
    url: "https://feeds.bloomberg.com/markets/news.rss",
    type: "rss",
    category: "international",
    subcategory: "International",
  },
  {
    name: "Financial Times - World",
    url: "https://www.ft.com/world?format=rss",
    type: "rss",
    category: "international",
    subcategory: "International",
  },
];

export function getSourcesByCategory(
  category: "domestic" | "international" | "economic" | "political"
): NewsSource[] {
  return newsSources.filter((source) => source.category === category);
}

export function getSourcesBySubcategory(
  subcategory: "Indian Local" | "Indian National" | "International"
): NewsSource[] {
  return newsSources.filter((source) => source.subcategory === subcategory);
}
