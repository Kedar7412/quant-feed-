"use client";

import { motion } from "framer-motion";
import { Activity, TrendingUp } from "lucide-react";
import { TopicCorrelation } from "@/lib/types";

interface TopicCorrelationsPanelProps {
  correlations: TopicCorrelation[];
}

/**
 * Surfaces the topic-correlation engine's output: clusters of related articles
 * with their shared keywords and change velocity. This makes the "distinguish
 * change between old and new" capability visible - fast-moving threads bubble
 * to the top with a live velocity meter.
 */
export function TopicCorrelationsPanel({
  correlations,
}: TopicCorrelationsPanelProps) {
  if (!correlations || correlations.length === 0) {
    return null;
  }

  // Show the most active clusters first (already sorted by velocity in the API,
  // but sort defensively here too).
  const topClusters = [...correlations]
    .sort((a, b) => b.changeVelocity - a.changeVelocity)
    .slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-premium rounded-xl p-4 w-full"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-lime" />
        <h3 className="text-sm font-semibold text-white">Trending Threads</h3>
        <span className="text-[10px] text-gray-500 ml-auto">
          {correlations.length} correlated {correlations.length === 1 ? "topic" : "topics"}
        </span>
      </div>

      <div className="space-y-2.5">
        {topClusters.map((cluster) => {
          const velocityPct = Math.round(cluster.changeVelocity * 100);
          const isHot = cluster.changeVelocity > 0.5;
          const isActive = cluster.changeVelocity > 0;

          return (
            <div
              key={cluster.topicId}
              className="glass rounded-lg p-3 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TrendingUp
                    className={`h-3 w-3 shrink-0 ${
                      isHot
                        ? "text-emerald-400"
                        : isActive
                          ? "text-amber-400"
                          : "text-gray-500"
                    }`}
                  />
                  <span className="text-xs text-gray-300 truncate">
                    {cluster.articleIds.length} related articles
                  </span>
                </div>
                <span
                  className={`text-[10px] font-medium shrink-0 ${
                    isHot
                      ? "text-emerald-400"
                      : isActive
                        ? "text-amber-400"
                        : "text-gray-500"
                  }`}
                  title="Change velocity: share of cluster published in the last 24-48h"
                >
                  {velocityPct}% velocity
                </span>
              </div>

              {/* Velocity meter */}
              <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHot
                      ? "bg-emerald-400"
                      : isActive
                        ? "bg-amber-400"
                        : "bg-gray-600"
                  }`}
                  style={{ width: `${Math.max(velocityPct, isActive ? 8 : 4)}%` }}
                />
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1">
                {cluster.keywords.slice(0, 4).map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
        Threads cluster articles by shared keywords. Velocity reflects how much of
        a thread was published in the last 24-48 hours - higher means the story is
        actively developing.
      </p>
    </motion.div>
  );
}
