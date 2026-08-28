"use client";

import { DailySummary } from "@/components/DailySummary";
import { useAnalysis, useNews } from "@/lib/hooks/useApiData";
import { Zap, Newspaper, TrendingUp, Network, Loader2 } from "lucide-react";
import Link from "next/link";

const categoryColors: Record<string, string> = {
  domestic: "bg-green-400/10 text-green-400 border-green-400/20",
  international: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  economic: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  political: "bg-red-400/10 text-red-400 border-red-400/20",
};

export default function DashboardPage() {
  const { data: analysisData, loading: analysisLoading } = useAnalysis();
  const { data: newsData, loading: newsLoading } = useNews();

  const loading = analysisLoading || newsLoading;
  const summary = analysisData?.summary;
  const articles = newsData?.articles || [];

  const topArticles = [...articles]
    .sort((a, b) => b.economicImpactScore - a.economicImpactScore)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
        <span className="ml-3 text-sm text-gray-400">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-indigo-400" />
            Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            AI-powered economic intelligence for {summary?.date || new Date().toISOString().split("T")[0]}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/news"
          className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-indigo-500/30 transition-colors"
        >
          <Newspaper className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-2xl font-bold text-white">{articles.length}</p>
          <p className="text-xs text-gray-400">Articles Analyzed</p>
        </Link>
        <Link
          href="/network"
          className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-indigo-500/30 transition-colors"
        >
          <Network className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-2xl font-bold text-white">{summary?.topClusters.length || 0}</p>
          <p className="text-xs text-gray-400">News Clusters</p>
        </Link>
        <Link
          href="/analysis"
          className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-indigo-500/30 transition-colors"
        >
          <TrendingUp className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-2xl font-bold text-white">{analysisData?.pathways.length || 0}</p>
          <p className="text-xs text-gray-400">Active Pathways</p>
        </Link>
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
          <Zap className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">
            {summary?.overallSentiment === "bullish" ? "Bullish" : summary?.overallSentiment === "bearish" ? "Bearish" : "Neutral"}
          </p>
          <p className="text-xs text-gray-400">Market Sentiment</p>
        </div>
      </div>

      {/* Daily Summary */}
      {summary && (
        <div className="bg-gray-800/20 border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Daily Economic Summary
          </h2>
          <DailySummary summary={summary} />
        </div>
      )}

      {/* Top News Clusters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/20 border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Top News Clusters
          </h2>
          <div className="space-y-3">
            {(summary?.topClusters || []).map((cluster) => (
              <div
                key={cluster.id}
                className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg"
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
                  <span className="text-xs text-gray-500">
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
        <div className="bg-gray-800/20 border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Highest Impact Articles
          </h2>
          <div className="space-y-3">
            {topArticles.map((article) => (
              <div
                key={article.id}
                className="p-3 bg-gray-800/40 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      categoryColors[article.category] || ""
                    }`}
                  >
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-500">{article.source}</span>
                </div>
                <p className="text-sm text-gray-200 line-clamp-1">
                  {article.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
