"use client";

/**
 * Single-draw-call instanced node renderer.
 *
 * Builds ONE THREE.InstancedMesh from one IcosahedronGeometry sized to the
 * store CAPACITY. Per-frame it consumes the store's dirty range and copies only
 * the touched slice into the instance matrix / color / custom attributes, sets
 * `needsUpdate` on just those attributes, and calls `invalidate()` so the
 * demand frameloop re-renders exactly when work happened.
 *
 * ZERO per-frame heap allocation in the hot path: every Matrix4/Vector3/
 * Quaternion/Color scratch object is hoisted to module scope and reused.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "zustand";
import { graph3DStore } from "@/lib/graph3d/store";
import {
  CAPACITY,
  FLOATS_PER_COLOR,
  FLOATS_PER_POSITION,
} from "@/lib/graph3d/types";

// ---- Hoisted scratch (module scope): reused every frame, never reallocated ----
const SCRATCH_MATRIX = new THREE.Matrix4();
const SCRATCH_POSITION = new THREE.Vector3();
const SCRATCH_QUATERNION = new THREE.Quaternion();
const SCRATCH_SCALE = new THREE.Vector3();
const SCRATCH_COLOR = new THREE.Color();

interface InstancedNodesProps {
  /** onClick handler receives the raycast instanceId (slot). */
  onSelectSlot: (slot: number) => void;
  /** Shared node ShaderMaterial (owned by GraphScene, also read by ClusterImpostors). */
  material: THREE.ShaderMaterial;
}

export function InstancedNodes({ onSelectSlot, material }: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  // Subscribe to the high-water mark so the mesh's draw count follows the store,
  // but the node geometry itself is never re-created by React.
  //
  // IMPORTANT: the draw count is the high-water mark, NOT `liveCount`. Slots are
  // stable and recycled via a free-list, so after a remove-only diff a live node
  // can occupy an index >= liveCount while a lower index sits empty. Drawing
  // instances [0, highWater) covers every live node; freed/empty slots below the
  // high-water mark are scale-0 and render as nothing, so they are safe to draw.
  // Using `liveCount` here would truncate the highest live slots (they vanish)
  // and instead draw empty low-index slots.
  const drawCount = useStore(graph3DStore, (s) => s.highWater);

  // One geometry sized to CAPACITY. Memoized so React never rebuilds it;
  // explicitly disposed on unmount. The material is owned by GraphScene.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);

  // Custom per-instance attributes (impact / freshness / selected). Allocated
  // once at CAPACITY and mutated in place.
  const impactAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1),
    []
  );
  const freshnessAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1),
    []
  );
  const selectedAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1),
    []
  );

  // Attach custom attributes + enable per-instance color once the mesh exists.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    geometry.setAttribute("aImpact", impactAttr);
    geometry.setAttribute("aFreshness", freshnessAttr);
    geometry.setAttribute("aSelected", selectedAttr);
    // Ensure instanceColor exists (InstancedMesh lazily creates it on setColorAt).
    SCRATCH_COLOR.set(1, 1, 1);
    for (let i = 0; i < CAPACITY; i++) {
      mesh.setColorAt(i, SCRATCH_COLOR);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Force a full initial sync from whatever the store already holds.
    fullSync(mesh);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, impactAttr, freshnessAttr, selectedAttr, invalidate]);

  /** Copy a contiguous [start, start+count) slice of store buffers to the GPU. */
  function syncRange(mesh: THREE.InstancedMesh, start: number, count: number) {
    const state = graph3DStore.getState();
    const { positions, scales, colors, impacts, freshness, selected } = state;
    const end = Math.min(start + count, CAPACITY);
    for (let slot = start; slot < end; slot++) {
      const p = slot * FLOATS_PER_POSITION;
      SCRATCH_POSITION.set(positions[p], positions[p + 1], positions[p + 2]);
      const s = scales[slot];
      SCRATCH_SCALE.set(s, s, s);
      SCRATCH_QUATERNION.identity();
      SCRATCH_MATRIX.compose(SCRATCH_POSITION, SCRATCH_QUATERNION, SCRATCH_SCALE);
      mesh.setMatrixAt(slot, SCRATCH_MATRIX);

      const c = slot * FLOATS_PER_COLOR;
      SCRATCH_COLOR.setRGB(colors[c], colors[c + 1], colors[c + 2]);
      mesh.setColorAt(slot, SCRATCH_COLOR);

      (impactAttr.array as Float32Array)[slot] = impacts[slot];
      (freshnessAttr.array as Float32Array)[slot] = freshness[slot];
      (selectedAttr.array as Float32Array)[slot] = selected[slot];
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    impactAttr.needsUpdate = true;
    freshnessAttr.needsUpdate = true;
    selectedAttr.needsUpdate = true;
  }

  /** Full resync (used on mount / re-init) covering every possible slot. */
  function fullSync(mesh: THREE.InstancedMesh) {
    syncRange(mesh, 0, CAPACITY);
  }

  // Per-frame hot path: pull the dirty range, push it, re-render on demand.
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const range = graph3DStore.getState().consumeDirtyRange();
    if (range === null) return;
    syncRange(mesh, range.start, range.count);
    invalidate();
  });

  // Explicit teardown: dispose geometry (the shared material is disposed by
  // its owner, GraphScene).
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const handleClick = (event: { instanceId?: number; stopPropagation: () => void }) => {
    if (event.instanceId === undefined) return;
    event.stopPropagation();
    onSelectSlot(event.instanceId);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, CAPACITY]}
      // Draw every slot up to the high-water mark. Slots are sparse after
      // removals, so this is driven by highWater (not liveCount) to avoid
      // truncating high-index live nodes; empty slots below it are scale-0.
      count={Math.max(drawCount, 0)}
      frustumCulled={false}
      onClick={handleClick}
    />
  );
}
