"use client";

import { useState, useMemo } from "react";
import { Newspaper, Search, Filter } from "lucide-react";
import { NewsCard } from "@/components/NewsCard";
import { mockArticles } from "@/lib/mock-data";

const categories = ["all", "domestic", "international", "economic", "political"] as const;
const subcategories = ["All", "Indian Local", "Indian National", "International"] as const;

export default function NewsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"date" | "impact">("date");

  const filteredArticles = useMemo(() => {
    let articles = [...mockArticles];

    if (search) {
      const searchLower = search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(searchLower) ||
          a.summary.toLowerCase().includes(searchLower) ||
          a.tags.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (selectedCategory !== "all") {
      articles = articles.filter((a) => a.category === selectedCategory);
    }

    if (selectedSubcategory !== "All") {
      articles = articles.filter((a) => a.subcategory === selectedSubcategory);
    }

    if (sortBy === "date") {
      articles.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else {
      articles.sort((a, b) => b.economicImpactScore - a.economicImpactScore);
    }

    return articles;
  }, [search, selectedCategory, selectedSubcategory, sortBy]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-indigo-400" />
          News Feed
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Summarized articles from Indian and international sources
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles by title, content, or tags..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-xs text-gray-500">Category:</span>
          </div>
          <div className="flex gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50"
                }`}
              >
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-500">Region:</span>
            <div className="flex gap-1.5">
              {subcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedSubcategory === sub
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort & Results Count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {filteredArticles.length} articles found
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <button
              onClick={() => setSortBy("date")}
              className={`text-xs px-2 py-1 rounded ${
                sortBy === "date" ? "text-indigo-400" : "text-gray-500"
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy("impact")}
              className={`text-xs px-2 py-1 rounded ${
                sortBy === "impact" ? "text-indigo-400" : "text-gray-500"
              }`}
            >
              Impact
            </button>
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {filteredArticles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
        {filteredArticles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No articles match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
