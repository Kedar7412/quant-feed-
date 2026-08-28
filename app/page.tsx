"use client";

import { DailySummary } from "@/components/DailySummary";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { useAnalysis, useNews } from "@/lib/hooks/useApiData";
import { Zap, Newspaper, TrendingUp, Network } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const categoryColors: Record<string, string> = {
  domestic: "bg-green-400/10 text-green-400 border-green-400/20",
  international: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  economic: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  political: "bg-red-400/10 text-red-400 border-red-400/20",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function DashboardPage() {
  const { data: analysisData, loading: analysisLoading } = useAnalysis();
  const { data: newsData, loading: newsLoading, dataSource } = useNews();

  const loading = analysisLoading || newsLoading;
  const summary = analysisData?.summary;
  const articles = newsData?.articles || [];

  const topArticles = [...articles]
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 5);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-8 py-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Premium Hero Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 text-glow">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="h-7 w-7 text-indigo-400" />
            </motion.div>
            <span className="gradient-text">Economic Intelligence</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2 ml-10">
            AI-powered analysis for{" "}
            <span className="text-gray-300 font-medium">
              {summary?.date || new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </p>
        </div>
        <DataSourceBadge dataSource={dataSource} />
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/news"
          className="glass-premium rounded-xl p-5 hover:shadow-glow-sm transition-all duration-300 group"
        >
          <Newspaper className="h-5 w-5 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-bold text-white">{articles.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Articles Analyzed</p>
        </Link>
        <Link
          href="/network"
          className="glass-premium rounded-xl p-5 hover:shadow-glow-sm transition-all duration-300 group"
        >
          <Network className="h-5 w-5 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-bold text-white">{summary?.topClusters.length || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">News Clusters</p>
        </Link>
        <Link
          href="/analysis"
          className="glass-premium rounded-xl p-5 hover:shadow-glow-sm transition-all duration-300 group"
        >
          <TrendingUp className="h-5 w-5 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-bold text-white">{analysisData?.pathways.length || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active Pathways</p>
        </Link>
        <div className="glass-premium rounded-xl p-5">
          <Zap className="h-5 w-5 text-green-400 mb-3" />
          <p className="text-2xl font-bold text-white">
            {summary?.overallSentiment === "bullish" ? "Bullish" : summary?.overallSentiment === "bearish" ? "Bearish" : "Neutral"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Market Sentiment</p>
        </div>
      </motion.div>

      {/* Daily Summary */}
      {summary && (
        <motion.div variants={itemVariants} className="glass-premium rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-glow-sm" />
            Daily Economic Summary
          </h2>
          <DailySummary summary={summary} />
        </motion.div>
      )}

      {/* Top News Clusters & Articles */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-premium rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Top News Clusters
          </h2>
          <div className="space-y-2.5">
            {(summary?.topClusters || []).map((cluster) => (
              <div
                key={cluster.id}
                className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/[0.05] hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      categoryColors[cluster.category] || ""
                    }`}
                  >
                    {cluster.category}
                  </span>
                  <span className="text-sm text-gray-200">{cluster.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">
                    {cluster.articleCount} articles
                  </span>
                  <span className="text-xs font-medium text-indigo-400">
                    {cluster.impactScore}/10
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Impact Articles */}
        <div className="glass-premium rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Most Relevant Articles
          </h2>
          <div className="space-y-2.5">
            {topArticles.map((article) => (
              <div
                key={article.id}
                className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.05] hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      categoryColors[article.category] || ""
                    }`}
                  >
                    {article.category}
                  </span>
                  <span className="text-[10px] text-gray-500">{article.source}</span>
                  {article.relevanceScore !== undefined && (
                    <span className="text-[10px] text-indigo-400 ml-auto font-medium">
                      {Math.round(article.relevanceScore * 100)}% relevant
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-200 line-clamp-1">
                  {article.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
