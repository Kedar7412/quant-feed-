/**
 * d3-force-3d layout simulation running in a Web Worker.
 *
 * WHY A WORKER (not GPGPU) FOR STEP 2:
 * The layout is a classic n-body / spring relaxation that d3-force-3d already
 * implements robustly on the CPU. Running it in a dedicated worker keeps the
 * main thread free for React reconciliation, camera controls, and the WebGL
 * draw loop, so tick cost never causes dropped frames on the render side. A
 * GPGPU (transform-feedback / compute-shader) force solver would be faster for
 * very large graphs, but it is a substantially bigger lift (custom shaders,
 * spatial hashing on the GPU, cross-vendor pitfalls) and is deferred to a later
 * step. For Step 2's node counts, an off-main-thread CPU sim is the right
 * trade-off: simple, correct, and non-blocking.
 *
 * PROTOCOL (main thread <-> worker):
 *   IN  { type: "init", nodes: WorkerNode[], edges: WorkerEdge[] }
 *   IN  { type: "visibility", visible: number[] }   // slot indices to pin/unpin
 *   IN  { type: "stop" }
 *   OUT { type: "tick", slots: number[], positions: Float32Array }  // [x,y,z]*
 *
 * Positions are keyed by the stable slot index so the main-thread client can
 * scatter them straight into the store's `positions` buffer.
 */

/// <reference lib="webworker" />

import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceX,
  forceY,
  forceZ,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force-3d";

interface WorkerNode extends SimulationNodeDatum {
  /** Stable store slot index. */
  slot: number;
  /** Category attractor bucket (0..3) used for clustering. */
  category: number;
}

interface WorkerEdge extends SimulationLinkDatum<WorkerNode> {
  source: number;
  target: number;
  strength: number;
}

type InboundMessage =
  | { type: "init"; nodes: WorkerNode[]; edges: WorkerEdge[] }
  | { type: "visibility"; visible: number[] }
  | { type: "stop" };

// Per-category attractor anchors (spread clusters around the origin).
const CATEGORY_ANCHORS: Array<{ x: number; y: number; z: number }> = [
  { x: -120, y: 80, z: 0 },
  { x: 120, y: 80, z: 0 },
  { x: -120, y: -80, z: 0 },
  { x: 120, y: -80, z: 0 },
];

let simulation: Simulation<WorkerNode, WorkerEdge> | null = null;
let nodes: WorkerNode[] = [];

function categoryAnchor(n: WorkerNode, axis: "x" | "y" | "z"): number {
  const anchor = CATEGORY_ANCHORS[n.category] ?? CATEGORY_ANCHORS[0];
  return anchor[axis];
}

function buildSimulation(inNodes: WorkerNode[], inEdges: WorkerEdge[]): void {
  nodes = inNodes;
  simulation = forceSimulation<WorkerNode, WorkerEdge>(nodes, 3)
    .force("charge", forceManyBody<WorkerNode>().strength(-45))
    .force(
      "link",
      forceLink<WorkerNode, WorkerEdge>(inEdges)
        // Edge strength (0..1) sets the link spring constant: stronger edges
        // pull their endpoints tighter together.
        .id((n) => n.slot)
        .strength((e) => Math.max(0.05, Math.min(1, e.strength)))
        .distance(40)
    )
    .force("center", forceCenter<WorkerNode>(0, 0, 0))
    // Per-category attractor forces cluster nodes of the same category.
    .force("clusterX", forceX<WorkerNode>((n) => categoryAnchor(n, "x")).strength(0.08))
    .force("clusterY", forceY<WorkerNode>((n) => categoryAnchor(n, "y")).strength(0.08))
    .force("clusterZ", forceZ<WorkerNode>((n) => categoryAnchor(n, "z")).strength(0.02))
    .on("tick", postTick);
}

function postTick(): void {
  if (!simulation) return;
  const slots: number[] = new Array(nodes.length);
  const positions = new Float32Array(nodes.length * 3);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    slots[i] = n.slot;
    positions[i * 3] = n.x ?? 0;
    positions[i * 3 + 1] = n.y ?? 0;
    positions[i * 3 + 2] = n.z ?? 0;
  }
  // Transfer the positions buffer to avoid a copy across the worker boundary.
  (self as unknown as Worker).postMessage(
    { type: "tick", slots, positions },
    [positions.buffer]
  );
}

self.onmessage = (event: MessageEvent<InboundMessage>): void => {
  const msg = event.data;
  switch (msg.type) {
    case "init":
      buildSimulation(msg.nodes, msg.edges);
      break;
    case "visibility": {
      if (!simulation) break;
      const visible = new Set(msg.visible);
      // Pin filtered-out nodes in place (fx/fy/fz) so they stop influencing
      // the layout; unpin visible ones so they relax freely.
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (visible.has(n.slot)) {
          n.fx = null;
          n.fy = null;
          n.fz = null;
        } else {
          n.fx = n.x ?? 0;
          n.fy = n.y ?? 0;
          n.fz = n.z ?? 0;
        }
      }
      simulation.alpha(0.3).restart();
      break;
    }
    case "stop":
      simulation?.stop();
      simulation = null;
      nodes = [];
      break;
  }
};

export type { WorkerNode, WorkerEdge, InboundMessage };
