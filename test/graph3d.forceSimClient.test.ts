import { describe, it, expect } from "bun:test";
import { ForceSimClient, isWorkerAvailable } from "@/lib/graph3d/forceSimClient";
import { createGraph3DStore } from "@/lib/graph3d/store";
import type { GraphData } from "@/lib/types";

const graph: GraphData = {
  nodes: [
    { id: "a", articleId: "a", label: "a", category: "economic" },
    { id: "b", articleId: "b", label: "b", category: "political" },
  ],
  links: [{ source: "a", target: "b", strength: 0.5, relationship: "r" }],
};

describe("forceSimClient - SSR/test safety", () => {
  it("reports no worker in a non-browser context", () => {
    // In the bun test runtime there is no `window`; Worker may or may not exist,
    // but isWorkerAvailable requires BOTH window and Worker.
    expect(isWorkerAvailable()).toBe(false);
  });

  it("no-ops start/feed/setVisibility/stop without a browser Worker", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    const client = new ForceSimClient(store);
    expect(() => client.start(graph)).not.toThrow();
    expect(() => client.feed(graph)).not.toThrow();
    expect(() => client.setVisibility([0, 1])).not.toThrow();
    expect(() => client.stop()).not.toThrow();
    // Store data is unaffected by the no-op client.
    expect(store.getState().getLiveCount()).toBe(2);
  });
});
