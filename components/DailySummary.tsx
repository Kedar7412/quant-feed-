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
      ? "from-green-500/20 via-emerald-500/10 to-transparent"
      : summary.overallSentiment === "bearish"
      ? "from-red-500/20 via-rose-500/10 to-transparent"
      : "from-yellow-500/20 via-amber-500/10 to-transparent";

  const sentimentBorderColor =
    summary.overallSentiment === "bullish"
      ? "border-green-500/30"
      : summary.overallSentiment === "bearish"
      ? "border-red-500/30"
      : "border-yellow-500/30";

  return (
    <div className="space-y-6">
      {/* Headline with Sentiment */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`p-5 rounded-xl glass-premium bg-gradient-to-r ${sentimentGradient} border ${sentimentBorderColor}`}
      >
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full glass-premium ${sentimentBorderColor}`}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <AlertCircle className={`h-4 w-4 ${sentimentColor}`} />
            <span className={`text-xs font-bold uppercase tracking-wide ${sentimentColor}`}>
              {summary.overallSentiment}
            </span>
          </motion.div>
        </div>
        <h2 className="text-lg font-semibold text-white leading-snug">{summary.headline}</h2>
      </motion.div>

      {/* Key Takeaways */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="h-1 w-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
          Key Takeaways
        </h3>
        <ul className="space-y-2.5">
          {summary.keyTakeaways.map((takeaway, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="flex items-start gap-3 text-sm text-gray-400 pl-1"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 mt-0.5">
                {idx + 1}
              </span>
              <span className="border-l border-indigo-500/20 pl-3 leading-relaxed">{takeaway}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Economic Indicators */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="h-1 w-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
          Economic Indicators
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {summary.economicIndicators.map((indicator, idx) => (
            <motion.div
              key={indicator.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="glass-premium rounded-xl p-3.5 animate-border-glow hover:shadow-glow-sm transition-shadow duration-300"
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{indicator.name}</p>
              <motion.p
                className="text-lg font-bold text-white mt-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.1 + 0.2 }}
              >
                {indicator.value}
              </motion.p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {indicator.trend === "up" ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : indicator.trend === "down" ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                ) : (
                  <Minus className="h-3 w-3 text-gray-400" />
                )}
                <span
                  className={`text-xs font-medium ${
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
              <div className="mt-2.5 h-1 w-full bg-white/5 rounded-full overflow-hidden">
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
