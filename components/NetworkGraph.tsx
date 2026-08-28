"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, RotateCcw } from "lucide-react";
import { EconomicNode, GraphData } from "@/lib/types";
import * as THREE from "three";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
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
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Camera auto-rotation
  useEffect(() => {
    if (!graphRef.current) return;
    const controls = graphRef.current.controls();
    if (controls) {
      controls.autoRotate = !isUserInteracting;
      controls.autoRotateSpeed = 0.5;
    }
  }, [isUserInteracting]);

  // Setup scene with lighting and star particles on mount
  useEffect(() => {
    if (!graphRef.current) return;
    const scene = graphRef.current.scene();
    if (!scene) return;

    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);

    // Point light (indigo tone)
    const pointLight1 = new THREE.PointLight(0x6366f1, 1.5, 500);
    pointLight1.position.set(100, 100, 100);
    scene.add(pointLight1);

    // Point light (purple tone)
    const pointLight2 = new THREE.PointLight(0x8b5cf6, 1.0, 400);
    pointLight2.position.set(-100, -50, -100);
    scene.add(pointLight2);

    // Star particles background
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 1000;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.4,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    return () => {
      scene.remove(ambient);
      scene.remove(pointLight1);
      scene.remove(pointLight2);
      scene.remove(stars);
      starGeometry.dispose();
      starMaterial.dispose();
    };
  }, []);

  const handleUserInteraction = useCallback(() => {
    setIsUserInteracting(true);
    if (interactionTimeout.current) {
      clearTimeout(interactionTimeout.current);
    }
    interactionTimeout.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
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
    // Smooth camera transition to selected node
    if (graphRef.current) {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      graphRef.current.cameraPosition(
        {
          x: (node.x || 0) * distRatio,
          y: (node.y || 0) * distRatio,
          z: (node.z || 0) * distRatio,
        },
        { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
        1500
      );
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

  const handleResetView = () => {
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
    }
  };

  const selectedArticle = selectedNode
    ? graphData.nodes.find((n) => n.id === selectedNode.id)
    : null;

  // Custom 3D node objects with glowing spheres
  const nodeThreeObject = useCallback((node: any) => {
    const category = node.category || "domestic";
    const color = categoryColors[category] || "#6366f1";
    const size = ((node.val || 5) * 1.2) + 3;

    const group = new THREE.Group();

    // Main sphere with emissive glow
    const geometry = new THREE.SphereGeometry(size, 24, 24);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
      shininess: 100,
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Outer glow sphere
    const glowGeometry = new THREE.SphereGeometry(size * 1.4, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.15,
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glowSphere);

    return group;
  }, []);

  return (
    <div
      className="relative h-full w-full"
      ref={containerRef}
      onMouseDown={handleUserInteraction}
      onTouchStart={handleUserInteraction}
      onWheel={handleUserInteraction}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleResetView}
          className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Reset view"
        >
          <RotateCcw className="h-4 w-4 text-gray-300" />
        </button>
      </div>

      {/* Legend / Category Filter */}
      <div className="absolute top-4 left-4 z-10 glass rounded-xl p-3">
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

      {/* 3D Graph */}
      <ForceGraph3D
        ref={graphRef}
        graphData={filteredData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(10, 10, 15, 0)"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={() => "rgba(99, 102, 241, 0.3)"}
        linkWidth={(link: any) => (link.strength || 0.5) * 2}
        linkDirectionalParticles={4}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={() => "#818cf8"}
        linkOpacity={0.4}
        onNodeClick={handleNodeClick}
        cooldownTicks={100}
        enableNodeDrag={true}
        enableNavigationControls={true}
      />

      {/* Selected Node Details */}
      {selectedNode && selectedArticle && (
        <div className="absolute bottom-4 left-4 right-4 z-10 glass-strong rounded-xl p-4 max-w-lg">
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
