"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { Pathway, NewsArticle } from "@/lib/types";
import { useSimulation } from "@/lib/hooks/useApiData";

interface PathwaySimulatorProps {
  pathways: Pathway[];
  articles: NewsArticle[];
}

export function PathwaySimulator({ pathways, articles }: PathwaySimulatorProps) {
  const [activeInputs, setActiveInputs] = useState<Set<string>>(
    new Set(articles.slice(0, 8).map((a) => a.id))
  );
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(
    pathways[0] || null
  );
  const [simulatedPathways, setSimulatedPathways] = useState<Pathway[]>(pathways);
  const { simulate, loading: simulating } = useSimulation();

  const selectedRef = useRef(selectedPathway);
  selectedRef.current = selectedPathway;

  const runSimulation = useCallback(async () => {
    const articleIds = Array.from(activeInputs);
    if (articleIds.length === 0) return;
    const result = await simulate(articleIds);
    setSimulatedPathways(result);
    const current = selectedRef.current;
    if (current) {
      const updated = result.find((p) => p.id === current.id);
      setSelectedPathway(updated || result[0] || null);
    }
  }, [activeInputs, simulate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 500);
    return () => clearTimeout(timer);
  }, [activeInputs, runSimulation]);

  const toggleInput = (articleId: string) => {
    setActiveInputs((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* News Inputs Panel */}
      <div className="lg:col-span-1 glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">
          News Inputs ({activeInputs.size}/{articles.length} active)
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Toggle news events on/off to see how predicted pathways change
        </p>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          <AnimatePresence>
            {articles.slice(0, 12).map((article) => {
              const isActive = activeInputs.has(article.id);
              return (
                <motion.button
                  key={article.id}
                  layout
                  onClick={() => toggleInput(article.id)}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full text-left flex items-start gap-2 p-2 rounded-lg transition-colors ${
                    isActive
                      ? "glass-strong"
                      : "bg-white/5 border border-white/5 opacity-50"
                  }`}
                >
                  {isActive ? (
                    <ToggleRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs text-gray-300 line-clamp-2">
                    {article.title}
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Pathway Selection & Visualization */}
      <div className="lg:col-span-2 space-y-4">
        {/* Simulation loading indicator */}
        {simulating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs text-indigo-400"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Running simulation...</span>
          </motion.div>
        )}

        {/* Pathway Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {simulatedPathways.map((pathway) => (
            <motion.button
              key={pathway.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPathway(pathway)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedPathway?.id === pathway.id
                  ? "glass-strong text-indigo-300"
                  : "glass text-gray-400 hover:text-gray-200"
              }`}
            >
              {pathway.title}
            </motion.button>
          ))}
        </div>

        {/* Selected Pathway Detail */}
        <AnimatePresence mode="wait">
          {selectedPathway && (
            <motion.div
              key={selectedPathway.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {selectedPathway.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedPathway.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1">
                    {selectedPathway.probability > 50 ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-lg font-bold text-white">
                      {selectedPathway.probability}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">probability</p>
                </div>
              </div>

              {/* Steps visualization */}
              <div className="space-y-3 mt-6">
                {selectedPathway.steps.map((step, idx) => {
                  const levelColor =
                    step.level === "micro"
                      ? "border-green-500/30 bg-green-500/5"
                      : step.level === "meso"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-blue-500/30 bg-blue-500/5";
                  const levelBadge =
                    step.level === "micro"
                      ? "bg-green-500/10 text-green-400"
                      : step.level === "meso"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-blue-500/10 text-blue-400";
                  const barGradient =
                    step.level === "micro"
                      ? "from-green-500 to-emerald-400"
                      : step.level === "meso"
                      ? "from-amber-500 to-orange-400"
                      : "from-blue-500 to-indigo-400";

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1, duration: 0.3 }}
                    >
                      <div className={`border rounded-lg p-3 ${levelColor}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono">
                              {idx + 1}.
                            </span>
                            <span className="text-sm text-gray-200">
                              {step.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${levelBadge}`}
                            >
                              {step.level}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              {step.confidence}%
                            </span>
                          </div>
                        </div>
                        {/* Animated confidence bar with gradient */}
                        <div className="mt-2 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${step.confidence}%` }}
                            transition={{ delay: idx * 0.1 + 0.2, duration: 0.6, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${barGradient} rounded-full`}
                          />
                        </div>
                      </div>
                      {idx < selectedPathway.steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <ArrowRight className="h-3 w-3 text-indigo-500 rotate-90" />
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-4 text-xs text-gray-500">
                <span>Timeframe: {selectedPathway.timeframeWeeks} weeks</span>
                <span>Impact Level: {selectedPathway.impactLevel}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
