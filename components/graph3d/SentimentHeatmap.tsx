"use client";

/**
 * Sentiment heatmap legend/overlay.
 *
 * A compact DOM overlay (outside the Canvas) that buckets the currently loaded
 * nodes by the shared sentiment derivation (impact >= 7 positive, <= 3
 * negative, else neutral) and shows a proportional bar + counts. This gives an
 * at-a-glance "market mood" read that matches the node colors used elsewhere.
 * Counts are recomputed only when the graph reloads (via the `version` prop),
 * never per frame.
 */

import { useMemo } from "react";
import { deriveSentiment, sentimentToTintHex } from "@/lib/graph3d/visualMapping";
import { getNodeMeta } from "@/lib/graph3d/nodeRegistry";
import { graph3DStore } from "@/lib/graph3d/store";
import type { Sentiment } from "@/lib/graph3d/types";

interface SentimentHeatmapProps {
  /** Bump this when the graph reloads so counts recompute. */
  version: number;
}

const ORDER: Sentiment[] = ["positive", "neutral", "negative"];
const LABEL: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function SentimentHeatmap({ version }: SentimentHeatmapProps) {
  const counts = useMemo(() => {
    const c: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    const state = graph3DStore.getState();
    state.nodeSlots.forEach((_slot, id) => {
      const meta = getNodeMeta(id);
      if (!meta) return;
      c[deriveSentiment(meta)]++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const total = counts.positive + counts.neutral + counts.negative || 1;

  return (
    <div className="glass rounded-xl p-3 w-48 pointer-events-auto">
      <p className="text-xs font-semibold text-gray-300 mb-2">Sentiment mix</p>
      <div className="flex h-2 w-full rounded-full overflow-hidden mb-2">
        {ORDER.map((s) => (
          <div
            key={s}
            style={{
              width: `${(counts[s] / total) * 100}%`,
              backgroundColor: sentimentToTintHex(s),
            }}
          />
        ))}
      </div>
      <div className="space-y-1">
        {ORDER.map((s) => (
          <div key={s} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: sentimentToTintHex(s) }}
              />
              <span className="text-gray-400">{LABEL[s]}</span>
            </div>
            <span className="text-gray-500">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
