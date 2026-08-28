"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { X, RotateCcw, ExternalLink, Clock, Zap } from "lucide-react";
import { EconomicNode, EconomicEdge, GraphData } from "@/lib/types";
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

const categoryGradients: Record<string, string> = {
  domestic: "from-green-500/20 to-green-900/40",
  international: "from-blue-500/20 to-blue-900/40",
  economic: "from-amber-500/20 to-amber-900/40",
  political: "from-red-500/20 to-red-900/40",
};

function getFreshnessLabel(score: number): string {
  if (score > 0.7) return "Fresh";
  if (score > 0.3) return "Recent";
  if (score > 0.1) return "Aging";
  return "Old";
}

function getFreshnessColor(score: number): string {
  if (score > 0.7) return "#22c55e";
  if (score > 0.3) return "#f59e0b";
  return "#6b7280";
}

function getTimeAgo(score: number): string {
  // Approximate time from score (half-life 12h: score = e^(-ln2/12 * hours))
  if (score > 0.9) return "< 2h ago";
  if (score > 0.7) return "< 6h ago";
  if (score > 0.5) return "< 12h ago";
  if (score > 0.3) return "< 1 day ago";
  if (score > 0.1) return "< 3 days ago";
  return "> 3 days ago";
}

export function NetworkGraph({ graphData }: NetworkGraphProps) {
  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<EconomicNode | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(["domestic", "international", "economic", "political"])
  );
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  // Tracks whether the selected node's image failed to load, so we can fall
  // back to the category gradient placeholder.
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeout = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);
  // Cached scene object references, collected as nodes are built, so the
  // per-frame loop never has to run a full scene.traverse().
  const pulseRingsRef = useRef<THREE.Mesh[]>([]);
  const textLabelsRef = useRef<THREE.Sprite[]>([]);
  // Single reusable Vector3, hoisted out of the per-frame loop to avoid a fresh
  // allocation per label per frame (GC-pressure risk as the graph grows).
  const reusableWorldPos = useRef(new THREE.Vector3());

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

  // Per-frame loop: pulse fresh-node rings and toggle label visibility based on
  // camera distance to each node. Runs against the live scene/camera so the
  // rings actually animate and labels only appear when zoomed in (< ~150 units).
  const LABEL_VISIBLE_DISTANCE = 150;
  useEffect(() => {
    const animate = () => {
      pulsePhaseRef.current += 0.03;
      const phase = pulsePhaseRef.current;

      const graph = graphRef.current;
      if (graph) {
        const camera = graph.camera?.();
        if (camera) {
          // Pulse factor oscillates between ~0.85 and ~1.15
          const pulseScale = 1 + Math.sin(phase) * 0.15;
          const pulseOpacity = 0.35 + (Math.sin(phase) + 1) * 0.2; // 0.35 - 0.75

          // Iterate only the cached ring/label references instead of walking
          // the entire scene graph every frame.
          const rings = pulseRingsRef.current;
          for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            ring.scale.set(pulseScale, pulseScale, pulseScale);
            const mat = ring.material as THREE.Material & { opacity: number };
            if (mat) mat.opacity = pulseOpacity;
          }

          const labels = textLabelsRef.current;
          const worldPos = reusableWorldPos.current;
          for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            // Distance-based label visibility (LOD): show only when the camera
            // is close enough to the node. Reuse a single Vector3.
            label.getWorldPosition(worldPos);
            const dist = camera.position.distanceTo(worldPos);
            label.visible = dist < LABEL_VISIBLE_DISTANCE;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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

  const filteredData = useMemo(
    () => ({
      nodes: graphData.nodes.filter((n) => activeCategories.has(n.category)),
      links: graphData.links.filter((l) => {
        const sourceId =
          typeof l.source === "string" ? l.source : (l.source as any).id;
        const targetId =
          typeof l.target === "string" ? l.target : (l.target as any).id;
        const sourceNode = graphData.nodes.find((n) => n.id === sourceId);
        const targetNode = graphData.nodes.find((n) => n.id === targetId);
        return (
          sourceNode &&
          targetNode &&
          activeCategories.has(sourceNode.category) &&
          activeCategories.has(targetNode.category)
        );
      }),
    }),
    [graphData, activeCategories]
  );

  // Compute connected node IDs for the selected node
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const connected = new Set<string>();
    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as any).id;
      if (sourceId === selectedNode.id) {
        connected.add(targetId);
      }
      if (targetId === selectedNode.id) {
        connected.add(sourceId);
      }
    });
    return connected;
  }, [selectedNode, graphData.links]);

  // Compute connected edges for highlighting
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const edges = new Set<string>();
    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as any).id;
      if (sourceId === selectedNode.id || targetId === selectedNode.id) {
        edges.add(`${sourceId}-${targetId}`);
      }
    });
    return edges;
  }, [selectedNode, graphData.links]);

  // Get related nodes with their relationship info
  const relatedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const related: Array<{
      node: EconomicNode;
      relationship: string;
    }> = [];
    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as any).id;
      if (sourceId === selectedNode.id) {
        const targetNode = graphData.nodes.find((n) => n.id === targetId);
        if (targetNode) {
          related.push({ node: targetNode, relationship: link.relationship });
        }
      } else if (targetId === selectedNode.id) {
        const sourceNode = graphData.nodes.find((n) => n.id === sourceId);
        if (sourceNode) {
          related.push({ node: sourceNode, relationship: link.relationship });
        }
      }
    });
    return related;
  }, [selectedNode, graphData]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as EconomicNode);
    setImageError(false);
    // Smooth camera transition to selected node
    if (graphRef.current) {
      const distance = 80;
      const distRatio =
        1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
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
    setSelectedNode(null);
    if (graphRef.current) {
      graphRef.current.cameraPosition(
        { x: 0, y: 0, z: 300 },
        { x: 0, y: 0, z: 0 },
        1000
      );
    }
  };

  const selectedArticle = selectedNode
    ? graphData.nodes.find((n) => n.id === selectedNode.id)
    : null;

  // Custom node tooltip (HTML)
  const nodeLabel = useCallback((node: any) => {
    const freshness = node.freshnessScore || 0;
    const freshnessLabel = getFreshnessLabel(freshness);
    const freshnessColor = getFreshnessColor(freshness);
    const timeAgo = getTimeAgo(freshness);
    const title = node.title || node.label || "Unknown";
    const truncTitle =
      title.length > 50 ? title.substring(0, 50) + "..." : title;
    const source = node.source || "Unknown Source";

    return `
      <div style="background: rgba(15,15,25,0.95); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; padding: 10px 14px; max-width: 280px; font-family: system-ui, sans-serif; backdrop-filter: blur(8px);">
        <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; line-height: 1.3;">${truncTitle}</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
          <span style="font-size: 10px; color: #94a3b8;">${source}</span>
          <span style="font-size: 9px; color: ${freshnessColor}; background: ${freshnessColor}20; padding: 1px 6px; border-radius: 4px; font-weight: 500;">${freshnessLabel}</span>
          <span style="font-size: 9px; color: #64748b;">${timeAgo}</span>
        </div>
      </div>
    `;
  }, []);

  // Edge color - highlight connected edges
  const linkColor = useCallback(
    (link: any) => {
      if (!selectedNode) return "rgba(99, 102, 241, 0.25)";
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as any).id;
      const edgeKey = `${sourceId}-${targetId}`;
      if (connectedEdges.has(edgeKey)) {
        const nodeColor =
          categoryColors[selectedNode.category] || "#6366f1";
        return nodeColor;
      }
      return "rgba(99, 102, 241, 0.08)";
    },
    [selectedNode, connectedEdges]
  );

  // Edge width - highlight connected edges
  const linkWidth = useCallback(
    (link: any) => {
      if (!selectedNode) return (link.strength || 0.5) * 2;
      const sourceId =
        typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId =
        typeof link.target === "string" ? link.target : (link.target as any).id;
      const edgeKey = `${sourceId}-${targetId}`;
      if (connectedEdges.has(edgeKey)) {
        return (link.strength || 0.5) * 4;
      }
      return (link.strength || 0.5) * 0.8;
    },
    [selectedNode, connectedEdges]
  );

  // Reset the cached ring/label references whenever the node objects are about
  // to be rebuilt (selection change or graph data change). This runs during
  // render, before ForceGraph3D invokes nodeThreeObject for each node, so the
  // caches only ever hold the objects from the current build.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    pulseRingsRef.current = [];
    textLabelsRef.current = [];
    // Deps are intentional rebuild triggers: whenever the selection or graph
    // data changes, ForceGraph3D rebuilds every node object, so we must drop
    // the stale cached references before the new ones are collected.
  }, [selectedNode, connectedNodeIds, filteredData]);

  // Custom 3D node objects with glowing spheres, freshness-based glow, and labels
  const nodeThreeObject = useCallback(
    (node: any) => {
      const category = node.category || "domestic";
      const color = categoryColors[category] || "#6366f1";
      const freshness = node.freshnessScore || 0;
      const size = (node.val || 5) * 1.2 + 3;

      const group = new THREE.Group();

      // Brightness boost for connected nodes when a selection is active
      const isConnected =
        selectedNode &&
        (connectedNodeIds.has(node.id) || node.id === selectedNode.id);
      const emissiveBoost = isConnected ? 0.9 : 0.6;
      const opacityBoost = isConnected ? 0.95 : 0.85;

      // Main sphere with emissive glow
      const geometry = new THREE.SphereGeometry(size, 24, 24);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: emissiveBoost,
        transparent: true,
        opacity: opacityBoost,
        shininess: 100,
      });
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);

      // Outer glow sphere - opacity tied to freshnessScore
      const glowOpacity = 0.05 + freshness * 0.25;
      const glowSize = size * (1.3 + freshness * 0.4);
      const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: glowOpacity,
      });
      const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glowSphere);

      // Pulsing ring for fresh articles (freshnessScore > 0.7)
      if (freshness > 0.7) {
        const ringGeometry = new THREE.RingGeometry(
          size * 1.6,
          size * 1.8,
          32
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.name = "pulseRing";
        // Cache the ring so the animation loop can pulse it without traversing
        // the whole scene each frame.
        pulseRingsRef.current.push(ring);
        group.add(ring);
      }

      // Text label sprite - title (max 30 chars)
      const title = node.title || node.label || "";
      const truncTitle =
        title.length > 30 ? title.substring(0, 28) + "..." : title;

      if (truncTitle) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = 512;
          canvas.height = 64;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#e2e8f0";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 4;
          ctx.fillText(truncTitle, canvas.width / 2, canvas.height / 2);

          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.85,
            depthTest: false,
          });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.scale.set(size * 5, size * 0.7, 1);
          sprite.position.set(0, -(size + 4), 0);
          sprite.name = "textLabel";
          // Start hidden; the per-frame loop reveals labels only when the
          // camera is within LABEL_VISIBLE_DISTANCE of the node (LOD).
          sprite.visible = false;
          // Cache the label so the animation loop can toggle its visibility
          // without traversing the whole scene each frame.
          textLabelsRef.current.push(sprite);
          group.add(sprite);
        }
      }

      return group;
    },
    [selectedNode, connectedNodeIds]
  );

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
        nodeLabel={nodeLabel}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={4}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={() => "#818cf8"}
        linkOpacity={0.6}
        onNodeClick={handleNodeClick}
        cooldownTicks={100}
        enableNodeDrag={true}
        enableNavigationControls={true}
      />

      {/* Selected Node Details - Enhanced Panel */}
      {selectedNode && selectedArticle && (
        <div className="absolute bottom-4 left-4 right-4 z-10 max-w-2xl mx-auto">
          <div
            className="glass-strong rounded-xl overflow-hidden"
            style={{
              border: `1px solid ${categoryColors[selectedNode.category] || "#6366f1"}40`,
            }}
          >
            {/* Freshness indicator bar at top */}
            <div className="h-1 w-full relative overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(selectedArticle.freshnessScore || 0) * 100}%`,
                  backgroundColor: getFreshnessColor(
                    selectedArticle.freshnessScore || 0
                  ),
                }}
              />
            </div>

            <div className="p-4">
              <button
                onClick={() => setSelectedNode(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex gap-4">
                {/* Left: Related article image (falls back to category gradient) */}
                <div
                  className="shrink-0 w-[120px] h-[80px] rounded-lg overflow-hidden"
                  style={{
                    border: `1px solid ${categoryColors[selectedNode.category] || "#6366f1"}30`,
                  }}
                >
                  {selectedArticle.imageUrl && !imageError ? (
                    <img
                      src={selectedArticle.imageUrl}
                      alt={selectedArticle.title || selectedArticle.label || "Related article"}
                      loading="lazy"
                      onError={() => setImageError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${categoryGradients[selectedNode.category] || "from-indigo-500/20 to-indigo-900/40"}`}
                    >
                      <span
                        className="text-xs font-semibold capitalize"
                        style={{
                          color:
                            categoryColors[selectedNode.category] || "#6366f1",
                        }}
                      >
                        {selectedNode.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Center: Content */}
                <div className="flex-1 min-w-0">
                  {/* Category + source + freshness badge */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          categoryColors[selectedNode.category] || "#6366f1",
                      }}
                    />
                    <span className="text-xs text-gray-400 capitalize">
                      {selectedNode.category}
                    </span>
                    {selectedArticle.source && (
                      <>
                        <span className="text-xs text-gray-600">|</span>
                        <span className="text-xs text-gray-500">
                          {selectedArticle.source}
                        </span>
                      </>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        color: getFreshnessColor(
                          selectedArticle.freshnessScore || 0
                        ),
                        backgroundColor: `${getFreshnessColor(selectedArticle.freshnessScore || 0)}15`,
                      }}
                    >
                      <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                      {getFreshnessLabel(selectedArticle.freshnessScore || 0)} -{" "}
                      {getTimeAgo(selectedArticle.freshnessScore || 0)}
                    </span>
                  </div>

                  {/* Headline */}
                  <h3 className="text-sm font-semibold text-white mb-1.5 leading-tight">
                    {selectedArticle.title || selectedArticle.label}
                  </h3>

                  {/* Summary */}
                  {selectedArticle.summary && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                      {selectedArticle.summary.length > 200
                        ? selectedArticle.summary.substring(0, 200) + "..."
                        : selectedArticle.summary}
                    </p>
                  )}

                  {/* Impact + Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedArticle.economicImpactScore && (
                      <span className="text-[10px] text-indigo-400 font-medium bg-indigo-400/10 px-1.5 py-0.5 rounded">
                        <Zap className="h-2.5 w-2.5 inline mr-0.5" />
                        Impact: {selectedArticle.economicImpactScore}/10
                      </span>
                    )}
                    {selectedArticle.tags &&
                      selectedArticle.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] text-gray-500 bg-gray-700/30 px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Right: Visit Article button */}
                <div className="shrink-0 flex flex-col items-end justify-between">
                  {selectedArticle.url && (
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visit Article
                    </a>
                  )}
                </div>
              </div>

              {/* Related articles as clickable chips */}
              {relatedNodes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                    Related Articles ({relatedNodes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {relatedNodes.map(({ node, relationship }) => (
                      <button
                        key={node.id}
                        onClick={() => handleNodeClick(node)}
                        title={relationship}
                        className="group flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-left max-w-[200px]"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              categoryColors[node.category] || "#6366f1",
                          }}
                        />
                        <span className="text-[10px] text-gray-300 group-hover:text-white truncate">
                          {(node.title || node.label || "").substring(0, 35)}
                          {(node.title || node.label || "").length > 35
                            ? "..."
                            : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
