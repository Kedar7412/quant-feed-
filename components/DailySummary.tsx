"use client";

import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
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

  const sentimentBg =
    summary.overallSentiment === "bullish"
      ? "bg-green-400/10 border-green-400/20"
      : summary.overallSentiment === "bearish"
      ? "bg-red-400/10 border-red-400/20"
      : "bg-yellow-400/10 border-yellow-400/20";

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className={`p-4 rounded-xl border ${sentimentBg}`}>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className={`h-4 w-4 ${sentimentColor}`} />
          <span className={`text-xs font-semibold uppercase ${sentimentColor}`}>
            Overall Sentiment: {summary.overallSentiment}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-white">{summary.headline}</h2>
      </div>

      {/* Key Takeaways */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Key Takeaways</h3>
        <ul className="space-y-2">
          {summary.keyTakeaways.map((takeaway, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
              <span className="text-indigo-400 mt-1 shrink-0">&#8226;</span>
              {takeaway}
            </li>
          ))}
        </ul>
      </div>

      {/* Economic Indicators */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Economic Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {summary.economicIndicators.map((indicator) => (
            <div
              key={indicator.name}
              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
