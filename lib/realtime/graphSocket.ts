/**
 * Real-time graph WebSocket client (FEAT-004).
 *
 * Opens a WebSocket to `NEXT_PUBLIC_WS_URL`, subscribes with the FEAT-002
 * store's current filters, and streams incremental diffs into the store via
 * `applyDiff`. On every (re)connect it triggers a re-sync of the initial
 * `/api/graph` state (through an injected callback) so the client never relies
 * on missing a diff during a disconnect window. Reconnects use capped
 * exponential backoff. HUD filter changes are forwarded as `filter-update`
 * messages without reconnecting.
 *
 * SAFETY: this module NO-OPS in SSR / when realtime is disabled and NEVER throws
 * to the UI. All side effects go through the injected dependencies so it is
 * fully unit-testable with a stubbed WebSocket and an injected scheduler - no
 * real network, no timers required.
 */

import type { StoreApi } from "zustand/vanilla";
import type { GraphDiff } from "@/lib/graph3d/types";
import type { Graph3DState, ActiveFilters } from "@/lib/graph3d/store";
import {
  isRealtimeEnabled,
  isBrowserWebSocketAvailable,
  realtimeWsUrl,
} from "./ws-config";

/** Backoff schedule: first delay, growth factor, and hard cap (ms). */
export const BACKOFF_BASE_MS = 500;
export const BACKOFF_FACTOR = 2;
export const BACKOFF_MAX_MS = 30_000;

/** The subscribe/filter-update payload sent to the backend WS gateway. */
export interface FilterMessage {
  category?: string;
  startDate?: string;
  endDate?: string;
  sentiment?: string;
  entity?: string;
}

/**
 * Compute the nth backoff delay (0-indexed attempt), capped at
 * {@link BACKOFF_MAX_MS}. Exposed for unit testing the schedule.
 */
export function backoffDelay(attempt: number): number {
  const raw = BACKOFF_BASE_MS * BACKOFF_FACTOR ** attempt;
  return Math.min(raw, BACKOFF_MAX_MS);
}

/**
 * Translate the store's {@link ActiveFilters} into the backend subscribe/update
 * contract. Only defined fields are included so an "all"/null filter is a no-op
 * server-side (matching REST).
 */
export function filtersToMessage(filters: ActiveFilters): FilterMessage {
  const message: FilterMessage = {};
  if (filters.category && filters.category !== "all") {
    message.category = filters.category;
  }
  if (filters.sentiment) {
    message.sentiment = filters.sentiment;
  }
  return message;
}

/** Minimal structural type for the WebSocket the client drives (browser-compatible). */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

/** Injectable dependencies (all default to real browser globals). */
export interface GraphSocketOptions {
  /** Store to stream diffs into. Defaults to the shared singleton. */
  store: StoreApi<Graph3DState>;
  /** Factory that opens a socket to `url`. Defaults to `new WebSocket(url)`. */
  socketFactory?: (url: string) => SocketLike;
  /** Called on every (re)connect to re-sync initial `/api/graph` state. */
  onResync?: () => void;
  /** Timer scheduler (injectable for tests). Defaults to setTimeout/clearTimeout. */
  setTimeoutFn?: (fn: () => void, ms: number) => number;
  clearTimeoutFn?: (handle: number) => void;
  /** Override the URL (defaults to the gated `NEXT_PUBLIC_WS_URL`). */
  url?: string | null;
}

/**
 * A resilient graph WebSocket client. Construct with a store, then `start()`.
 * All public methods are safe to call in any context (they no-op when realtime
 * is disabled or no browser WebSocket is available) and never throw.
 */
export class GraphSocket {
  private readonly store: StoreApi<Graph3DState>;
  private readonly socketFactory: (url: string) => SocketLike;
  private readonly onResync: () => void;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => number;
  private readonly clearTimeoutFn: (handle: number) => void;
  private readonly url: string | null;

  private socket: SocketLike | null = null;
  private reconnectAttempt = 0;
  private reconnectHandle: number | null = null;
  private closedByUser = false;
  private unsubscribeStore: (() => void) | null = null;
  private lastFilterMessage = "";
  /** True when a custom socket factory was injected (tests bypass browser gates). */
  private readonly hasInjectedFactory: boolean;

