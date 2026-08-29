"use client";

import { useState } from "react";
import { TrendingUp, CheckCircle, XCircle, Clock, Target } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { usePredictions } from "@/lib/hooks/useApiData";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { PredictionsSkeleton, StatSkeleton } from "@/components/LoadingSkeleton";

const statusFilters = ["all", "active", "correct", "incorrect", "expired"] as const;

const statusConfig = {
  active: { icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  correct: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  incorrect: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  expired: { icon: Clock, color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" },
};

export default function PredictionsPage() {
  const [filter, setFilter] = useState<string>("all");
  const { data, loading } = usePredictions();

  const predictions = data?.predictions || [];
  const metrics = data?.metrics || {
    total: 0,
    active: 0,
    correct: 0,
    incorrect: 0,
    expired: 0,
    accuracy: 0,
  };
  const dataSource = data?.dataSource || "sample";

  const filteredPredictions =
    filter === "all"
      ? predictions
      : predictions.filter((p) => p.status === filter);

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-lime" />
            Predictions
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Historical and active predictions with confidence scores and accuracy tracking
          </p>
        </div>
        {!loading && <DataSourceBadge dataSource={dataSource} />}
      </motion.div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          <div className="glass-premium rounded-xl p-4 hover:shadow-glow-sm transition-shadow duration-300">
            <Target className="h-5 w-5 text-lime mb-2" />
            <p className="text-2xl font-bold text-white">{metrics.total}</p>
            <p className="text-xs text-gray-500">Total Predictions</p>
          </div>
          <div className="glass-premium rounded-xl p-4 hover:shadow-glow-sm transition-shadow duration-300">
            <Clock className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{metrics.active}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <div className="glass-premium rounded-xl p-4 hover:shadow-glow-sm transition-shadow duration-300">
            <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{metrics.correct}</p>
            <p className="text-xs text-gray-500">Correct</p>
          </div>
          <div className="glass-premium rounded-xl p-4 hover:shadow-glow-sm transition-shadow duration-300">
            <Clock className="h-5 w-5 text-gray-400 mb-2" />
            <p className="text-2xl font-bold text-white">{metrics.expired}</p>
            <p className="text-xs text-gray-500">Expired</p>
          </div>
          <div className="glass-premium rounded-xl p-4 hover:shadow-glow-sm transition-shadow duration-300">
            <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{metrics.accuracy}%</p>
            <p className="text-xs text-gray-500">Accuracy Rate</p>
          </div>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {statusFilters.map((status) => (
          <motion.button
            key={status}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              filter === status
                ? "bg-lime/15 border border-lime/40 text-lime"
                : "glass text-gray-400 hover:text-gray-200"
            }`}
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </motion.button>
        ))}
      </div>

      {/* Loading State */}
      {loading && <PredictionsSkeleton />}

      {/* Predictions List */}
      {!loading && (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08 },
            },
          }}
        >
          {filteredPredictions.map((prediction, predIdx) => {
            const config = statusConfig[prediction.status];
            const StatusIcon = config.icon;

            // Recency / freshness of the prediction itself, and whether its
            // target window is still open. Active predictions past their target
            // are handled server-side (marked expired), but we still surface a
            // clear "days until / overdue" recency signal per card.
            const now = Date.now();
            const targetMs = new Date(prediction.targetDate).getTime();
            const isFuture = targetMs >= now;
            const targetRelative = formatDistanceToNow(new Date(prediction.targetDate), {
              addSuffix: true,
            });
            const createdRelative = formatDistanceToNow(new Date(prediction.createdAt), {
              addSuffix: true,
            });

            return (
              <motion.div
                key={prediction.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="glass-premium rounded-xl p-5 hover:shadow-glow-sm transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${config.bg}`}
                      >
                        <StatusIcon className={`h-3 w-3 ${config.color}`} />
                        <span className={config.color}>{prediction.status}</span>
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {prediction.category}
                      </span>
                      {/* Recency indicator: how the target window relates to now */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          prediction.status === "active" && isFuture
                            ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
                            : "text-gray-400 border-gray-500/20 bg-gray-500/10"
                        }`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {isFuture ? `Target ${targetRelative}` : `Window closed ${targetRelative}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      {prediction.title}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{prediction.description}</p>
                    {prediction.outcome && (
                      <p className="text-xs text-gray-300 mt-2 p-2.5 glass-premium rounded-lg border-l-2 border-lime">
                        Outcome: {prediction.outcome}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {/* Animated confidence ring */}
                    <div className="relative w-14 h-14 mx-auto">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="3"
                        />
                        <motion.circle
                          cx="28"
                          cy="28"
                          r="24"
                          fill="none"
                          stroke="url(#confidence-gradient)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: "0 150.8" }}
                          animate={{ strokeDasharray: `${prediction.confidence * 1.508} 150.8` }}
                          transition={{ duration: 1.2, delay: predIdx * 0.1, ease: "easeOut" }}
                        />
                        <defs>
                          <linearGradient id="confidence-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#a3e635" />
                            <stop offset="100%" stopColor="#4ade80" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{prediction.confidence}%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">confidence</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04] text-xs text-gray-500">
                  <span title={createdRelative}>
                    Created: {format(new Date(prediction.createdAt), "MMM dd, yyyy")}
                  </span>
                  <span title={targetRelative}>
                    Target: {format(new Date(prediction.targetDate), "MMM dd, yyyy")}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
