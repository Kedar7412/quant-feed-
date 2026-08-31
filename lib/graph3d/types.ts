/**
 * Internal scene-buffer contract for the Step 2 WebGL graph engine.
 *
 * The engine keeps all per-node visual state in flat, pre-allocated typed
 * arrays sized to a fixed CAPACITY ceiling. Each live node occupies one "slot"
 * (a stable integer index into every per-node array). Slots are recycled via a
 * free-list so that remove-then-add churn (e.g. filter toggles) reuses the same
 * index instead of leaking capacity - the fix for the prototype's leak.
 *
 * These modules contain NO React / R3F / Canvas code. They are pure logic +
 * worker plumbing and are fully unit-testable outside a browser.
 */

import type { EconomicNode, EconomicEdge } from "@/lib/types";

/**
 * Maximum number of node slots the scene buffers can hold. Adds beyond this are
 * dropped-with-warning (never throw) so a runaway feed cannot corrupt the scene.
 */
export const CAPACITY = 4096;

/**
 * Maximum number of edges the edge buffers can hold. Edge topology is rewritten
 * wholesale on each `updatedEdges` diff, so this only bounds the allocation.
 */
export const EDGE_CAPACITY = 16384;

/** Floats per node in the position buffer: x, y, z. */
export const FLOATS_PER_POSITION = 3;

/** Floats per node in the color buffer: r, g, b (0..1). */
export const FLOATS_PER_COLOR = 3;

/** Floats per edge in the endpoint buffer: sourceSlot, targetSlot, strength. */
export const FLOATS_PER_EDGE = 3;

/** Category -> exact base color hex (must match backend + REST + design system). */
export const CATEGORY_COLORS: Record<EconomicNode["category"], string> = {
  domestic: "#22c55e",
  international: "#3b82f6",
  economic: "#f59e0b",
  political: "#ef4444",
};

/** Layout constants shared by the force sim and the visual mapping. */
export const LAYOUT = {
  /** Minimum instance scale for the lowest-impact node. */
  MIN_SCALE: 0.5,
  /** Maximum instance scale for the highest-impact node. */
  MAX_SCALE: 3.0,
  /** Z-depth (world units) spanned by the article-age time axis. */
  Z_DEPTH_RANGE: 400,
  /** Age (ms) mapped to the far end of the Z axis (~30 days). */
  MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * A graph diff describing an incremental change to the scene. Field names align
 * with `lib/types.ts` (EconomicNode / EconomicEdge).
 *
 * CONTRACT: `updatedEdges` is applied as a FULL REWRITE of the edge topology,
 * not a partial patch. `store.applyDiff` -> `rewriteEdges` replaces the entire
 * edge buffer with exactly the edges in `updatedEdges` (skipping any whose
 * endpoints are not both live). Consequently the PRODUCER must always send the
 * complete current edge set, never just the edges touched by the latest change.
 * The backend ingestion hook (`backend/app/tasks/ingest.py`
 * `build_ingestion_diff`) upholds this by publishing the cumulative persisted
 * edge set after each run, so a streamed diff never drops previously loaded
 * edges. (`addedNodes`/`removedNodes` ARE incremental patches, only edges are a
 * full replace.)
 */
export interface GraphDiff {
  addedNodes: EconomicNode[];
  removedNodes: string[];
  updatedEdges: EconomicEdge[];
}

/** Derived sentiment bucket (matches the backend/REST economicImpactScore rule). */
export type Sentiment = "positive" | "negative" | "neutral";

/** A contiguous dirty range of node slots the render loop must re-upload. */
export interface DirtyRange {
  start: number;
  count: number;
}