  constructor(options: GraphSocketOptions) {
    this.store = options.store;
    this.hasInjectedFactory = options.socketFactory !== undefined;
    this.socketFactory =
      options.socketFactory ??
      ((url: string) => new WebSocket(url) as unknown as SocketLike);
    this.onResync = options.onResync ?? (() => {});
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((fn, ms) => setTimeout(fn, ms) as unknown as number);
    this.clearTimeoutFn =
      options.clearTimeoutFn ?? ((handle) => clearTimeout(handle));
    this.url = options.url !== undefined ? options.url : realtimeWsUrl();
  }

  /**
   * Open the socket and begin streaming. No-op when realtime is disabled, when
   * no browser WebSocket exists (SSR/tests without a stub), or when already
   * running. Never throws.
   */
  start(): void {
    if (this.socket || this.reconnectHandle !== null) return;
    if (this.url === null) return;
    // When a custom factory is injected (tests) we bypass the browser-global
    // check; otherwise require a real WebSocket + a configured URL.
    if (
      !this.hasInjectedFactory &&
      !(isRealtimeEnabled() && isBrowserWebSocketAvailable())
    ) {
      return;
    }
    this.closedByUser = false;
    this.connect();
    this.subscribeToStoreFilters();
  }

  /** Close the socket and stop reconnecting. Safe to call repeatedly. */
  stop(): void {
    this.closedByUser = true;
    if (this.reconnectHandle !== null) {
      this.clearTimeoutFn(this.reconnectHandle);
      this.reconnectHandle = null;
    }
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close();
      } catch {
        // Never throw on teardown.
      }
    }
  }

  private connect(): void {
    let socket: SocketLike;
    try {
      socket = this.socketFactory(this.url as string);
    } catch {
      // Failed to construct - schedule a retry rather than throwing.
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      // Re-sync the authoritative initial state, then (re)subscribe with filters.
      try {
        this.onResync();
      } catch {
        // A resync failure must not break the socket.
      }
      this.sendFilters(true);
    };

    socket.onmessage = (event: { data: unknown }) => {
      this.handleMessage(event.data);
    };

    socket.onerror = () => {
      // Errors are handled via the subsequent close event; swallow here.
    };

    socket.onclose = () => {
      this.socket = null;
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectHandle !== null) return;
    const delay = backoffDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectHandle = this.setTimeoutFn(() => {
      this.reconnectHandle = null;
      if (!this.closedByUser) this.connect();
    }, delay);
  }

  /** Parse an incoming message and apply any diff to the store. Never throws. */
  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const message = parsed as { type?: string; diff?: unknown };
    if (message.type !== "diff" || !message.diff) return;
    const diff = this.coerceDiff(message.diff);
    if (!diff) return;
    try {
      this.store.getState().applyDiff(diff);
    } catch {
      // A malformed diff must never crash the render loop.
    }
  }

  /** Validate/normalize a wire diff into the store's {@link GraphDiff} shape. */
  private coerceDiff(raw: unknown): GraphDiff | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Partial<GraphDiff>;
    return {
      addedNodes: Array.isArray(obj.addedNodes) ? obj.addedNodes : [],
      removedNodes: Array.isArray(obj.removedNodes) ? obj.removedNodes : [],
      updatedEdges: Array.isArray(obj.updatedEdges) ? obj.updatedEdges : [],
    };
  }

  /** Subscribe to store filter changes and forward them as filter-update. */
  private subscribeToStoreFilters(): void {
    if (this.unsubscribeStore) return;
    let previous = this.store.getState().filters;
    this.unsubscribeStore = this.store.subscribe(() => {
      const next = this.store.getState().filters;
      if (next !== previous) {
        previous = next;
        this.sendFilters(false);
      }
    });
  }

  /**
   * Send the current filters as a `subscribe` (initial) or `filter-update`
   * (subsequent) message. Deduped so an unchanged filter set is not re-sent.
   */
  private sendFilters(initial: boolean): void {
    if (!this.socket) return;
    const filters = filtersToMessage(this.store.getState().filters);
    const payload = JSON.stringify({
      type: initial ? "subscribe" : "filter-update",
      filters,
    });
    // Dedupe repeated identical filter-update sends (subscribe always sends).
    if (!initial && payload === this.lastFilterMessage) return;
    this.lastFilterMessage = payload;
    try {
      this.socket.send(payload);
    } catch {
      // A send failure will surface as a close/reconnect; swallow here.
    }
  }
}
