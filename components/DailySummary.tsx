"use client";

import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { DailySummary as DailySummaryType } from "@/lib/types";

interface DailySummaryProps {
  summary: DailySummaryType;
}

export function DailySummary({ summary }: DailySummaryProps) {
  const sentimentColor =
    summary.overallSentiment === "bullish"
      ? "text-green-400"
      : summary.overallSentiment === "bearish"
      ? "text-red-400"
      : "text-yellow-400";

  const sentimentGradient =
    summary.overallSentiment === "bullish"
      ? "from-green-500/20 to-emerald-500/5"
      : summary.overallSentiment === "bearish"
      ? "from-red-500/20 to-rose-500/5"
      : "from-yellow-500/20 to-amber-500/5";

  return (
    <div className="space-y-6">
      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`p-4 rounded-xl glass bg-gradient-to-r ${sentimentGradient}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className={`h-4 w-4 ${sentimentColor}`} />
          <span className={`text-xs font-semibold uppercase ${sentimentColor}`}>
            Overall Sentiment: {summary.overallSentiment}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-white">{summary.headline}</h2>
      </motion.div>

      {/* Key Takeaways */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Key Takeaways</h3>
        <ul className="space-y-2">
          {summary.keyTakeaways.map((takeaway, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="flex items-start gap-2 text-sm text-gray-400"
            >
              <span className="text-indigo-400 mt-1 shrink-0">&#8226;</span>
              {takeaway}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Economic Indicators */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Economic Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {summary.economicIndicators.map((indicator, idx) => (
            <motion.div
              key={indicator.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="glass rounded-lg p-3"
            >
              <p className="text-xs text-gray-500">{indicator.name}</p>
              <p className="text-lg font-semibold text-white mt-1">{indicator.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {indicator.trend === "up" ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : indicator.trend === "down" ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                ) : (
                  <Minus className="h-3 w-3 text-gray-400" />
                )}
                <span
                  className={`text-xs ${
                    indicator.change > 0
                      ? "text-green-400"
                      : indicator.change < 0
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {indicator.change > 0 ? "+" : ""}
                  {indicator.change}%
                </span>
              </div>
              {/* Animated indicator bar */}
              <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Math.abs(indicator.change) * 10, 100)}%` }}
                  transition={{ delay: idx * 0.1 + 0.3, duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    indicator.change > 0
                      ? "bg-gradient-to-r from-green-500 to-emerald-400"
                      : indicator.change < 0
                      ? "bg-gradient-to-r from-red-500 to-rose-400"
                      : "bg-gray-500"
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
