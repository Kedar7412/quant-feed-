"use client";

import { NetworkGraph } from "@/components/NetworkGraph";
import { useGraphData } from "@/lib/hooks/useApiData";
import { Network, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function NetworkPage() {
  const { data: graphData, loading } = useGraphData();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="h-6 w-6 text-indigo-400" />
            Network Graph
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Interactive 3D visualization of economic interconnections between news articles
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-2 text-xs text-gray-400 glass px-3 py-1.5 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span>Live</span>
          </div>
          <div className="text-xs text-gray-500 glass px-3 py-1.5 rounded-lg">
            {loading
              ? "Loading..."
              : `${graphData?.nodes.length || 0} nodes \u00b7 ${graphData?.links.length || 0} connections`}
          </div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex-1 glass rounded-xl overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            <span className="ml-2 text-sm text-gray-400">Loading graph...</span>
          </div>
        ) : graphData ? (
          <NetworkGraph graphData={graphData} />
        ) : null}
      </motion.div>
    </div>
  );
}
