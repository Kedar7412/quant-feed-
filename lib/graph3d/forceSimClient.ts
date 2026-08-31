/**
 * Thin main-thread wrapper around the d3-force-3d Web Worker.
 *
 * Responsibilities:
 *   - start / stop the worker
 *   - feed it topology (nodes + edges from the store's current slot map) and
 *     filter visibility
 *   - scatter returned tick positions into the store's `positions` typed array
 *     and mark the touched slots dirty for the render loop
 *
 * SAFETY: worker creation is guarded so this module NO-OPS in any non-browser
 * context (SSR, unit tests) where `Worker`/`window` is unavailable. Every public
 * method tolerates being called with no live worker.
 */

import type { StoreApi } from "zustand/vanilla";
import type { EconomicNode, GraphData } from "@/lib/types";
import { FLOATS_PER_POSITION } from "./types";
import type { Graph3DState } from "./store";

const CATEGORY_INDEX: Record<EconomicNode["category"], number> = {
  domestic: 0,
  international: 1,
  economic: 2,
  political: 3,
};

interface TickMessage {
  type: "tick";
  slots: number[];
  positions: Float32Array;
}

/** True only in a real browser worker-capable context. */
export function isWorkerAvailable(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

export class ForceSimClient {
  private worker: Worker | null = null;
  private readonly store: StoreApi<Graph3DState>;

  constructor(store: StoreApi<Graph3DState>) {
    this.store = store;
  }

  /** Start the worker and seed it with the given graph topology. No-op if unavailable. */
  start(graph: GraphData): void {
    if (!isWorkerAvailable()) return;
    if (this.worker) this.stop();
    try {
      this.worker = new Worker(
        new URL("./forceWorker.worker.ts", import.meta.url),
        { type: "module" }
      );
    } catch {
      // Some environments expose Worker but reject module workers; fail soft.
      this.worker = null;
      return;
    }
    this.worker.onmessage = (event: MessageEvent<TickMessage>) =>
      this.onTick(event.data);
    this.feed(graph);
  }

  /** Send topology to the worker. No-op if not running. */
  feed(graph: GraphData): void {
    if (!this.worker) return;
    const state = this.store.getState();
    const nodes = graph.nodes
      .map((n) => {
        const slot = state.nodeSlots.get(n.id);
        if (slot === undefined) return null;
        return { slot, category: CATEGORY_INDEX[n.category] };
      })
      .filter((n): n is { slot: number; category: number } => n !== null);
    const edges = graph.links
      .map((e) => {
        const source = state.nodeSlots.get(e.source);
        const target = state.nodeSlots.get(e.target);
        if (source === undefined || target === undefined) return null;
        return { source, target, strength: e.strength };
      })
      .filter(
        (e): e is { source: number; target: number; strength: number } =>
          e !== null
      );
    this.worker.postMessage({ type: "init", nodes, edges });
  }

  /** Update which slots are visible (filtered). No-op if not running. */
  setVisibility(visibleSlots: number[]): void {
    this.worker?.postMessage({ type: "visibility", visible: visibleSlots });
  }

  /** Stop the worker and release it. Safe to call repeatedly. */
  stop(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: "stop" });
    this.worker.terminate();
    this.worker = null;
  }

  /** Scatter worker positions into the store buffer + mark dirty. */
  private onTick(msg: TickMessage): void {
    if (msg.type !== "tick") return;
    const state = this.store.getState();
    const { positions } = state;
    for (let i = 0; i < msg.slots.length; i++) {
      const slot = msg.slots[i];
      const src = i * FLOATS_PER_POSITION;
      const dst = slot * FLOATS_PER_POSITION;
      positions[dst] = msg.positions[src];
      positions[dst + 1] = msg.positions[src + 1];
      positions[dst + 2] = msg.positions[src + 2];
      // Expand the store's dirty window to cover every moved slot.
      if (state.dirtyMin === -1 || slot < state.dirtyMin) state.dirtyMin = slot;
      if (state.dirtyMax === -1 || slot > state.dirtyMax) state.dirtyMax = slot;
    }
  }
}
