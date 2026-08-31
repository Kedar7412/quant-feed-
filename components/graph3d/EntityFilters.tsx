"use client";

/**
 * Entity filters panel.
 *
 * Plain React DOM outside the <Canvas>. Filters by category and sentiment
 * (sector/entity/time are surfaced through the category chips and the
 * EventSequenceTimeline respectively). Selections are written to the store via
 * `setFilters`, which is the single source the worker-sim visibility (now) and
 * the WS subscription predicate (FEAT-004) both read from.
 *
 * A parent-supplied `onFiltersChange` callback lets the page recompute the
 * visible slot set and feed it to the force-sim worker.
 */

import { useStore } from "zustand";
import { graph3DStore } from "@/lib/graph3d/store";
import type { EconomicNode } from "@/lib/types";
import { CATEGORY_COLOR_MAP, CATEGORY_LABELS } from "./hud-utils";

type Sentiment = "positive" | "negative" | "neutral";
const CATEGORIES: EconomicNode["category"][] = [
  "domestic",
  "international",
  "economic",
  "political",
];
const SENTIMENTS: Array<{ key: Sentiment; label: string; color: string }> = [
  { key: "positive", label: "Positive", color: "#22c55e" },
  { key: "neutral", label: "Neutral", color: "#f59e0b" },
  { key: "negative", label: "Negative", color: "#ef4444" },
];

interface EntityFiltersProps {
  onFiltersChange?: () => void;
}

export function EntityFilters({ onFiltersChange }: EntityFiltersProps) {
  const filters = useStore(graph3DStore, (s) => s.filters);

  const setCategory = (category: EconomicNode["category"] | "all") => {
    graph3DStore.getState().setFilters({ category });
    onFiltersChange?.();
  };
  const setSentiment = (sentiment: Sentiment | null) => {
    graph3DStore.getState().setFilters({ sentiment });
    onFiltersChange?.();
  };

  return (
    <div className="glass rounded-xl p-3 w-48 pointer-events-auto">
      <p className="text-xs font-semibold text-gray-300 mb-2">Categories</p>
      <div className="space-y-1.5">
        <button
          onClick={() => setCategory("all")}
          className={`flex items-center gap-2 text-xs w-full text-left px-2 py-1 rounded transition-colors ${
            filters.category === "all" ? "text-white bg-white/5" : "text-gray-500"
          }`}
        >
          <span className="h-3 w-3 rounded-full shrink-0 bg-gradient-to-br from-lime to-emerald" />
          All categories
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex items-center gap-2 text-xs w-full text-left px-2 py-1 rounded transition-colors ${
              filters.category === cat ? "text-white bg-white/5" : "text-gray-500"
            }`}
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_COLOR_MAP[cat] }}
            />
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-300 mt-3 mb-2">Sentiment</p>
      <div className="space-y-1.5">
        <button
          onClick={() => setSentiment(null)}
          className={`flex items-center gap-2 text-xs w-full text-left px-2 py-1 rounded transition-colors ${
            filters.sentiment === null ? "text-white bg-white/5" : "text-gray-500"
          }`}
        >
          <span className="h-3 w-3 rounded-full shrink-0 bg-gray-500" />
          Any
        </button>
        {SENTIMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSentiment(s.key)}
            className={`flex items-center gap-2 text-xs w-full text-left px-2 py-1 rounded transition-colors ${
              filters.sentiment === s.key ? "text-white bg-white/5" : "text-gray-500"
            }`}
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
