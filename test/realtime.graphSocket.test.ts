import { describe, it, expect } from "bun:test";
import {
  GraphSocket,
  backoffDelay,
  filtersToMessage,
  BACKOFF_MAX_MS,
  type SocketLike,
} from "@/lib/realtime/graphSocket";
import { createGraph3DStore } from "@/lib/graph3d/store";
import type { EconomicNode, EconomicEdge, GraphData } from "@/lib/types";
import type { GraphDiff } from "@/lib/graph3d/types";

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

/** A controllable fake WebSocket capturing sends and exposing lifecycle hooks. */
class FakeSocket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
    this.onclose?.({});
  }
  emitMessage(data: unknown): void {
    this.onmessage?.({ data });
  }
  open(): void {
    this.onopen?.({});
  }
}

const graph: GraphData = {
  nodes: [node("a"), node("b")],
  links: [edge("a", "b")],
};

describe("backoffDelay schedule", () => {
  it("increases exponentially then caps at BACKOFF_MAX_MS", () => {
    const schedule = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(backoffDelay);
    // Strictly non-decreasing.
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i]).toBeGreaterThanOrEqual(schedule[i - 1]);
    }
    // Early values grow (500, 1000, 2000, ...).
    expect(schedule[0]).toBe(500);
    expect(schedule[1]).toBe(1000);
    expect(schedule[2]).toBe(2000);
    // Eventually capped.
    expect(schedule[schedule.length - 1]).toBe(BACKOFF_MAX_MS);
    expect(Math.max(...schedule)).toBe(BACKOFF_MAX_MS);
  });
});

describe("filtersToMessage", () => {
  it("omits 'all' category and null sentiment", () => {
    expect(filtersToMessage({ category: "all", sentiment: null })).toEqual({});
  });
  it("maps category and sentiment into the subscribe contract", () => {
    expect(
      filtersToMessage({ category: "economic", sentiment: "positive" })
    ).toEqual({ category: "economic", sentiment: "positive" });
  });
});

describe("GraphSocket diff handling", () => {
  it("sends a subscribe message on open with the store filters", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    store.getState().setFilters({ category: "economic" });
    const fake = new FakeSocket();
    const socket = new GraphSocket({
      store,
      socketFactory: () => fake,
      url: "wss://x",
    });
    socket.start();
    fake.open();

    expect(fake.sent.length).toBe(1);
    const msg = JSON.parse(fake.sent[0]);
    expect(msg.type).toBe("subscribe");
    expect(msg.filters).toEqual({ category: "economic" });
    socket.stop();
  });

  it("applies an incoming diff to the store (added/removed/updated)", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph); // a, b + edge a-b
    const fake = new FakeSocket();
    const socket = new GraphSocket({
      store,
      socketFactory: () => fake,
      url: "wss://x",
    });
    socket.start();
    fake.open();

    const diff: GraphDiff = {
      addedNodes: [node("c")],
      removedNodes: ["a"],
      updatedEdges: [edge("b", "c", 0.9)],
    };
    fake.emitMessage(JSON.stringify({ type: "diff", diff }));

    const s = store.getState();
    expect(s.getSlot("a")).toBeUndefined(); // removed
    expect(s.getSlot("c")).not.toBeUndefined(); // added
    expect(s.getLiveCount()).toBe(2); // a removed, c added (b stays)
    expect(s.getEdgeCount()).toBe(1); // rewritten to just b-c
    socket.stop();
  });

  it("ignores non-diff and malformed messages without throwing", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    const fake = new FakeSocket();
    const socket = new GraphSocket({
      store,
      socketFactory: () => fake,
      url: "wss://x",
    });
    socket.start();
    fake.open();

    expect(() => fake.emitMessage("not json")).not.toThrow();
    expect(() => fake.emitMessage(JSON.stringify({ type: "other" }))).not.toThrow();
    expect(() => fake.emitMessage(42)).not.toThrow();
    // Store unchanged (still a, b).
    expect(store.getState().getLiveCount()).toBe(2);
    socket.stop();
  });

  it("sends a filter-update message when store filters change", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    const fake = new FakeSocket();
    const socket = new GraphSocket({
      store,
      socketFactory: () => fake,
      url: "wss://x",
    });
    socket.start();
    fake.open();
    fake.sent.length = 0; // drop the initial subscribe

    store.getState().setFilters({ category: "political" });

    expect(fake.sent.length).toBe(1);
    const msg = JSON.parse(fake.sent[0]);
    expect(msg.type).toBe("filter-update");
    expect(msg.filters).toEqual({ category: "political" });
    socket.stop();
  });

  it("re-syncs (onResync) and re-subscribes on each open", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    let resyncs = 0;
    const fake = new FakeSocket();
    const socket = new GraphSocket({
      store,
      socketFactory: () => fake,
      url: "wss://x",
      onResync: () => {
        resyncs += 1;
      },
    });
    socket.start();
    fake.open();
    expect(resyncs).toBe(1);
    const firstMsg = JSON.parse(fake.sent[0]);
    expect(firstMsg.type).toBe("subscribe");
    socket.stop();
  });
});

describe("GraphSocket reconnect backoff", () => {
  it("schedules reconnects with increasing, capped delays via injected scheduler", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    const scheduled: number[] = [];
    let pending: (() => void) | null = null;
    const sockets: FakeSocket[] = [];

    const socket = new GraphSocket({
      store,
      socketFactory: () => {
        const f = new FakeSocket();
        sockets.push(f);
        return f;
      },
      url: "wss://x",
      setTimeoutFn: (fn, ms) => {
        scheduled.push(ms);
        pending = fn;
        return scheduled.length;
      },
      clearTimeoutFn: () => {},
    });

    socket.start();
    // First socket opens then the server drops it -> schedule reconnect #0.
    sockets[0].open();
    sockets[0].onclose?.({});
    expect(scheduled).toEqual([500]);

    // Fire the reconnect timer -> new socket, drop again -> reconnect #1.
    pending?.();
    sockets[1].onclose?.({});
    expect(scheduled).toEqual([500, 1000]);

    pending?.();
    sockets[2].onclose?.({});
    expect(scheduled).toEqual([500, 1000, 2000]);

    socket.stop();
  });

  it("stops reconnecting after stop() (closedByUser)", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);
    const scheduled: number[] = [];
    const fake = new FakeSocket();
    const socket = new GraphSocket({
      store,
      socketFactory: () => fake,
      url: "wss://x",
      setTimeoutFn: (_fn, ms) => {
        scheduled.push(ms);
        return scheduled.length;
      },
      clearTimeoutFn: () => {},
    });
    socket.start();
    fake.open();
    socket.stop(); // user close -> onclose must NOT schedule a reconnect
    expect(scheduled).toEqual([]);
  });

  it("no-ops when disabled (no url, no injected factory)", () => {
    const store = createGraph3DStore();
    const socket = new GraphSocket({ store, url: null });
    expect(() => socket.start()).not.toThrow();
    expect(() => socket.stop()).not.toThrow();
  });
});
