"use client";

/**
 * The <Canvas> subtree for the custom WebGL graph engine.
 *
 * Design principles (see FEAT-003):
 *   - frameloop="demand": the GPU idles when the scene is static; every
 *     component calls invalidate() only when it actually pushed work.
 *   - React does NOT reconcile individual 3D nodes/edges. All node/edge/label
 *     updates flow through useFrame callbacks that consume the FEAT-002 store's
 *     dirty ranges and write straight into GPU buffers. React renders exactly
 *     four long-lived scene children (nodes, edges, labels, impostors) plus the
 *     camera rig.
 *   - The single node ShaderMaterial is owned here and shared with both the
 *     InstancedNodes mesh and the ClusterImpostors LOD driver, and is disposed
 *     on unmount so filter toggles / navigation never leak GPU resources.
 *
 * This module is imported with `ssr: false` (see index dynamic wrapper) so it
 * never runs during server rendering.
 */

import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { graph3DStore } from "@/lib/graph3d/store";
import { createNodeMaterial } from "./nodeShader";
import { InstancedNodes } from "./InstancedNodes";
import { InstancedEdges } from "./InstancedEdges";
import { GraphLabels } from "./GraphLabels";
import { CameraRig } from "./CameraRig";
import { ClusterImpostors } from "./ClusterImpostors";

/** Reverse slot -> id used to translate a raycast hit into a selection. */
function idForSlot(slot: number): string | null {
  const state = graph3DStore.getState();
  let found: string | null = null;
  state.nodeSlots.forEach((s, id) => {
    if (s === slot) found = id;
  });
  return found;
}

function SceneContents() {
  // The single node material, owned by the scene and shared with the LOD layer.
  const nodeMaterial = useMemo(() => createNodeMaterial(), []);

  useEffect(() => {
    return () => {
      nodeMaterial.dispose();
    };
  }, [nodeMaterial]);

  const handleSelectSlot = (slot: number) => {
    const id = idForSlot(slot);
    graph3DStore.getState().setSelected(id);
  };

  return (
    <>
      {/* Soft ambient + two tinted point lights matching the design palette. */}
      <ambientLight intensity={0.6} color={0x404060} />
      <pointLight position={[120, 120, 120]} intensity={1.4} color={0xa3e635} distance={900} />
      <pointLight position={[-120, -60, -120]} intensity={1.0} color={0x4ade80} distance={800} />

      <InstancedNodes onSelectSlot={handleSelectSlot} material={nodeMaterial} />
      <InstancedEdges />
      <GraphLabels />
      <ClusterImpostors material={nodeMaterial} />
      <CameraRig />
    </>
  );
}

export default function GraphScene() {
  // Deselect when clicking empty space (pointer misses all instances).
  const handleMissedPointer = () => {
    if (graph3DStore.getState().selectedId !== null) {
      graph3DStore.getState().setSelected(null);
    }
  };

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 0, 320], fov: 55, near: 1, far: 2000 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onPointerMissed={handleMissedPointer}
      style={{ background: "transparent" }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(0x0a0a0a), 0);
      }}
    >
      <SceneContents />
    </Canvas>
  );
}
