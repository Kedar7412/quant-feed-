"use client";

import { useState } from "react";
import {
  ArrowRight,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Pathway, NewsArticle } from "@/lib/types";

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

  const getAdjustedConfidence = (baseConfidence: number): number => {
    const activeRatio = activeInputs.size / articles.length;
    const adjustment = (activeRatio - 0.5) * 20;
    return Math.min(100, Math.max(0, Math.round(baseConfidence + adjustment)));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* News Inputs Panel */}
      <div className="lg:col-span-1 bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">
          News Inputs ({activeInputs.size}/{articles.length} active)
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Toggle news events on/off to see how predicted pathways change
        </p>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {articles.slice(0, 12).map((article) => {
            const isActive = activeInputs.has(article.id);
            return (
              <button
                key={article.id}
                onClick={() => toggleInput(article.id)}
                className={`w-full text-left flex items-start gap-2 p-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-gray-700/50 border border-gray-600/50"
                    : "bg-gray-800/30 border border-gray-800 opacity-50"
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Pathway Selection & Visualization */}
      <div className="lg:col-span-2 space-y-4">
        {/* Pathway Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pathways.map((pathway) => (
            <button
              key={pathway.id}
              onClick={() => setSelectedPathway(pathway)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedPathway?.id === pathway.id
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50"
              }`}
            >
              {pathway.title}
            </button>
          ))}
        </div>

        {/* Selected Pathway Detail */}
        {selectedPathway && (
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5">
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
                  {getAdjustedConfidence(selectedPathway.probability) > 50 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-lg font-bold text-white">
                    {getAdjustedConfidence(selectedPathway.probability)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">probability</p>
              </div>
            </div>

            {/* Steps visualization */}
            <div className="space-y-3 mt-6">
              {selectedPathway.steps.map((step, idx) => {
                const adjustedConfidence = getAdjustedConfidence(step.confidence);
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

                return (
                  <div key={step.id}>
                    <div
                      className={`border rounded-lg p-3 ${levelColor}`}
                    >
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
                            {adjustedConfidence}%
                          </span>
                        </div>
                      </div>
                      {/* Confidence bar */}
                      <div className="mt-2 h-1 w-full bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${adjustedConfidence}%` }}
                        />
                      </div>
                    </div>
                    {idx < selectedPathway.steps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowRight className="h-3 w-3 text-gray-600 rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center gap-4 text-xs text-gray-500">
              <span>Timeframe: {selectedPathway.timeframeWeeks} weeks</span>
              <span>Impact Level: {selectedPathway.impactLevel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
