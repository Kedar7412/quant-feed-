/**
 * Pure scoring -> GPU-attribute mapping for the Step 2 WebGL engine.
 *
 * Every function here is deterministic and allocation-lean: it either returns a
 * primitive or writes into a caller-supplied typed-array offset. There is no
 * hidden state and no per-call heap allocation, so these run comfortably inside
 * the render loop's hot path.
 */

import type { EconomicNode } from "@/lib/types";
import { CATEGORY_COLORS, LAYOUT, type Sentiment } from "./types";

/** Clamp helper (branch-only, no allocation). */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Resolve the "impact" score for a node using the same precedence the backend
 * and REST layer use: economicImpactScore, then val, then a neutral default 5.
 */
export function resolveImpact(node: EconomicNode): number {
  return node.economicImpactScore ?? node.val ?? 5;
}

/**
 * Impact (1..10) -> instance scale. Monotonic non-decreasing: a higher impact
 * never maps to a smaller scale. Linearly interpolates between MIN_SCALE and
 * MAX_SCALE across the 1..10 impact domain and clamps out-of-range inputs.
 */
export function impactToScale(impact: number): number {
  const t = clamp((impact - 1) / 9, 0, 1);
  return LAYOUT.MIN_SCALE + t * (LAYOUT.MAX_SCALE - LAYOUT.MIN_SCALE);
}

/**
 * freshnessScore (0..1) -> emissive intensity (0..1). Fresher nodes glow more.
 * Monotonic and clamped.
 */
export function freshnessToEmissive(freshnessScore: number | undefined): number {
  return clamp(freshnessScore ?? 0, 0, 1);
}

/** Freshness tint bucket used by the design system (fresh / recent / older). */
export type FreshnessTier = "fresh" | "recent" | "older";

/**
 * freshnessScore (0..1) -> tier. >=0.66 fresh, >=0.33 recent, else older.
 */
export function freshnessToTier(freshnessScore: number | undefined): FreshnessTier {
  const f = clamp(freshnessScore ?? 0, 0, 1);
  return f >= 0.66 ? "fresh" : f >= 0.33 ? "recent" : "older";
}

/** Category -> exact base color hex string (design-system canonical). */
export function categoryToColorHex(category: EconomicNode["category"]): string {
  return CATEGORY_COLORS[category];
}

/**
 * Derive the sentiment bucket from an impact score using the rule shared by the
 * backend (services/graph_service.py) and the REST layer (app/api/graph/route.ts):
 * score >= 7 => positive, <= 3 => negative, else neutral.
 */
export function deriveSentiment(node: EconomicNode): Sentiment {
  const score = resolveImpact(node);
  return score >= 7 ? "positive" : score <= 3 ? "negative" : "neutral";
}

/** Sentiment -> heatmap tint hex (green up / red down / amber neutral). */
export function sentimentToTintHex(sentiment: Sentiment): string {
  return sentiment === "positive"
    ? "#22c55e"
    : sentiment === "negative"
      ? "#ef4444"
      : "#f59e0b";
}

/**
 * Article age (ms since publish) -> Z depth for the time-axis projection.
 * Older articles recede (map to a more-negative Z); fresh articles sit near 0.
 * Monotonic: a larger age never maps to a nearer (larger) Z. Clamped to the
 * MAX_AGE_MS horizon so ancient nodes pile at the far plane rather than fly off.
 */
export function ageToZDepth(ageMs: number): number {
  const t = clamp(ageMs, 0, LAYOUT.MAX_AGE_MS) / LAYOUT.MAX_AGE_MS;
  return -t * LAYOUT.Z_DEPTH_RANGE;
}

/** Convenience: freshnessScore (0..1, 1=fresh) -> Z depth. Fresh nodes sit near 0. */
export function freshnessToZDepth(freshnessScore: number | undefined): number {
  const f = clamp(freshnessScore ?? 0, 0, 1);
  return -(1 - f) * LAYOUT.Z_DEPTH_RANGE;
}

/** Parse a #rrggbb hex string into 0..1 rgb triplet. */
function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/**
 * Write a node's base color (0..1 rgb) into `out` at `offset`, `offset+1`,
 * `offset+2`. Allocation-free apart from the tiny fixed hexToRgb tuple, which
 * the engine avoids in the hot path by precomputing per-category triplets;
 * exposed here for one-off writes.
 */
export function writeCategoryColor(
  category: EconomicNode["category"],
  out: Float32Array,
  offset: number
): void {
  const [r, g, b] = hexToRgb01(CATEGORY_COLORS[category]);
  out[offset] = r;
  out[offset + 1] = g;
  out[offset + 2] = b;
}

export { hexToRgb01 };
