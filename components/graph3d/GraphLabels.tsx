"use client";

/**
 * SDF label layer via troika-three-text.
 *
 * A FIXED pool of Text instances (MAX_VISIBLE_LABELS) is created once and
 * reused every frame - no per-frame allocation of Text objects or strings for
 * the pool. Each frame we score candidate nodes by an LOD metric combining:
 *   - frustum cull (skip nodes outside the camera frustum)
 *   - camera distance (nearer = higher priority, far nodes drop out)
 *   - node importance (impact + freshness)
 * then assign the top ~50 to the pool, hide the rest. This caps visible labels
 * regardless of graph size.
 *
 * All Text instances are disposed on unmount to release their GPU resources.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "troika-three-text";
import { graph3DStore } from "@/lib/graph3d/store";
import { CAPACITY, FLOATS_PER_POSITION } from "@/lib/graph3d/types";
import { getNodeMeta } from "@/lib/graph3d/nodeRegistry";

const MAX_VISIBLE_LABELS = 50;
/** Nodes farther than this from the camera never get a label. */
const MAX_LABEL_DISTANCE = 600;

// ---- Hoisted scratch (module scope), reused every frame ----
const SCRATCH_FRUSTUM = new THREE.Frustum();
const SCRATCH_PROJ_MATRIX = new THREE.Matrix4();
const SCRATCH_POINT = new THREE.Vector3();

/** Candidate scoring record; a fixed pool of these is reused each frame. */
interface Candidate {
  slot: number;
  score: number;
  x: number;
  y: number;
  z: number;
}

export function GraphLabels() {
  const groupRef = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);

  // Fixed pool of Text instances, created once.
  const pool = useMemo<Text[]>(() => {
    const items: Text[] = [];
    for (let i = 0; i < MAX_VISIBLE_LABELS; i++) {
      const t = new Text();
      t.fontSize = 6;
      t.color = 0xe2e8f0;
      t.anchorX = "center";
      t.anchorY = "top";
      t.outlineWidth = 0.3;
      t.outlineColor = 0x000000;
      t.material.depthTest = false;
      t.visible = false;
      items.push(t);
    }
    return items;
  }, []);

  // Reused candidate scratch array (grown once to CAPACITY, never per frame).
  const candidates = useMemo<Candidate[]>(() => {
    const arr: Candidate[] = new Array(CAPACITY);
    for (let i = 0; i < CAPACITY; i++) {
      arr[i] = { slot: -1, score: 0, x: 0, y: 0, z: 0 };
    }
    return arr;
  }, []);

  // Add pool Text objects to the group once it mounts.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    for (const t of pool) group.add(t);
    return () => {
      for (const t of pool) {
        group.remove(t);
        t.dispose();
      }
    };
  }, [pool]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const state = graph3DStore.getState();
    const { positions, impacts, freshness } = state;

    // Build the frustum for culling.
    SCRATCH_PROJ_MATRIX.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    SCRATCH_FRUSTUM.setFromProjectionMatrix(SCRATCH_PROJ_MATRIX);

    const camPos = camera.position;
    let n = 0;
    // Score every live slot (walk the id->slot map for live slots only).
    state.nodeSlots.forEach((slot) => {
      const p = slot * FLOATS_PER_POSITION;
      const x = positions[p];
      const y = positions[p + 1];
      const z = positions[p + 2];
      SCRATCH_POINT.set(x, y, z);
      if (!SCRATCH_FRUSTUM.containsPoint(SCRATCH_POINT)) return;
      const dist = camPos.distanceTo(SCRATCH_POINT);
      if (dist > MAX_LABEL_DISTANCE) return;
      // Importance: impact (0..10) + freshness (0..1) weighted, decayed by dist.
      const importance = impacts[slot] * 0.1 + freshness[slot];
      const score = importance / (1 + dist / 120);
      const c = candidates[n];
      c.slot = slot;
      c.score = score;
      c.x = x;
      c.y = y;
      c.z = z;
      n++;
    });

    // Partial selection of the top MAX_VISIBLE_LABELS by score (in place).
    const visible = Math.min(n, MAX_VISIBLE_LABELS);
    for (let i = 0; i < visible; i++) {
      let best = i;
      for (let j = i + 1; j < n; j++) {
        if (candidates[j].score > candidates[best].score) best = j;
      }
      if (best !== i) {
        const tmp = candidates[i];
        candidates[i] = candidates[best];
        candidates[best] = tmp;
      }
    }

    // Assign the top candidates to the pool; hide the remainder.
    for (let i = 0; i < pool.length; i++) {
      const t = pool[i];
      if (i < visible) {
        const c = candidates[i];
        const meta = getNodeMeta(idForSlot(state, c.slot));
        const raw = meta?.title || meta?.label || "";
        const label = raw.length > 40 ? raw.slice(0, 38) + "..." : raw;
        if (t.text !== label) {
          t.text = label;
          t.sync();
        }
        t.position.set(c.x, c.y - 4, c.z);
        t.visible = label.length > 0;
      } else if (t.visible) {
        t.visible = false;
      }
    }
    invalidate();
  });

  return <group ref={groupRef} />;
}

/** Reverse lookup slot -> id (small, only for the <=50 visible labels). */
function idForSlot(
  state: ReturnType<typeof graph3DStore.getState>,
  slot: number
): string {
  let found = "";
  state.nodeSlots.forEach((s, id) => {
    if (s === slot) found = id;
  });
  return found;
}
