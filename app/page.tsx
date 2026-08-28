"use client";

import { useMemo } from "react";
import { DailySummary } from "@/components/DailySummary";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { useAnalysis, useNews } from "@/lib/hooks/useApiData";
import {
  Newspaper,
  TrendingUp,
  Network,
  Activity,
  ArrowUpRight,
  Sparkles,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { motion } from "framer-motion";

const categoryColors: Record<string, string> = {
  domestic: "bg-emerald/10 text-emerald border-emerald/20",
  international: "bg-sky-400/10 text-sky-400 border-sky-400/20",
  economic: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  political: "bg-red-400/10 text-red-400 border-red-400/20",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const sentimentLabel: Record<string, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

export default function DashboardPage() {
  const { data: analysisData, loading: analysisLoading } = useAnalysis();
  const { data: newsData, loading: newsLoading, dataSource } = useNews();

  const loading = analysisLoading || newsLoading;
  const summary = analysisData?.summary;
  const articles = useMemo(() => newsData?.articles || [], [newsData]);

  // Latest headlines by publish time for the timeline card.
  const timeline = useMemo(
    () =>
      [...articles]
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        )
        .slice(0, 6),
    [articles]
  );

  // Impact over the last 7 days: sum economic impact per calendar day.
  const impactSeries = useMemo(() => {
    const days: { label: string; total: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ label: format(d, "EEE"), total: 0, count: 0 });
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    for (const a of articles) {
      const t = new Date(a.publishedAt);
      t.setHours(0, 0, 0, 0);
      const idx = Math.round(
        (t.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (idx >= 0 && idx < 7) {
        days[idx].total += a.economicImpactScore || 0;
        days[idx].count += 1;
      }
    }
    return days;
  }, [articles]);

  const maxImpact = Math.max(1, ...impactSeries.map((d) => d.total));

  const avgImpact = useMemo(() => {
    if (articles.length === 0) return 0;
    const sum = articles.reduce((s, a) => s + (a.economicImpactScore || 0), 0);
    return Math.round((sum / articles.length) * 10) / 10;
  }, [articles]);

  const topClusters = summary?.topClusters || [];

  if (loading) {
    return <DashboardSkeleton />;
  }

  const stats = [
    {
      href: "/news",
      icon: Newspaper,
      value: articles.length,
      label: "Articles Analyzed",
    },
    {
      href: "/network",
      icon: Network,
      value: topClusters.length,
      label: "News Clusters",
    },
    {
      href: "/analysis",
      icon: Activity,
      value: analysisData?.pathways.length || 0,
      label: "Active Pathways",
    },
    {
      href: "/analysis",
      icon: TrendingUp,
      value: `${avgImpact}/10`,
      label: "Avg Impact Score",
    },
  ];

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            AI-powered economic intelligence for{" "}
            <span className="text-gray-300 font-medium">
              {summary?.date ||
                new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
            </span>
          </p>
        </div>
        <DataSourceBadge dataSource={dataSource} />
      </motion.div>

      {/* Stat cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card-premium p-5 group card-hover-glow"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center justify-center h-9 w-9 rounded-full bg-lime/10 text-lime">
                <stat.icon className="h-4 w-4" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-lime transition-colors" />
            </div>
            <p className="text-3xl font-bold text-white mt-4 tracking-tight">
              {stat.value}
            </p>
            <p className="text-xs text-muted mt-1">{stat.label}</p>
          </Link>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily summary (spans 2) */}
        {summary && (
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 card-premium p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              <h2 className="text-lg font-semibold text-white">
                Daily Economic Summary
              </h2>
            </div>
            <DailySummary summary={summary} />
          </motion.div>
        )}

        {/* Right column */}
        <div className="space-y-6">
          {/* Trending threads */}
          <motion.div variants={itemVariants} className="card-premium p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-lime" />
              <h2 className="text-base font-semibold text-white">Trending Threads</h2>
            </div>
            <div className="space-y-2.5">
              {topClusters.slice(0, 5).map((cluster) => (
                <div
                  key={cluster.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#141414] border border-[#242424] p-3 hover:border-[#333] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          categoryColors[cluster.category] || ""
                        }`}
                      >
                        {cluster.category}
                      </span>
                      <span className="text-[10px] text-muted">
                        {cluster.articleCount} articles
                      </span>
                    </div>
                    <p className="text-sm text-gray-200 truncate">{cluster.title}</p>
                  </div>
                  <span className="text-sm font-bold text-lime shrink-0">
                    {cluster.impactScore}
                    <span className="text-[10px] text-muted font-normal">/10</span>
                  </span>
                </div>
              ))}
              {topClusters.length === 0 && (
                <p className="text-xs text-muted">No active clusters yet.</p>
              )}
            </div>
          </motion.div>

          {/* Beige featured / premium card */}
          <motion.div variants={itemVariants} className="card-beige p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Premium Insight
              </span>
            </div>
            <p className="text-lg font-bold mt-3 leading-snug">
              Markets are trending{" "}
              {sentimentLabel[summary?.overallSentiment || "neutral"].toLowerCase()} today
            </p>
            <p className="text-sm mt-2 text-[#3a3428]">
              {articles.length} articles analyzed across {topClusters.length} clusters.
              Explore the pathway simulator to model how these events cascade.
            </p>
            <Link
              href="/analysis"
              className="inline-flex items-center gap-1.5 mt-4 rounded-full bg-[#1a1a1a] text-beige px-4 py-2 text-xs font-semibold hover:bg-black transition-colors"
            >
              Open Analysis
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Bottom grid: timeline + impact chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest headlines timeline */}
        <motion.div variants={itemVariants} className="card-premium p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-lime" />
            <h2 className="text-base font-semibold text-white">Latest Headlines</h2>
          </div>
          <div className="relative space-y-4 pl-4 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-[#2a2a2a]">
            {timeline.map((article) => (
              <div key={article.id} className="relative">
                <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full bg-lime shadow-[0_0_6px_rgba(163,230,53,0.5)] ring-2 ring-[#0a0a0a]" />
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-200 leading-snug line-clamp-2">
                    {article.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                  <span className="text-gray-400">{article.source}</span>
                  <span>&middot;</span>
                  <span>
                    {formatDistanceToNow(new Date(article.publishedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <p className="text-xs text-muted">No recent headlines.</p>
            )}
          </div>
        </motion.div>

        {/* Impact over time chart */}
        <motion.div variants={itemVariants} className="card-premium p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-lime" />
            <h2 className="text-base font-semibold text-white">Impact Over Time</h2>
          </div>
          <p className="text-xs text-muted mb-6">
            Aggregate economic impact of tracked articles, last 7 days
          </p>
          <div className="flex items-end justify-between gap-3 h-40">
            {impactSeries.map((day, idx) => {
              const heightPct = Math.round((day.total / maxImpact) * 100);
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                >
                  <span className="text-[10px] text-muted">{day.count || ""}</span>
                  <div className="w-full flex items-end h-full">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(heightPct, day.total > 0 ? 6 : 2)}%` }}
                      transition={{ delay: idx * 0.06, duration: 0.6, ease: "easeOut" }}
                      className={`w-full rounded-t-md ${
                        day.total > 0
                          ? "bg-gradient-to-t from-emerald/40 to-lime"
                          : "bg-[#242424]"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{day.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
