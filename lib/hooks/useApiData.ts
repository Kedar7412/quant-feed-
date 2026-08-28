"use client";

import { useState, useEffect, useCallback } from "react";
import {
  NewsArticle,
  GraphData,
  DailySummary,
  Pathway,
  Prediction,
  TopicCorrelation,
} from "@/lib/types";
import {
  mockArticles,
  mockGraphData,
  mockDailySummary,
  mockPathways,
  mockPredictions,
  applyPredictionExpiry,
} from "@/lib/mock-data";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface NewsResponse {
  articles: NewsArticle[];
  pagination: PaginationInfo;
  dataSource: "live" | "cached" | "sample";
}

interface AnalysisResponse {
  summary: DailySummary;
  pathways: Pathway[];
  dataSource: "live" | "cached" | "sample";
}

interface PredictionsResponse {
  predictions: Prediction[];
  dataSource: "live" | "cached" | "sample";
  metrics: {
    total: number;
    active: number;
    correct: number;
    incorrect: number;
    expired: number;
    accuracy: number;
  };
}

interface GraphResponse extends GraphData {
  correlations: TopicCorrelation[];
  dataSource: "live" | "cached" | "sample";
}

export function useNews(params?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "cached" | "sample">("sample");

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.category && params.category !== "all")
        queryParams.set("category", params.category);
      if (params?.search) queryParams.set("search", params.search);
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.sort) queryParams.set("sort", params.sort);

      const response = await fetch(`/api/news?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: NewsResponse = await response.json();
      setData(result);
      setDataSource(result.dataSource || "sample");
    } catch (err) {
      console.error("Failed to fetch news:", err);
      setError(String(err));
      // Fallback to mock data
      setData({
        articles: mockArticles.map((a) => ({ ...a, isLiveData: false })),
        pagination: {
          page: 1,
          limit: 20,
          total: mockArticles.length,
          totalPages: 1,
        },
        dataSource: "sample",
      });
      setDataSource("sample");
    } finally {
      setLoading(false);
    }
  }, [params?.category, params?.search, params?.page, params?.limit, params?.sort]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { data, loading, error, dataSource, refetch: fetchNews };
}

export function useGraphData(params?: { category?: string }) {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "cached" | "sample">("sample");

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.category && params.category !== "all")
        queryParams.set("category", params.category);

      const response = await fetch(`/api/graph?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: GraphResponse = await response.json();
      setData(result);
      setDataSource(result.dataSource || "sample");
    } catch (err) {
      console.error("Failed to fetch graph data:", err);
      setError(String(err));
      setData({
        ...mockGraphData,
        correlations: [],
        dataSource: "sample",
      });
      setDataSource("sample");
    } finally {
      setLoading(false);
    }
  }, [params?.category]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return { data, loading, error, dataSource, refetch: fetchGraph };
}

export function useAnalysis() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analysis");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: AnalysisResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch analysis:", err);
      setError(String(err));
      setData({
        summary: mockDailySummary,
        pathways: mockPathways,
        dataSource: "sample",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  return { data, loading, error, refetch: fetchAnalysis };
}

export function usePredictions() {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/predictions");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: PredictionsResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
      setError(String(err));
      const fallback = applyPredictionExpiry(mockPredictions);
      setData({
        predictions: fallback,
        dataSource: "sample",
        metrics: {
          total: fallback.length,
          active: fallback.filter((p) => p.status === "active").length,
          correct: fallback.filter((p) => p.status === "correct").length,
          incorrect: fallback.filter((p) => p.status === "incorrect").length,
          expired: fallback.filter((p) => p.status === "expired").length,
          accuracy: 67,
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  return { data, loading, error, refetch: fetchPredictions };
}

export function useSimulation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = async (articleIds: string[]): Promise<Pathway[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analysis/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.pathways || mockPathways;
    } catch (err) {
      console.error("Failed to simulate:", err);
      setError(String(err));
      return mockPathways;
    } finally {
      setLoading(false);
    }
  };

  return { simulate, loading, error };
}
