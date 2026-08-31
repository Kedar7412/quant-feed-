"use client";

/**
 * The HUD overlay - plain React DOM rendered OUTSIDE the <Canvas>.
 *
 * Composes the four sub-panels (entity filters, sentiment heatmap,
 * event-sequence timeline, inspector drawer). Each subscribes to store slices
 * via zustand selectors so it re-renders only when its slice changes; none of
 * this touches the WebGL render loop. Filter/timeline changes recompute the
 * visible slot set and feed it to the shared force-sim worker client.
 *
 * Positioned absolutely over the canvas; the wrapper is pointer-events-none so
 * empty regions pass clicks through to the 3D scene, while individual panels
 * re-enable pointer events.
 */

import { useCallback, useRef } from "react";
import { computeVisibleSlots } from "@/lib/graph3d/visibility";
import type { ForceSimClient } from "@/lib/graph3d/forceSimClient";
import { InspectorDrawer } from "./InspectorDrawer";
import { EntityFilters } from "./EntityFilters";
import { SentimentHeatmap } from "./SentimentHeatmap";
import { EventSequenceTimeline } from "./EventSequenceTimeline";

interface GraphHUDProps {
  /** Shared force-sim client (may be null when workers are unavailable). */
  simClient: ForceSimClient | null;
  /** Bumped when the graph reloads so aggregate panels recompute. */
  version: number;
}

export function GraphHUD({ simClient, version }: GraphHUDProps) {
  // Latest freshness window is remembered so a category/sentiment change keeps
  // the active time window applied.
  const minFreshnessRef = useRef(0);

  const applyVisibility = useCallback(() => {
    const visible = computeVisibleSlots(minFreshnessRef.current);
    simClient?.setVisibility(visible);
  }, [simClient]);

  const handleFiltersChange = useCallback(() => {
    applyVisibility();
  }, [applyVisibility]);

  const handleWindowChange = useCallback(
    (minFreshness: number) => {
      minFreshnessRef.current = minFreshness;
      applyVisibility();
    },
    [applyVisibility]
  );

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Left column: filters + sentiment + timeline */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 max-h-[calc(100%-2rem)] overflow-y-auto">
        <EntityFilters onFiltersChange={handleFiltersChange} />
        <SentimentHeatmap version={version} />
        <EventSequenceTimeline onWindowChange={handleWindowChange} />
      </div>

      {/* Bottom-center inspector drawer */}
      <InspectorDrawer />
    </div>
  );
}
