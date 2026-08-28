"use client";

import { NetworkGraph } from "@/components/NetworkGraph";
import { useGraphData } from "@/lib/hooks/useApiData";
import { Network, Loader2 } from "lucide-react";

export default function NetworkPage() {
  const { data: graphData, loading } = useGraphData();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="h-6 w-6 text-indigo-400" />
            Network Graph
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Interactive visualization of economic interconnections between news articles
          </p>
        </div>
        <div className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700/50">
          {loading
            ? "Loading..."
            : `${graphData?.nodes.length || 0} nodes \u00b7 ${graphData?.links.length || 0} connections`}
        </div>
      </div>
      <div className="flex-1 bg-gray-800/20 border border-gray-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            <span className="ml-2 text-sm text-gray-400">Loading graph...</span>
          </div>
        ) : graphData ? (
          <NetworkGraph graphData={graphData} />
        ) : null}
      </div>
    </div>
  );
}
