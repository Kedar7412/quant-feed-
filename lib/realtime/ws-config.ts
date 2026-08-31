/**
 * Real-time WebSocket gating (FEAT-004).
 *
 * Mirrors the BACKEND_URL gating pattern in {@link file://../backend-client.ts}:
 * the entire real-time layer is gated on the `NEXT_PUBLIC_WS_URL` env var. When
 * it is unset (the default), {@link isRealtimeEnabled} returns false and the
 * frontend never opens a WebSocket - the network page keeps rendering from
 * `/api/graph` exactly as FEAT-003 leaves it. Real-time is purely additive.
 *
 * `NEXT_PUBLIC_` prefix is required so the value is inlined into the client
 * bundle by Next.js (server-only vars are not readable in the browser).
 */

/**
 * Normalize `NEXT_PUBLIC_WS_URL` by trimming whitespace and any trailing slash.
 * Returns `null` when unset/empty so callers can treat realtime as disabled.
 */
export function realtimeWsUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_WS_URL;
  if (!raw || raw.trim() === "") return null;
  return raw.trim().replace(/\/+$/, "");
}

/** True iff `NEXT_PUBLIC_WS_URL` is configured, i.e. realtime should be attempted. */
export function isRealtimeEnabled(): boolean {
  return realtimeWsUrl() !== null;
}

/** True only in a browser context that exposes the WebSocket global (not SSR). */
export function isBrowserWebSocketAvailable(): boolean {
  return typeof window !== "undefined" && typeof WebSocket !== "undefined";
}
