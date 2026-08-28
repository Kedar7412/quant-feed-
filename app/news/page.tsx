"use client";

import { useState, useMemo } from "react";
import { Newspaper, Search, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { NewsCard } from "@/components/NewsCard";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { NewsListSkeleton } from "@/components/LoadingSkeleton";
import { useNews } from "@/lib/hooks/useApiData";

const categories = ["all", "domestic", "international", "economic", "political"] as const;
const subcategories = ["All", "Indian Local", "Indian National", "International"] as const;

export default function NewsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "impact">("relevance");

  const { data, loading, dataSource } = useNews({
    category: selectedCategory,
    search: search || undefined,
    sort: sortBy,
  });

  const rawArticles = data?.articles;

  const filteredArticles = useMemo(() => {
    let result = [...(rawArticles || [])];

    if (selectedSubcategory !== "All") {
      result = result.filter((a) => a.subcategory === selectedSubcategory);
    }

    if (sortBy === "date") {
      result.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else if (sortBy === "impact") {
      result.sort((a, b) => b.economicImpactScore - a.economicImpactScore);
    } else {
      // relevance (default)
      result.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    return result;
  }, [rawArticles, selectedSubcategory, sortBy]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-indigo-400" />
            News Feed
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Summarized articles from Indian and international sources
          </p>
        </div>
        <DataSourceBadge dataSource={dataSource} />
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="space-y-3"
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles by title, content, or tags..."
            className="w-full pl-10 pr-4 py-2.5 glass-premium rounded-xl text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
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
              <motion.button
                key={cat}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  selectedCategory === cat
                    ? "glass-premium text-indigo-300 shadow-glow-sm"
                    : "glass text-gray-400 hover:text-gray-200"
                }`}
              >
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </motion.button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-500">Region:</span>
            <div className="flex gap-1.5">
              {subcategories.map((sub) => (
                <motion.button
                  key={sub}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    selectedSubcategory === sub
                      ? "glass-premium text-indigo-300 shadow-glow-sm"
                      : "glass text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {sub}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort & Results Count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {loading ? "Loading..." : `${filteredArticles.length} articles found`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <button
              onClick={() => setSortBy("relevance")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "relevance" ? "text-indigo-400 font-medium" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Relevance
            </button>
            <button
              onClick={() => setSortBy("date")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "date" ? "text-indigo-400 font-medium" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy("impact")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "impact" ? "text-indigo-400 font-medium" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Impact
            </button>
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && <NewsListSkeleton />}

      {/* Articles List */}
      {!loading && (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.05 },
            },
          }}
        >
          {filteredArticles.map((article) => (
            <motion.div
              key={article.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <NewsCard article={article} />
            </motion.div>
          ))}
          {filteredArticles.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No articles match your filters</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
