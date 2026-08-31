"use client";

/**
 * Camera rig: eased dolly transitions + scene fog.
 *
 * Wraps drei's <CameraControls> (a thin R3F binding over the `camera-controls`
 * library) to give smooth, damped orbit/dolly. When a node is selected the rig
 * eases the camera to frame that node; on "reset" it eases back to the origin
 * overview. Distance fog is applied at the scene level so far/older nodes fade
 * into the charcoal background, reinforcing the time-axis Z depth.
 *
 * All target vectors are hoisted to module scope - no per-frame/per-transition
 * allocation.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "zustand";
import { graph3DStore } from "@/lib/graph3d/store";
import { FLOATS_PER_POSITION } from "@/lib/graph3d/types";

// Hoisted scratch for transitions.
const TARGET = new THREE.Vector3();

export function CameraRig() {
  const controlsRef = useRef<CameraControls>(null);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useThree((s) => s.scene);
  const selectedId = useStore(graph3DStore, (s) => s.selectedId);

  // Distance fog: charcoal background so distant/older nodes recede.
  useEffect(() => {
    const prevFog = scene.fog;
    scene.fog = new THREE.Fog(0x0a0a0a, 220, 900);
    return () => {
      scene.fog = prevFog;
    };
  }, [scene]);

  // Ease the camera to the selected node (or back to overview on deselect).
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (selectedId === null) {
      // Overview: ease back to a framed origin view.
      controls.setLookAt(0, 0, 320, 0, 0, 0, true);
      invalidate();
      return;
    }
    const state = graph3DStore.getState();
    const slot = state.nodeSlots.get(selectedId);
    if (slot === undefined) return;
    const p = slot * FLOATS_PER_POSITION;
    TARGET.set(
      state.positions[p],
      state.positions[p + 1],
      state.positions[p + 2]
    );
    // Dolly in to ~90 units from the node along the current view direction.
    const dist = 90;
    controls.setLookAt(
      TARGET.x + dist * 0.4,
      TARGET.y + dist * 0.3,
      TARGET.z + dist,
      TARGET.x,
      TARGET.y,
      TARGET.z,
      true
    );
    invalidate();
  }, [selectedId, invalidate]);

  // Advance the damped controls each frame and keep the demand loop alive while
  // they are still easing. `update` returns true while the camera is moving.
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const updated = controls.update(delta);
    if (updated) invalidate();
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={20}
      maxDistance={900}
      smoothTime={0.4}
      draggingSmoothTime={0.15}
      onChange={() => invalidate()}
    />
  );
}
