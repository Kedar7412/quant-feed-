"use client";

import { useState, useEffect, useCallback } from "react";
import {
  NewsArticle,
  GraphData,
  DailySummary,
  Pathway,
  Prediction,
} from "@/lib/types";
import {
  mockArticles,
  mockGraphData,
  mockDailySummary,
  mockPathways,
  mockPredictions,
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
}

interface AnalysisResponse {
  summary: DailySummary;
  pathways: Pathway[];
}

interface PredictionsResponse {
  predictions: Prediction[];
  metrics: {
    total: number;
    active: number;
    correct: number;
    incorrect: number;
    accuracy: number;
  };
}

export function useNews(params?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const response = await fetch(`/api/news?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: NewsResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch news:", err);
      setError(String(err));
      // Fallback to mock data
      setData({
        articles: mockArticles,
        pagination: {
          page: 1,
          limit: 20,
          total: mockArticles.length,
          totalPages: 1,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [params?.category, params?.search, params?.page, params?.limit]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { data, loading, error, refetch: fetchNews };
}

export function useGraphData(params?: { category?: string }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const result: GraphData = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch graph data:", err);
      setError(String(err));
      setData(mockGraphData);
    } finally {
      setLoading(false);
    }
  }, [params?.category]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return { data, loading, error, refetch: fetchGraph };
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
      setData({
        predictions: mockPredictions,
        metrics: {
          total: mockPredictions.length,
          active: mockPredictions.filter((p) => p.status === "active").length,
          correct: mockPredictions.filter((p) => p.status === "correct").length,
          incorrect: mockPredictions.filter((p) => p.status === "incorrect")
            .length,
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
