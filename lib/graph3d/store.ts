/**
 * Vanilla Zustand store owning the Step 2 WebGL scene buffers.
 *
 * This store is created OUTSIDE React (via `zustand/vanilla` `createStore`, not
 * the `zustand` React hook) so the render loop and the force-sim worker client
 * can mutate the scene imperatively without triggering React re-renders. React
 * components (FEAT-003) subscribe to selector-friendly slices for the HUD only.
 *
 * All per-node visual state lives in pre-allocated typed arrays sized to
 * `CAPACITY`. Each node occupies a stable "slot" (an index into every per-node
 * array). A free-list recycles slots on removal so remove-then-add reuses the
 * exact freed index instead of leaking capacity.
 *
 * `applyDiff` is the hot path and is written to avoid per-call heap allocation:
 * it reuses module-level scratch and mutates the buffers in place. The only
 * unavoidable allocations are the `Map`/array churn from `nodeSlots` bookkeeping
 * and the returned dirty-range object from `consumeDirtyRange`, which is emitted
 * at most once per frame.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { EconomicNode, GraphData } from "@/lib/types";
import {
  CAPACITY,
  EDGE_CAPACITY,
  FLOATS_PER_POSITION,
  FLOATS_PER_COLOR,
  FLOATS_PER_EDGE,
  type GraphDiff,
  type DirtyRange,
} from "./types";
import {
  resolveImpact,
  impactToScale,
  freshnessToEmissive,
  writeCategoryColor,
} from "./visualMapping";

export interface ActiveFilters {
  category: EconomicNode["category"] | "all";
  sentiment: "positive" | "negative" | "neutral" | null;
}

export interface Graph3DState {
  // ---- Pre-allocated scene buffers (never reallocated after creation) ----
  /** Per-node position: [x, y, z] * CAPACITY. Written by the force sim. */
  readonly positions: Float32Array;
  /** Per-node uniform scale (from impact). */
  readonly scales: Float32Array;
  /** Per-node base color rgb (0..1) * CAPACITY. */
  readonly colors: Float32Array;
  /** Per-node impact score (raw, for HUD/heatmap). */
  readonly impacts: Float32Array;
  /** Per-node freshness (0..1) -> emissive intensity. */
  readonly freshness: Float32Array;
  /** Per-node selected flag (0 or 1). */
  readonly selected: Uint8Array;
  /** Edge endpoints + strength: [sourceSlot, targetSlot, strength] * edgeCount. */
  readonly edges: Float32Array;

  // ---- Bookkeeping ----
  /** id -> slot index for every live node. */
  readonly nodeSlots: Map<string, number>;
  /**
   * slot -> id reverse map, maintained in lock-step with `nodeSlots`. Lets the
   * render loop (labels) and click handler resolve an id from a slot in O(1)
   * instead of scanning the whole `nodeSlots` map every frame / click.
   */
  readonly slotIds: Map<number, string>;
  /** Stack of recycled slot indices available for reuse (LIFO). */
  readonly freeList: number[];
  /** Number of live nodes. */
  liveCount: number;
  /** Highest slot index ever handed out (high-water mark for next-free). */
  highWater: number;
  /** Number of live edges (triples in `edges`). */
  edgeCount: number;

  // ---- Dirty-range tracking (inclusive min..max touched slot) ----
  dirtyMin: number;
  dirtyMax: number;

  // ---- HUD state ----
  selectedId: string | null;
  filters: ActiveFilters;

  // ---- Imperative API ----
  initFromGraph(graph: GraphData): void;
  applyDiff(diff: GraphDiff): void;
  setSelected(id: string | null): void;
  setFilters(filters: Partial<ActiveFilters>): void;
  consumeDirtyRange(): DirtyRange | null;
  getSlot(id: string): number | undefined;
  getIdForSlot(slot: number): string | undefined;
  /**
   * Number of instances the renderer must draw: the high-water mark, NOT
   * `liveCount`. Slots are stable and sparse after removals, so a live node can
   * occupy an index >= liveCount; every slot below the high-water mark is either
   * live or a scale-0 empty (both safe to draw), so drawing `[0, highWater)`
   * covers all live nodes without truncating high-index ones.
   */
  getDrawCount(): number;

  // ---- Selector-friendly slices for the HUD ----
  getLiveCount(): number;
  getEdgeCount(): number;
  getSelectedNodeId(): string | null;
  getActiveFilters(): ActiveFilters;
}

