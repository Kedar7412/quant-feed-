"use client";

/**
 * Single-draw-call edge renderer with a flow shader.
 *
 * All edges live in ONE THREE.LineSegments BufferGeometry (two vertices per
 * edge) sized to EDGE_CAPACITY. Endpoint positions are pulled from the store's
 * `positions` buffer each frame (edges follow their nodes as the sim ticks);
 * per-edge classification (causal vs semantic) and highlight state are rebuilt
 * only when the topology or selection changes, never per frame.
 *
 * Causal edges animate a directional cause->effect pulse (driven by a `uTime`
 * uniform); semantic edges are static and dimmer. Edges touching the selected
 * node are highlighted. No per-frame heap allocation: the geometry attribute
 * arrays are allocated once and mutated in place.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "zustand";
import { graph3DStore } from "@/lib/graph3d/store";
import {
  EDGE_CAPACITY,
  FLOATS_PER_EDGE,
  FLOATS_PER_POSITION,
} from "@/lib/graph3d/types";
import { getEdges } from "@/lib/graph3d/nodeRegistry";
import { createEdgeMaterial } from "./edgeShader";

/** Relationship strings we treat as causal (animated cause->effect flow). */
const CAUSAL_RELATIONSHIPS = new Set([
  "causes",
  "leads-to",
  "leads_to",
  "triggers",
  "impacts",
  "influences",
  "drives",
  "affects",
]);

function isCausalRelationship(relationship: string): boolean {
  return CAUSAL_RELATIONSHIPS.has(relationship.toLowerCase());
}

export function InstancedEdges() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const invalidate = useThree((s) => s.invalidate);

  const edgeCount = useStore(graph3DStore, (s) => s.edgeCount);
  const selectedId = useStore(graph3DStore, (s) => s.selectedId);

  // Geometry + attributes allocated ONCE at capacity, mutated in place.
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const vertexCount = EDGE_CAPACITY * 2;
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3)
    );
    g.setAttribute(
      "aEndpoint",
      new THREE.BufferAttribute(new Float32Array(vertexCount), 1)
    );
    g.setAttribute(
      "aCausal",
      new THREE.BufferAttribute(new Float32Array(vertexCount), 1)
    );
    g.setAttribute(
      "aHighlight",
      new THREE.BufferAttribute(new Float32Array(vertexCount), 1)
    );
    g.setAttribute(
      "aStrength",
      new THREE.BufferAttribute(new Float32Array(vertexCount), 1)
    );
    // aEndpoint is fixed: 0 for the first vertex of each edge, 1 for the second.
    const endpoint = g.getAttribute("aEndpoint").array as Float32Array;
    for (let i = 0; i < EDGE_CAPACITY; i++) {
      endpoint[i * 2] = 0;
      endpoint[i * 2 + 1] = 1;
    }
    return g;
  }, []);

  const material = useMemo(() => createEdgeMaterial(), []);

  /**
   * Rebuild the per-edge classification (causal/semantic) + highlight from the
   * current topology and selection. CPU work, but only on topology/selection
   * change (NOT per frame). Maps store edge slots back to relationship strings
   * via the node registry.
   */
  const rebuildClassification = () => {
    const state = graph3DStore.getState();
    const causal = geometry.getAttribute("aCausal").array as Float32Array;
    const highlight = geometry.getAttribute("aHighlight").array as Float32Array;
    const strength = geometry.getAttribute("aStrength").array as Float32Array;
    const rawEdges = getEdges();
    const selSlot =
      selectedId !== null ? state.nodeSlots.get(selectedId) : undefined;

    // The store rewrote edges in registry order (skipping dangling), so we walk
    // the raw edges and re-derive the causal flag / strength in the same order.
    let write = 0;
    for (let i = 0; i < rawEdges.length && write < state.edgeCount; i++) {
      const edge = rawEdges[i];
      const s = state.nodeSlots.get(edge.source);
      const t = state.nodeSlots.get(edge.target);
      if (s === undefined || t === undefined) continue;
      const c = isCausalRelationship(edge.relationship) ? 1 : 0;
      const isHi =
        selSlot !== undefined && (s === selSlot || t === selSlot) ? 1 : 0;
      const v0 = write * 2;
      const v1 = v0 + 1;
      causal[v0] = c;
      causal[v1] = c;
      highlight[v0] = isHi;
      highlight[v1] = isHi;
      const str = edge.strength;
      strength[v0] = str;
      strength[v1] = str;
      write++;
    }
    geometry.getAttribute("aCausal").needsUpdate = true;
    geometry.getAttribute("aHighlight").needsUpdate = true;
    geometry.getAttribute("aStrength").needsUpdate = true;
    geometry.setDrawRange(0, state.edgeCount * 2);
  };

  useEffect(() => {
    rebuildClassification();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeCount, selectedId]);

  // Per-frame: refresh endpoint positions from the store + advance flow time.
  useFrame((_, delta) => {
    const line = lineRef.current;
    if (!line) return;
    const state = graph3DStore.getState();
    const count = state.edgeCount;
    if (count === 0) {
      // No live edges: make sure nothing stale is drawn (a diff may have just
      // emptied the topology before the classification effect ran).
      geometry.setDrawRange(0, 0);
      return;
    }
    const positions = geometry.getAttribute("position").array as Float32Array;
    const storePos = state.positions;
    const storeEdges = state.edges;
    for (let e = 0; e < count; e++) {
      const eo = e * FLOATS_PER_EDGE;
      const sSlot = storeEdges[eo];
      const tSlot = storeEdges[eo + 1];
      const sp = sSlot * FLOATS_PER_POSITION;
      const tp = tSlot * FLOATS_PER_POSITION;
      const v0 = e * 6;
      positions[v0] = storePos[sp];
      positions[v0 + 1] = storePos[sp + 1];
      positions[v0 + 2] = storePos[sp + 2];
      positions[v0 + 3] = storePos[tp];
      positions[v0 + 4] = storePos[tp + 1];
      positions[v0 + 5] = storePos[tp + 2];
    }
    geometry.getAttribute("position").needsUpdate = true;
    // Keep the draw range clamped to the CURRENT live edge count every frame.
    // `rebuildClassification` (which also sets the draw range) runs in a
    // useEffect that fires AFTER the diff mutates the store, so for one frame the
    // draw range could otherwise still reflect the pre-diff (larger) edge count
    // and draw stale segments against slots a remove-only diff just freed/zeroed.
    // Clamping here in the same useFrame that reads the freshly-rewritten
    // `state.edges`/`state.edgeCount` guarantees no edge is ever drawn against a
    // recycled slot, even before the classification effect catches up.
    geometry.setDrawRange(0, count * 2);
    // Advance the flow animation clock (only matters while causal edges exist).
    (material.uniforms.uTime.value as number) += delta;
    invalidate();
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <lineSegments ref={lineRef} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}
