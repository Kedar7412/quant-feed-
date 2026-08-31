import { GraphData, TopicCorrelation } from "@/lib/types";

/**
 * Tiny typed client for the optional FastAPI graph/vector backbone (Step 1).
 *
 * The frontend integration is gated entirely on the BACKEND_URL env var. When
 * it is unset, {@link isBackendEnabled} returns false and callers keep their
 * existing live-fetch-first behavior. When it is set, callers may attempt to
 * proxy to the backend but MUST fall back gracefully: every function here
 * returns `null` on ANY error (network, timeout, non-2xx, bad JSON) and never
 * throws to the caller, so the deployed Vercel prototype never breaks.
 */

/** Request timeout for backend proxy calls (ms). Kept short to fail fast. */
const BACKEND_TIMEOUT_MS = 4000;

/**
 * Timeout for the /health pre-check (ms). Much shorter than the graph timeout
 * so a reachable-but-slow or down backend costs at most this budget before we
 * fall back, instead of the full BACKEND_TIMEOUT_MS on every /api/graph request.
 */
const BACKEND_HEALTH_TIMEOUT_MS = 800;

/** Shape returned by GET {BACKEND_URL}/graph/query (matches /api/graph). */
export interface BackendGraphResponse extends GraphData {
  correlations?: TopicCorrelation[];
  dataSource?: string;
}

/** Filters accepted by the backend graph query. */
export interface BackendGraphParams {
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sentiment?: string | null;
  entity?: string | null;
}

/** Normalize BACKEND_URL by trimming any trailing slash. */
function backendBaseUrl(): string | null {
  const raw = process.env.BACKEND_URL;
  if (!raw || raw.trim() === "") return null;
  return raw.trim().replace(/\/+$/, "");
}

/** True iff BACKEND_URL is configured, i.e. proxying should be attempted. */
export function isBackendEnabled(): boolean {
  return backendBaseUrl() !== null;
}

/**
 * Short-timeout health gate. Returns `true` only when GET {BACKEND_URL}/health
 * responds 2xx within {@link BACKEND_HEALTH_TIMEOUT_MS}. Any other outcome
 * (disabled, non-2xx, timeout, network error, bad JSON) returns `false` so the
 * caller skips the proxy and falls back immediately.
 *
 * This bounds the worst-case fallback latency: a reachable-but-slow or down
 * backend costs at most the health budget (default 800ms) instead of the full
 * graph timeout (4s) on every request. Never throws. Note the backend /health
 * is best-effort and returns 200 even when a datastore is "degraded"; we treat
 * any 2xx as "proceed to proxy" and rely on the graph call's own null/empty
 * fallback for the degraded case.
 */
export async function pingBackendHealthy(): Promise<boolean> {
  const base = backendBaseUrl();
  if (!base) return false;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    BACKEND_HEALTH_TIMEOUT_MS
  );
  try {
    const res = await fetch(`${base}/health`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch (error) {
    console.error("Backend health check failed, falling back:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Perform a GET against the backend with an AbortController timeout, returning
 * parsed JSON or `null` on any failure. Never throws.
 */
async function safeGetJson<T>(
  url: string,
  timeoutMs: number = BACKEND_TIMEOUT_MS
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error("Backend request failed, falling back:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a graph from GET {BACKEND_URL}/graph/query. Returns null when the
 * backend is disabled or any error occurs, so the caller can fall back.
 */
export async function fetchGraphFromBackend(
  params: BackendGraphParams
): Promise<BackendGraphResponse | null> {
  const base = backendBaseUrl();
  if (!base) return null;

  const query = new URLSearchParams();
  if (params.category && params.category !== "all") {
    query.set("category", params.category);
  }
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.sentiment) query.set("sentiment", params.sentiment);
  if (params.entity) query.set("entity", params.entity);

  const qs = query.toString();
  const url = `${base}/graph/query${qs ? `?${qs}` : ""}`;
  return safeGetJson<BackendGraphResponse>(url);
}

/** Article detail shape returned by GET {BACKEND_URL}/articles/{id}. */
export interface BackendArticleResponse {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  subcategory?: string;
  economicImpactScore?: number;
  tags?: string[];
  isLiveData?: boolean;
  entities?: Array<{ name: string; label: string; canonical?: string }>;
  neighbors?: Array<{
    articleId: string;
    title: string;
    category: string;
    direction: "outgoing" | "incoming";
    strength: number;
    relationship: string;
  }>;
}

/**
 * Fetch a single article from GET {BACKEND_URL}/articles/{id}. Returns null
 * when the backend is disabled or any error (incl. 404) occurs.
 */
export async function fetchArticleFromBackend(
  id: string
): Promise<BackendArticleResponse | null> {
  const base = backendBaseUrl();
  if (!base) return null;
  const url = `${base}/articles/${encodeURIComponent(id)}`;
  return safeGetJson<BackendArticleResponse>(url);
}
