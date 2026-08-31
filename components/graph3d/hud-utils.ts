/**
 * Shared HUD display helpers for the Step 2 WebGL engine.
 *
 * These are plain, allocation-light functions reused across the HUD panels
 * (inspector drawer, filters, heatmap legend, timeline). They mirror the
 * freshness/label helpers the prototype NetworkGraph used so the look and feel
 * of the node-detail panel is preserved after the engine swap.
 */

import { CATEGORY_COLORS } from "@/lib/graph3d/types";
import type { EconomicNode } from "@/lib/types";

export const CATEGORY_LABELS: Record<EconomicNode["category"], string> = {
  domestic: "Domestic",
  international: "International",
  economic: "Economic",
  political: "Political",
};

export const CATEGORY_COLOR_MAP = CATEGORY_COLORS;

export const CATEGORY_GRADIENTS: Record<EconomicNode["category"], string> = {
  domestic: "from-green-500/20 to-green-900/40",
  international: "from-blue-500/20 to-blue-900/40",
  economic: "from-amber-500/20 to-amber-900/40",
  political: "from-red-500/20 to-red-900/40",
};

export function getFreshnessLabel(score: number): string {
  if (score > 0.7) return "Fresh";
  if (score > 0.3) return "Recent";
  if (score > 0.1) return "Aging";
  return "Old";
}

export function getFreshnessColor(score: number): string {
  if (score > 0.7) return "#22c55e";
  if (score > 0.3) return "#f59e0b";
  return "#6b7280";
}

export function getTimeAgo(score: number): string {
  // Approximate time from score (half-life 12h: score = e^(-ln2/12 * hours))
  if (score > 0.9) return "< 2h ago";
  if (score > 0.7) return "< 6h ago";
  if (score > 0.5) return "< 12h ago";
  if (score > 0.3) return "< 1 day ago";
  if (score > 0.1) return "< 3 days ago";
  return "> 3 days ago";
}
