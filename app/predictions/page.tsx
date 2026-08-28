"use client";

import { useState } from "react";
import { TrendingUp, CheckCircle, XCircle, Clock, Target, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { usePredictions } from "@/lib/hooks/useApiData";

const statusFilters = ["all", "active", "correct", "incorrect"] as const;

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
  const metrics = data?.metrics || { total: 0, active: 0, correct: 0, incorrect: 0, accuracy: 0 };

  const filteredPredictions =
    filter === "all"
      ? predictions
      : predictions.filter((p) => p.status === filter);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-indigo-400" />
          Predictions
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Historical and active predictions with confidence scores and accuracy tracking
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="glass rounded-xl p-4">
          <Target className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.total}</p>
          <p className="text-xs text-gray-400">Total Predictions</p>
        </div>
        <div className="glass rounded-xl p-4">
          <Clock className="h-5 w-5 text-blue-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.active}</p>
          <p className="text-xs text-gray-400">Active</p>
        </div>
        <div className="glass rounded-xl p-4">
          <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.correct}</p>
          <p className="text-xs text-gray-400">Correct</p>
        </div>
        <div className="glass rounded-xl p-4">
          <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.accuracy}%</p>
          <p className="text-xs text-gray-400">Accuracy Rate</p>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {statusFilters.map((status) => (
          <motion.button
            key={status}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === status
                ? "glass-strong text-indigo-300"
                : "glass text-gray-400 hover:text-gray-200"
            }`}
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </motion.button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-400">Loading predictions...</span>
        </div>
      )}

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
          {filteredPredictions.map((prediction) => {
            const config = statusConfig[prediction.status];
            const StatusIcon = config.icon;

            return (
              <motion.div
                key={prediction.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="glass rounded-xl p-5"
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
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      {prediction.title}
                    </h3>
                    <p className="text-xs text-gray-400">{prediction.description}</p>
                    {prediction.outcome && (
                      <p className="text-xs text-gray-300 mt-2 p-2 glass rounded-lg border-l-2 border-indigo-500">
                        Outcome: {prediction.outcome}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {/* Animated progress ring */}
                    <div className="relative w-14 h-14 mx-auto">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          fill="none"
                          stroke="url(#gradient)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${prediction.confidence * 1.508} 150.8`}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#8b5cf6" />
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
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                  <span>
                    Created: {format(new Date(prediction.createdAt), "MMM dd, yyyy")}
                  </span>
                  <span>
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
