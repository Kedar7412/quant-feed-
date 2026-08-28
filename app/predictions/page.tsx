"use client";

import { useState } from "react";
import { TrendingUp, CheckCircle, XCircle, Clock, Target, Loader2 } from "lucide-react";
import { format } from "date-fns";
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-indigo-400" />
          Predictions
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Historical and active predictions with confidence scores and accuracy tracking
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
          <Target className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.total}</p>
          <p className="text-xs text-gray-400">Total Predictions</p>
        </div>
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
          <Clock className="h-5 w-5 text-blue-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.active}</p>
          <p className="text-xs text-gray-400">Active</p>
        </div>
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
          <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.correct}</p>
          <p className="text-xs text-gray-400">Correct</p>
        </div>
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
          <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">{metrics.accuracy}%</p>
          <p className="text-xs text-gray-400">Accuracy Rate</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {statusFilters.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === status
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50"
            }`}
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
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
        <div className="space-y-3">
          {filteredPredictions.map((prediction) => {
            const config = statusConfig[prediction.status];
            const StatusIcon = config.icon;

            return (
              <div
                key={prediction.id}
                className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5"
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
                      <p className="text-xs text-gray-300 mt-2 p-2 bg-gray-800/50 rounded-lg border-l-2 border-indigo-500">
                        Outcome: {prediction.outcome}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-white">
                      {prediction.confidence}%
                    </div>
                    <p className="text-[10px] text-gray-500">confidence</p>
                    {/* Confidence bar */}
                    <div className="mt-2 w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${prediction.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500">
                  <span>
                    Created: {format(new Date(prediction.createdAt), "MMM dd, yyyy")}
                  </span>
                  <span>
                    Target: {format(new Date(prediction.targetDate), "MMM dd, yyyy")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
