/**
 * Filter -> visible-slot resolution for the force-sim worker.
 *
 * Given the store's active category/sentiment filters and a minimum-freshness
 * window, compute the set of node slots that remain visible. The result is fed
 * to `ForceSimClient.setVisibility`, which pins filtered-out nodes in the
 * layout (Step 2) and will constrain the WS subscription predicate (FEAT-004).
 *
 * Pure and self-contained: reads the store's slot map + freshness buffer and
 * the node registry metadata; returns a plain slot array. Called only on filter
 * changes (not per frame).
 */

import { graph3DStore } from "./store";
import { getNodeMeta } from "./nodeRegistry";
import { deriveSentiment } from "./visualMapping";

export function computeVisibleSlots(minFreshness = 0): number[] {
  const state = graph3DStore.getState();
  const { category, sentiment } = state.filters;
  const visible: number[] = [];
  state.nodeSlots.forEach((slot, id) => {
    const meta = getNodeMeta(id);
    if (!meta) return;
    if (category !== "all" && meta.category !== category) return;
    if (sentiment !== null && deriveSentiment(meta) !== sentiment) return;
    if (minFreshness > 0 && (meta.freshnessScore ?? 0) < minFreshness) return;
    visible.push(slot);
  });
  return visible;
}
