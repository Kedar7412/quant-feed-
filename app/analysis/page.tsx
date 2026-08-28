"use client";

import { Brain, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { PathwaySimulator } from "@/components/PathwaySimulator";
import { useAnalysis, useNews } from "@/lib/hooks/useApiData";

export default function AnalysisPage() {
  const { data: analysisData, loading: analysisLoading } = useAnalysis();
  const { data: newsData, loading: newsLoading } = useNews();

  const loading = analysisLoading || newsLoading;
  const summary = analysisData?.summary;
  const pathways = analysisData?.pathways || [];
  const articles = newsData?.articles || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-indigo-400" />
          AI Analysis
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Economic pathway predictions from micro to macro with interactive simulation
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-400">Loading analysis...</span>
        </div>
      ) : (
        <>
          {/* Daily Analysis Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <h2 className="text-base font-semibold text-white mb-3">
              Today&apos;s AI Analysis
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed mb-4">
              {summary?.headline || "Loading analysis..."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-lg p-4"
              >
                <h3 className="text-xs font-semibold text-indigo-400 mb-2">
                  Key Takeaways
                </h3>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  {(summary?.keyTakeaways || []).slice(0, 4).map((takeaway, i) => (
                    <li key={i}>- {takeaway}</li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="glass rounded-lg p-4"
              >
                <h3 className="text-xs font-semibold text-amber-400 mb-2">
                  Economic Indicators
                </h3>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  {(summary?.economicIndicators || []).slice(0, 4).map((ind, i) => (
                    <li key={i}>
                      - {ind.name}: {ind.value}{" "}
                      <span
                        className={
                          ind.trend === "up"
                            ? "text-green-400"
                            : ind.trend === "down"
                              ? "text-red-400"
                              : "text-gray-400"
                        }
                      >
                        ({ind.trend === "up" ? "+" : ind.trend === "down" ? "" : ""}{ind.change}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </motion.div>

          {/* Pathway Simulator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">
              Pathway Simulator
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Select different news inputs to simulate how economic pathways might change. Toggle events
              on/off to explore alternative scenarios.
            </p>
            <PathwaySimulator pathways={pathways} articles={articles} />
          </motion.div>
        </>
      )}
    </div>
  );
}
