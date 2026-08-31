"use client";

/**
 * Inspector drawer - node detail panel.
 *
 * Plain React DOM rendered OUTSIDE the <Canvas>. Subscribes to the store's
 * `selectedId` slice and reads full article metadata from the node registry.
 * The markup mirrors the prototype NetworkGraph's node-detail panel (headline,
 * category-gradient image fallback, source, summary, tags, freshness bar/badge,
 * Visit Article link, related-node chips) so the look is preserved after the
 * engine swap.
 */

import { useState } from "react";
import { X, ExternalLink, Clock, Zap } from "lucide-react";
import { useStore } from "zustand";
import { graph3DStore } from "@/lib/graph3d/store";
import { getNodeMeta, getRelatedNodes } from "@/lib/graph3d/nodeRegistry";
import {
  CATEGORY_COLOR_MAP,
  CATEGORY_GRADIENTS,
  getFreshnessColor,
  getFreshnessLabel,
  getTimeAgo,
} from "./hud-utils";

export function InspectorDrawer() {
  const selectedId = useStore(graph3DStore, (s) => s.selectedId);
  const [imageError, setImageError] = useState(false);

  if (!selectedId) return null;
  const article = getNodeMeta(selectedId);
  if (!article) return null;

  const related = getRelatedNodes(selectedId);
  const accent = CATEGORY_COLOR_MAP[article.category] || "#a3e635";
  const freshness = article.freshnessScore || 0;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 max-w-2xl mx-auto pointer-events-auto">
      <div
        className="glass-strong rounded-xl overflow-hidden"
        style={{ border: `1px solid ${accent}40` }}
      >
        {/* Freshness indicator bar */}
        <div className="h-1 w-full relative overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${freshness * 100}%`,
              backgroundColor: getFreshnessColor(freshness),
            }}
          />
        </div>

        <div className="p-4">
          <button
            onClick={() => graph3DStore.getState().setSelected(null)}
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-4">
            {/* Image with category-gradient fallback */}
            <div
              className="shrink-0 w-[120px] h-[80px] rounded-lg overflow-hidden"
              style={{ border: `1px solid ${accent}30` }}
            >
              {article.imageUrl && !imageError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.imageUrl}
                  alt={article.title || article.label || "Related article"}
                  loading="lazy"
                  onError={() => setImageError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${
                    CATEGORY_GRADIENTS[article.category] ||
                    "from-lime/20 to-emerald/40"
                  }`}
                >
                  <span
                    className="text-xs font-semibold capitalize"
                    style={{ color: accent }}
                  >
                    {article.category}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: accent }}
                />
                <span className="text-xs text-gray-400 capitalize">
                  {article.category}
                </span>
                {article.source && (
                  <>
                    <span className="text-xs text-gray-600">|</span>
                    <span className="text-xs text-gray-500">{article.source}</span>
                  </>
                )}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    color: getFreshnessColor(freshness),
                    backgroundColor: `${getFreshnessColor(freshness)}15`,
                  }}
                >
                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                  {getFreshnessLabel(freshness)} - {getTimeAgo(freshness)}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-white mb-1.5 leading-tight">
                {article.title || article.label}
              </h3>

              {article.summary && (
                <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                  {article.summary.length > 200
                    ? article.summary.substring(0, 200) + "..."
                    : article.summary}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {article.economicImpactScore && (
                  <span className="text-[10px] text-lime font-medium bg-lime/10 px-1.5 py-0.5 rounded">
                    <Zap className="h-2.5 w-2.5 inline mr-0.5" />
                    Impact: {article.economicImpactScore}/10
                  </span>
                )}
                {article.tags &&
                  article.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-gray-500 bg-gray-700/30 px-1.5 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            </div>

            {/* Visit Article */}
            <div className="shrink-0 flex flex-col items-end justify-between">
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-lime hover:bg-lime-soft text-black text-xs font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Visit Article
                </a>
              )}
            </div>
          </div>

          {/* Related nodes as clickable chips */}
          {related.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Related Articles ({related.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {related.map(({ node, relationship }) => (
                  <button
                    key={node.id}
                    onClick={() => graph3DStore.getState().setSelected(node.id)}
                    title={relationship}
                    className="group flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-left max-w-[200px]"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          CATEGORY_COLOR_MAP[node.category] || "#6366f1",
                      }}
                    />
                    <span className="text-[10px] text-gray-300 group-hover:text-white truncate">
                      {(node.title || node.label || "").substring(0, 35)}
                      {(node.title || node.label || "").length > 35 ? "..." : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
