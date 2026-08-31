"use client";

/**
 * Semantic level-of-detail: cluster impostors.
 *
 * When the camera dollies out beyond COLLAPSE_DISTANCE, low-impact nodes are
 * collapsed GPU-side (the node material's `uCollapse` uniform is raised to 1,
 * shrinking sub-cutoff instances to zero in the vertex shader) and this
 * component reveals one large translucent "impostor" sphere per category,
 * positioned at that category's live-node centroid and sized to its spread.
 * Zooming back in lowers `uCollapse` to 0 and hides the impostors, expanding
 * the individual nodes again.
 *
 * CPU WORK (documented): once per frame we compute 4 category centroids/extents
 * by summing over live slots. This is O(liveNodes) but touches only scalars and
 * writes into pre-allocated, hoisted arrays - ZERO per-frame heap allocation.
 * The expensive per-node collapse itself is done on the GPU.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { graph3DStore } from "@/lib/graph3d/store";
import { CATEGORY_COLORS, FLOATS_PER_POSITION } from "@/lib/graph3d/types";
import { getNodeMeta } from "@/lib/graph3d/nodeRegistry";
import type { EconomicNode } from "@/lib/types";

/** Camera distance beyond which low-impact nodes collapse into impostors. */
const COLLAPSE_DISTANCE = 480;
/** Nodes with impact below this collapse when zoomed out. */
const LOW_IMPACT_CUTOFF = 5;

const CATEGORY_ORDER: EconomicNode["category"][] = [
  "domestic",
  "international",
  "economic",
  "political",
];

// Hoisted per-category accumulators (index 0..3), reused every frame.
const sumX = new Float32Array(4);
const sumY = new Float32Array(4);
const sumZ = new Float32Array(4);
const counts = new Int32Array(4);
const maxR = new Float32Array(4);

interface ClusterImpostorsProps {
  /** The node ShaderMaterial whose uCollapse uniform this component drives. */
  material: THREE.ShaderMaterial;
}

export function ClusterImpostors({ material }: ClusterImpostorsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 24, 24), []);
  const impostorMats = useMemo(
    () =>
      CATEGORY_ORDER.map(
        (cat) =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(CATEGORY_COLORS[cat]),
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
          })
      ),
    []
  );

  useEffect(() => {
    material.uniforms.uLowImpactCutoff.value = LOW_IMPACT_CUTOFF;
  }, [material]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      impostorMats.forEach((m) => m.dispose());
    };
  }, [geometry, impostorMats]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const state = graph3DStore.getState();
    const dist = camera.position.length();
    const collapse = dist > COLLAPSE_DISTANCE ? 1 : 0;

    // Toggle the GPU collapse uniform.
    if (material.uniforms.uCollapse.value !== collapse) {
      material.uniforms.uCollapse.value = collapse;
      invalidate();
    }

    if (collapse === 0) {
      if (group.visible) {
        group.visible = false;
        invalidate();
      }
      return;
    }
    group.visible = true;

    // Reset accumulators.
    sumX.fill(0);
    sumY.fill(0);
    sumZ.fill(0);
    counts.fill(0);
    maxR.fill(0);

    const { positions, impacts } = state;
    state.nodeSlots.forEach((slot, id) => {
      if (impacts[slot] >= LOW_IMPACT_CUTOFF) return; // high-impact stay visible
      const meta = getNodeMeta(id);
      const cat = meta ? CATEGORY_ORDER.indexOf(meta.category) : -1;
      if (cat < 0) return;
      const p = slot * FLOATS_PER_POSITION;
      sumX[cat] += positions[p];
      sumY[cat] += positions[p + 1];
      sumZ[cat] += positions[p + 2];
      counts[cat]++;
    });

    // Second pass for extents (radius) using the centroid.
    state.nodeSlots.forEach((slot, id) => {
      if (impacts[slot] >= LOW_IMPACT_CUTOFF) return;
      const meta = getNodeMeta(id);
      const cat = meta ? CATEGORY_ORDER.indexOf(meta.category) : -1;
      if (cat < 0 || counts[cat] === 0) return;
      const cx = sumX[cat] / counts[cat];
      const cy = sumY[cat] / counts[cat];
      const cz = sumZ[cat] / counts[cat];
      const p = slot * FLOATS_PER_POSITION;
      const dx = positions[p] - cx;
      const dy = positions[p + 1] - cy;
      const dz = positions[p + 2] - cz;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > maxR[cat]) maxR[cat] = r;
    });

    // Position/scale the 4 impostor meshes (children of the group).
    for (let cat = 0; cat < 4; cat++) {
      const mesh = group.children[cat] as THREE.Mesh | undefined;
      if (!mesh) continue;
      if (counts[cat] === 0) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(
        sumX[cat] / counts[cat],
        sumY[cat] / counts[cat],
        sumZ[cat] / counts[cat]
      );
      const radius = Math.max(20, maxR[cat] + 12);
      mesh.scale.setScalar(radius);
    }
    invalidate();
  });

  return (
    <group ref={groupRef} visible={false}>
      {CATEGORY_ORDER.map((cat, i) => (
        <mesh key={cat} geometry={geometry} material={impostorMats[i]} />
      ))}
    </group>
  );
}
