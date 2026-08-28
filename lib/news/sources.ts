export interface NewsSource {
  name: string;
  url: string;
  type: "rss" | "api";
  category: "domestic" | "international" | "economic" | "political";
  subcategory: "Indian Local" | "Indian National" | "International";
}

export const newsSources: NewsSource[] = [
  // Indian News Sources - National Economic/Business RSS Feeds
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
  // Indian Local/State Sources - RSS Feeds
  {
    name: "Deccan Herald - Business",
    url: "https://www.deccanherald.com/rss/business.rss",
    type: "rss",
    category: "economic",
    subcategory: "Indian Local",
  },
  {
    name: "Indian Express - Economy",
    url: "https://indianexpress.com/section/business/economy/feed/",
    type: "rss",
    category: "economic",
    subcategory: "Indian Local",
  },
  {
    name: "Business Standard - Economy",
    url: "https://www.business-standard.com/rss/economy-101.rss",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Business Standard - Markets",
    url: "https://www.business-standard.com/rss/markets-106.rss",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Moneycontrol - Markets",
    url: "https://www.moneycontrol.com/rss/marketreports.xml",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "Moneycontrol - Business",
    url: "https://www.moneycontrol.com/rss/business.xml",
    type: "rss",
    category: "economic",
    subcategory: "Indian National",
  },
  {
    name: "The Wire - Economy",
    url: "https://thewire.in/category/economy/feed",
    type: "rss",
    category: "economic",
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
  {
    name: "Al Jazeera - Economy",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    type: "rss",
    category: "international",
    subcategory: "International",
  },
  {
    name: "BBC - Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    type: "rss",
    category: "international",
    subcategory: "International",
  },
  {
    name: "CNBC - World Economy",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
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
