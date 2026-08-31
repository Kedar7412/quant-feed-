import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { createGraph3DStore } from "@/lib/graph3d/store";
import { CAPACITY, FLOATS_PER_COLOR, type GraphDiff } from "@/lib/graph3d/types";
import type { EconomicNode, EconomicEdge, GraphData } from "@/lib/types";
import { impactToScale } from "@/lib/graph3d/visualMapping";

function node(id: string, overrides: Partial<EconomicNode> = {}): EconomicNode {
  return {
    id,
    articleId: `art-${id}`,
    label: id,
    category: "economic",
    economicImpactScore: 5,
    ...overrides,
  };
}

function edge(source: string, target: string, strength = 0.5): EconomicEdge {
  return { source, target, strength, relationship: "related" };
}

function emptyDiff(overrides: Partial<GraphDiff> = {}): GraphDiff {
  return { addedNodes: [], removedNodes: [], updatedEdges: [], ...overrides };
}

describe("graph3d store - initFromGraph", () => {
  it("assigns sequential slots and counts live nodes", () => {
    const store = createGraph3DStore();
    const graph: GraphData = {
      nodes: [node("a"), node("b"), node("c")],
      links: [edge("a", "b")],
    };
    store.getState().initFromGraph(graph);
    const s = store.getState();
    expect(s.getLiveCount()).toBe(3);
    expect(s.getSlot("a")).toBe(0);
    expect(s.getSlot("b")).toBe(1);
    expect(s.getSlot("c")).toBe(2);
    expect(s.getEdgeCount()).toBe(1);
  });
});

describe("graph3d store - applyDiff add", () => {
  it("adds nodes into free slots and writes correct attributes", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(
      emptyDiff({
        addedNodes: [node("x", { economicImpactScore: 9, freshnessScore: 0.8 })],
      })
    );
    const slot = s.getSlot("x")!;
    expect(slot).toBe(0);
    expect(s.impacts[slot]).toBe(9);
    expect(s.scales[slot]).toBeCloseTo(impactToScale(9), 5);
    expect(s.freshness[slot]).toBeCloseTo(0.8, 5);
    // economic category => #f59e0b
    const c = slot * FLOATS_PER_COLOR;
    expect(s.colors[c]).toBeCloseTo(0xf5 / 255, 4);
    expect(s.colors[c + 1]).toBeCloseTo(0x9e / 255, 4);
    expect(s.colors[c + 2]).toBeCloseTo(0x0b / 255, 4);
    expect(s.getLiveCount()).toBe(1);
  });
});

describe("graph3d store - free-list recycling (leak fix)", () => {
  it("remove frees the slot and a subsequent add REUSES that exact slot index", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(emptyDiff({ addedNodes: [node("a"), node("b"), node("c")] }));
    expect(s.getSlot("b")).toBe(1);

    s.applyDiff(emptyDiff({ removedNodes: ["b"] }));
    expect(s.getSlot("b")).toBeUndefined();
    expect(s.getLiveCount()).toBe(2);

    // The freed slot (1) must be reused by the next add.
    s.applyDiff(emptyDiff({ addedNodes: [node("d")] }));
    expect(s.getSlot("d")).toBe(1);
    expect(s.getLiveCount()).toBe(3);
    // Existing nodes untouched.
    expect(s.getSlot("a")).toBe(0);
    expect(s.getSlot("c")).toBe(2);
  });

  it("repeated remove+add churn never grows the high-water mark", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(emptyDiff({ addedNodes: [node("a"), node("b")] }));
    for (let i = 0; i < 50; i++) {
      s.applyDiff(emptyDiff({ removedNodes: ["b"] }));
      s.applyDiff(emptyDiff({ addedNodes: [node("b")] }));
    }
    expect(s.highWater).toBe(2);
    expect(s.getLiveCount()).toBe(2);
    expect(s.getSlot("b")).toBe(1);
  });
});

describe("graph3d store - capacity ceiling", () => {
  it("drops-with-warning beyond CAPACITY without throwing or corrupting slots", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const added = [] as EconomicNode[];
    for (let i = 0; i < CAPACITY + 5; i++) {
      added.push(node(`n${i}`, { economicImpactScore: 5 }));
    }
    expect(() => s.applyDiff(emptyDiff({ addedNodes: added }))).not.toThrow();

    expect(s.getLiveCount()).toBe(CAPACITY);
    expect(s.getSlot("n0")).toBe(0);
    expect(s.getSlot(`n${CAPACITY - 1}`)).toBe(CAPACITY - 1);
    // Overflow nodes were dropped.
    expect(s.getSlot(`n${CAPACITY}`)).toBeUndefined();
    expect(s.getSlot(`n${CAPACITY + 4}`)).toBeUndefined();
    // Existing slot 0 attributes intact.
    expect(s.impacts[0]).toBe(5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("graph3d store - dirty-range bookkeeping", () => {
  it("reports the touched range and clears on consume", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(emptyDiff({ addedNodes: [node("a"), node("b"), node("c")] }));
    const range = s.consumeDirtyRange();
    expect(range).toEqual({ start: 0, count: 3 });
    // Consuming clears it.
    expect(s.consumeDirtyRange()).toBeNull();
  });

  it("expands the range to cover touched slots and nothing else", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(
      emptyDiff({ addedNodes: [node("a"), node("b"), node("c"), node("d")] })
    );
    s.consumeDirtyRange();
    // Touch only slot 2.
    s.setSelected("c");
    const range = s.consumeDirtyRange();
    expect(range).toEqual({ start: 2, count: 1 });
  });
});

describe("graph3d store - edges", () => {
  it("rewrites edge endpoints as slot indices and skips dangling edges", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(emptyDiff({ addedNodes: [node("a"), node("b")] }));
    s.applyDiff(
      emptyDiff({
        updatedEdges: [edge("a", "b", 0.7), edge("a", "ghost", 0.9)],
      })
    );
    expect(s.getEdgeCount()).toBe(1);
    expect(s.edges[0]).toBe(0); // a
    expect(s.edges[1]).toBe(1); // b
    expect(s.edges[2]).toBeCloseTo(0.7, 5);
  });
});

describe("graph3d store - selection", () => {
  it("sets and clears the selected flag on the correct slot", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.applyDiff(emptyDiff({ addedNodes: [node("a"), node("b")] }));
    s.setSelected("b");
    expect(s.selected[1]).toBe(1);
    expect(s.getSelectedNodeId()).toBe("b");
    s.setSelected("a");
    expect(s.selected[1]).toBe(0);
    expect(s.selected[0]).toBe(1);
    s.setSelected(null);
    expect(s.selected[0]).toBe(0);
    expect(s.getSelectedNodeId()).toBeNull();
  });
});

describe("graph3d store - filters", () => {
  it("merges partial filter updates", () => {
    const store = createGraph3DStore();
    const s = store.getState();
    s.setFilters({ category: "political" });
    expect(s.getActiveFilters()).toEqual({
      category: "political",
      sentiment: null,
    });
    s.setFilters({ sentiment: "positive" });
    expect(s.getActiveFilters()).toEqual({
      category: "political",
      sentiment: "positive",
    });
  });
});