/** Sentinel meaning "no dirty range recorded". */
const NO_DIRTY = -1;

function createInitialArrays() {
  return {
    positions: new Float32Array(CAPACITY * FLOATS_PER_POSITION),
    scales: new Float32Array(CAPACITY),
    colors: new Float32Array(CAPACITY * FLOATS_PER_COLOR),
    impacts: new Float32Array(CAPACITY),
    freshness: new Float32Array(CAPACITY),
    selected: new Uint8Array(CAPACITY),
    edges: new Float32Array(EDGE_CAPACITY * FLOATS_PER_EDGE),
  };
}

export function createGraph3DStore(): StoreApi<Graph3DState> {
  return createStore<Graph3DState>((set, get) => {
    const arrays = createInitialArrays();

    /** Mark a single slot dirty (expands the inclusive min..max window). */
    function markDirty(state: Graph3DState, slot: number): void {
      if (state.dirtyMin === NO_DIRTY || slot < state.dirtyMin) {
        state.dirtyMin = slot;
      }
      if (state.dirtyMax === NO_DIRTY || slot > state.dirtyMax) {
        state.dirtyMax = slot;
      }
    }

    /** Write a node's visual attributes into its slot. Allocation-free. */
    function writeNodeAttributes(
      state: Graph3DState,
      slot: number,
      node: EconomicNode
    ): void {
      const impact = resolveImpact(node);
      state.impacts[slot] = impact;
      state.scales[slot] = impactToScale(impact);
      state.freshness[slot] = freshnessToEmissive(node.freshnessScore);
      state.selected[slot] = 0;
      writeCategoryColor(node.category, state.colors, slot * FLOATS_PER_COLOR);
      // Positions are (re)seeded by the force sim; start at origin.
      const p = slot * FLOATS_PER_POSITION;
      state.positions[p] = node.x ?? 0;
      state.positions[p + 1] = node.y ?? 0;
      state.positions[p + 2] = 0;
    }

    /** Clear a slot's attributes when a node is removed. Allocation-free. */
    function clearSlot(state: Graph3DState, slot: number): void {
      state.impacts[slot] = 0;
      state.scales[slot] = 0;
      state.freshness[slot] = 0;
      state.selected[slot] = 0;
      const c = slot * FLOATS_PER_COLOR;
      state.colors[c] = 0;
      state.colors[c + 1] = 0;
      state.colors[c + 2] = 0;
      const p = slot * FLOATS_PER_POSITION;
      state.positions[p] = 0;
      state.positions[p + 1] = 0;
      state.positions[p + 2] = 0;
    }

    /**
     * Acquire a slot for a new node: reuse a freed slot (LIFO) if available,
     * otherwise take the next high-water index. Returns -1 at capacity so the
     * caller can drop-with-warning without throwing.
     */
    function acquireSlot(state: Graph3DState): number {
      if (state.freeList.length > 0) {
        return state.freeList.pop() as number;
      }
      if (state.highWater < CAPACITY) {
        return state.highWater++;
      }
      return -1;
    }

    /** Rewrite the edge buffer from a list of edges (full topology replace). */
    function rewriteEdges(
      state: Graph3DState,
      edges: GraphDiff["updatedEdges"]
    ): void {
      let write = 0;
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const s = state.nodeSlots.get(edge.source);
        const t = state.nodeSlots.get(edge.target);
        if (s === undefined || t === undefined) continue; // skip dangling
        if (write >= EDGE_CAPACITY) {
          console.warn(
            `[graph3d] edge capacity ${EDGE_CAPACITY} exceeded; dropping extra edges`
          );
          break;
        }
        const o = write * FLOATS_PER_EDGE;
        state.edges[o] = s;
        state.edges[o + 1] = t;
        state.edges[o + 2] = edge.strength;
        write++;
      }
      state.edgeCount = write;
    }

    function addNode(state: Graph3DState, node: EconomicNode): void {
      if (state.nodeSlots.has(node.id)) {
        // Already present: update attributes in place, mark dirty.
        const slot = state.nodeSlots.get(node.id) as number;
        writeNodeAttributes(state, slot, node);
        markDirty(state, slot);
        return;
      }
      const slot = acquireSlot(state);
      if (slot === -1) {
        console.warn(
          `[graph3d] node capacity ${CAPACITY} reached; dropping node ${node.id}`
        );
        return;
      }
      state.nodeSlots.set(node.id, slot);
      state.slotIds.set(slot, node.id);
      state.liveCount++;
      writeNodeAttributes(state, slot, node);
      markDirty(state, slot);
    }

    function removeNode(state: Graph3DState, id: string): void {
      const slot = state.nodeSlots.get(id);
      if (slot === undefined) return;
      clearSlot(state, slot);
      state.nodeSlots.delete(id);
      state.slotIds.delete(slot);
      state.freeList.push(slot);
      state.liveCount--;
      markDirty(state, slot);
    }

    return {
      ...arrays,
      nodeSlots: new Map<string, number>(),
      slotIds: new Map<number, string>(),
      freeList: [],
      liveCount: 0,
      highWater: 0,
      edgeCount: 0,
      dirtyMin: NO_DIRTY,
      dirtyMax: NO_DIRTY,
      selectedId: null,
      filters: { category: "all", sentiment: null },

      initFromGraph(graph: GraphData): void {
        const state = get();
        // Reset bookkeeping (buffers are reused, not reallocated).
        state.nodeSlots.clear();
        state.slotIds.clear();
        state.freeList.length = 0;
        state.liveCount = 0;
        state.highWater = 0;
        state.edgeCount = 0;
        state.dirtyMin = NO_DIRTY;
        state.dirtyMax = NO_DIRTY;
        state.selectedId = null;
        for (let i = 0; i < graph.nodes.length; i++) {
          addNode(state, graph.nodes[i]);
        }
        rewriteEdges(state, graph.links);
        set({}); // notify subscribers without cloning buffers
      },

      applyDiff(diff: GraphDiff): void {
        const state = get();
        // Order matters: remove first so freed slots are available for adds,
        // then edges last so endpoints resolve against the final slot map.
        for (let i = 0; i < diff.removedNodes.length; i++) {
          removeNode(state, diff.removedNodes[i]);
        }
        for (let i = 0; i < diff.addedNodes.length; i++) {
          addNode(state, diff.addedNodes[i]);
        }
        rewriteEdges(state, diff.updatedEdges);
        set({});
      },

      setSelected(id: string | null): void {
        const state = get();
        if (state.selectedId !== null) {
          const prev = state.nodeSlots.get(state.selectedId);
          if (prev !== undefined) {
            state.selected[prev] = 0;
            markDirty(state, prev);
          }
        }
        if (id !== null) {
          const slot = state.nodeSlots.get(id);
          if (slot !== undefined) {
            state.selected[slot] = 1;
            markDirty(state, slot);
          }
        }
        set({ selectedId: id });
      },

      setFilters(filters: Partial<ActiveFilters>): void {
        set({ filters: { ...get().filters, ...filters } });
      },

      consumeDirtyRange(): DirtyRange | null {
        const state = get();
        if (state.dirtyMin === NO_DIRTY) return null;
        const range: DirtyRange = {
          start: state.dirtyMin,
          count: state.dirtyMax - state.dirtyMin + 1,
        };
        state.dirtyMin = NO_DIRTY;
        state.dirtyMax = NO_DIRTY;
        return range;
      },

      getSlot(id: string): number | undefined {
        return get().nodeSlots.get(id);
      },

      getIdForSlot(slot: number): string | undefined {
        return get().slotIds.get(slot);
      },

      getDrawCount(): number {
        return get().highWater;
      },

      getLiveCount(): number {
        return get().liveCount;
      },
      getEdgeCount(): number {
        return get().edgeCount;
      },
      getSelectedNodeId(): string | null {
        return get().selectedId;
      },
      getActiveFilters(): ActiveFilters {
        return get().filters;
      },
    };
  });
}

/**
 * Singleton store instance created OUTSIDE React. The engine and worker client
 * share this instance; the HUD subscribes to it via zustand's `useStore`.
 */
export const graph3DStore = createGraph3DStore();
