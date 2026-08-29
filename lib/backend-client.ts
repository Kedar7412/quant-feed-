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
 * Perform a GET against the backend with an AbortController timeout, returning
 * parsed JSON or `null` on any failure. Never throws.
 */
async function safeGetJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
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
