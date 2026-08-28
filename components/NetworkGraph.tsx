"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { EconomicNode, GraphData } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface NetworkGraphProps {
  graphData: GraphData;
}

const categoryLabels: Record<string, string> = {
  domestic: "Domestic",
  international: "International",
  economic: "Economic",
  political: "Political",
};

const categoryColors: Record<string, string> = {
  domestic: "#22c55e",
  international: "#3b82f6",
  economic: "#f59e0b",
  political: "#ef4444",
};

export function NetworkGraph({ graphData }: NetworkGraphProps) {
  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<EconomicNode | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(["domestic", "international", "economic", "political"])
  );
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const filteredData = {
    nodes: graphData.nodes.filter((n) => activeCategories.has(n.category)),
    links: graphData.links.filter((l) => {
      const sourceId = typeof l.source === "string" ? l.source : (l.source as any).id;
      const targetId = typeof l.target === "string" ? l.target : (l.target as any).id;
      const sourceNode = graphData.nodes.find((n) => n.id === sourceId);
      const targetNode = graphData.nodes.find((n) => n.id === targetId);
      return (
        sourceNode &&
        targetNode &&
        activeCategories.has(sourceNode.category) &&
        activeCategories.has(targetNode.category)
      );
    }),
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as EconomicNode);
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(3, 500);
    }
  }, []);

  const toggleCategory = (category: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.5, 300);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.5, 300);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  const selectedArticle = selectedNode
    ? graphData.nodes.find((n) => n.id === selectedNode.id)
    : null;

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-gray-800/90 border border-gray-700 rounded-lg hover:bg-gray-700/90 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4 text-gray-300" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-gray-800/90 border border-gray-700 rounded-lg hover:bg-gray-700/90 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4 text-gray-300" />
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-gray-800/90 border border-gray-700 rounded-lg hover:bg-gray-700/90 transition-colors"
          aria-label="Fit to view"
        >
          <Maximize2 className="h-4 w-4 text-gray-300" />
        </button>
      </div>

      {/* Legend / Category Filter */}
      <div className="absolute top-4 left-4 z-10 bg-gray-800/90 border border-gray-700 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-300 mb-2">Categories</p>
        <div className="space-y-1.5">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className={`flex items-center gap-2 text-xs w-full text-left px-2 py-1 rounded transition-colors ${
                activeCategories.has(key)
                  ? "text-white"
                  : "text-gray-500 opacity-50"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{
                  backgroundColor: categoryColors[key],
                  opacity: activeCategories.has(key) ? 1 : 0.3,
                }}
              />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Graph */}
      <ForceGraph2D
        ref={graphRef}
        graphData={filteredData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0a0f"
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.label || "";
          const fontSize = 11 / globalScale;
          const nodeSize = (node.val || 5) * 1.5;

          // Node circle
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI);
          ctx.fillStyle = node.color || "#6366f1";
          ctx.globalAlpha = 0.8;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Glow effect
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, nodeSize + 2, 0, 2 * Math.PI);
          ctx.strokeStyle = node.color || "#6366f1";
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
          ctx.globalAlpha = 1;

          // Label
          if (globalScale > 1.5) {
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#e4e4e7";
            ctx.fillText(label, node.x!, node.y! + nodeSize + 3);
          }
        }}
        linkColor={() => "rgba(99, 102, 241, 0.2)"}
        linkWidth={(link: any) => (link.strength || 0.5) * 3}
        onNodeClick={handleNodeClick}
        cooldownTicks={100}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const nodeSize = (node.val || 5) * 1.5;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, nodeSize + 5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
      />

      {/* Selected Node Details */}
      {selectedNode && selectedArticle && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-gray-900/95 border border-gray-700 rounded-xl p-4 max-w-lg">
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-3 right-3 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: selectedNode.color }}
            />
            <span className="text-xs text-gray-400 capitalize">
              {selectedNode.category}
            </span>
            {selectedArticle.source && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <span className="text-xs text-gray-500">{selectedArticle.source}</span>
              </>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white mb-2">
            {selectedArticle.title || selectedArticle.label}
          </h3>
          {selectedArticle.summary && (
            <p className="text-xs text-gray-400 mb-3">{selectedArticle.summary}</p>
          )}
          <div className="flex items-center gap-2">
            {selectedArticle.economicImpactScore && (
              <span className="text-xs text-indigo-400 font-medium">
                Impact: {selectedArticle.economicImpactScore}/10
              </span>
            )}
            {selectedArticle.tags && (
              <span className="text-xs text-gray-500">
                {selectedArticle.tags.join(", ")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
