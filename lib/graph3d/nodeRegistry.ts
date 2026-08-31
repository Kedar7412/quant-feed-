/**
 * Node-metadata registry for the HUD layer.
 *
 * The FEAT-002 store owns only GPU-bound numeric attributes keyed by slot
 * (position, scale, color, impact, freshness, selected). The HUD inspector,
 * however, needs the full `EconomicNode` metadata (headline, summary, source,
 * image, tags, url) plus the edge topology to compute related nodes.
 *
 * Rather than bloat the hot-path typed-array store with object references, this
 * tiny module keeps a plain id -> EconomicNode map and the raw edge list that
 * the current graph was initialised from. It is refreshed whenever the page
 * (re)loads graph data and is read only by React DOM (never by the render
 * loop), so it has no per-frame allocation concerns.
 */

import type { EconomicEdge, EconomicNode, GraphData } from "@/lib/types";

let nodesById = new Map<string, EconomicNode>();
let edges: EconomicEdge[] = [];

/** Replace the registry contents from a freshly loaded graph. */
export function setNodeRegistry(graph: GraphData): void {
  const map = new Map<string, EconomicNode>();
  for (const node of graph.nodes) {
    map.set(node.id, node);
  }
  nodesById = map;
  edges = graph.links;
}

/** Look up full metadata for a node id (undefined if unknown). */
export function getNodeMeta(id: string): EconomicNode | undefined {
  return nodesById.get(id);
}

/** All raw edges for the current graph. */
export function getEdges(): EconomicEdge[] {
  return edges;
}

/**
 * Compute the related nodes for a selected id: every node on the other end of
 * an edge touching the selection, plus the relationship label. Read by the
 * inspector drawer only.
 */
export function getRelatedNodes(
  selectedId: string
): Array<{ node: EconomicNode; relationship: string }> {
  const related: Array<{ node: EconomicNode; relationship: string }> = [];
  for (const link of edges) {
    if (link.source === selectedId) {
      const node = nodesById.get(link.target);
      if (node) related.push({ node, relationship: link.relationship });
    } else if (link.target === selectedId) {
      const node = nodesById.get(link.source);
      if (node) related.push({ node, relationship: link.relationship });
    }
  }
  return related;
}
