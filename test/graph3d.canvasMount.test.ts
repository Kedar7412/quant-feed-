/**
 * Headless canvas-mount smoke test for the Step 2 WebGL engine.
 *
 * WHY THIS SHAPE (documented per FEAT-003):
 * The preferred path was Playwright against a bounded `next start`, asserting a
 * real <canvas> mounts with no console errors. In this sandbox that path is not
 * viable: (1) headless Chromium has no GPU/display server, so a real WebGL
 * context is unavailable, and (2) the sandbox reaps backgrounded dev/prod
 * servers, so `next start` cannot be kept alive across the test run. `next start`
 * DID come up and serve in a bounded foreground process, and `bun run build`
 * compiles the /network route cleanly - both recorded in the feature findings.
 *
 * So this smoke test uses the documented FALLBACK: it constructs the engine's
 * real GPU objects (the custom node + edge ShaderMaterials, the instanced
 * icosahedron geometry with its custom per-instance attributes, and a real
 * THREE.InstancedMesh) OUTSIDE a browser and drives the exact store -> GPU
 * buffer-sync path the <Canvas>'s useFrame callback runs. three.js builds these
 * objects without a live WebGL context (shaders compile lazily at draw time),
 * so this asserts the scene INITIALISES without throwing: shader source,
 * attribute wiring, geometry/material construction, dirty-range consumption, and
 * matrix/color writes are all exercised.
 *
 * WHAT THIS CANNOT VALIDATE (needs a real browser + GPU): actual shader
 * compilation/linking, on-screen visual correctness, and frame rate (the 60 FPS
 * target). Those must be checked in the user's browser.
 */

import { describe, it, expect } from "bun:test";
import * as THREE from "three";
import { createGraph3DStore } from "@/lib/graph3d/store";
import {
  CAPACITY,
  FLOATS_PER_COLOR,
  FLOATS_PER_POSITION,
  type GraphData,
} from "@/lib/graph3d/types";
import { createNodeMaterial } from "@/components/graph3d/nodeShader";
import { createEdgeMaterial } from "@/components/graph3d/edgeShader";

const graph: GraphData = {
  nodes: [
    {
      id: "a",
      articleId: "a",
      label: "Alpha",
      category: "economic",
      economicImpactScore: 8,
      freshnessScore: 0.9,
    },
    {
      id: "b",
      articleId: "b",
      label: "Beta",
      category: "political",
      economicImpactScore: 3,
      freshnessScore: 0.2,
    },
  ],
  links: [{ source: "a", target: "b", strength: 0.7, relationship: "causes" }],
};

describe("graph3d canvas-mount smoke (stubbed WebGL fallback)", () => {
  it("builds the node shader material without throwing", () => {
    const material = createNodeMaterial();
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(material.vertexShader.length).toBeGreaterThan(0);
    expect(material.fragmentShader.length).toBeGreaterThan(0);
    // LOD + selection uniforms wired.
    expect(material.uniforms.uSelectionColor.value).toBeInstanceOf(THREE.Color);
    expect(material.uniforms.uCollapse.value).toBe(0);
    expect(material.uniforms.uLowImpactCutoff.value).toBe(5);
    material.dispose();
  });

  it("builds the edge flow material with a time uniform", () => {
    const material = createEdgeMaterial();
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(material.uniforms.uTime.value).toBe(0);
    expect(material.transparent).toBe(true);
    material.dispose();
  });

  it("initialises a single InstancedMesh with custom attributes and syncs the store", () => {
    const store = createGraph3DStore();
    store.getState().initFromGraph(graph);

    // ONE geometry + ONE material -> ONE draw call, sized to CAPACITY.
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const material = createNodeMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);

    // Custom per-instance attributes, exactly as InstancedNodes wires them.
    const impactAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY),
      1
    );
    const freshnessAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY),
      1
    );
    const selectedAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(CAPACITY),
      1
    );
    geometry.setAttribute("aImpact", impactAttr);
    geometry.setAttribute("aFreshness", freshnessAttr);
    geometry.setAttribute("aSelected", selectedAttr);

    // Drive the exact dirty-range -> GPU sync path the useFrame callback runs.
    const range = store.getState().consumeDirtyRange();
    expect(range).not.toBeNull();
    expect(range!.start).toBe(0);
    expect(range!.count).toBeGreaterThanOrEqual(2);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    const state = store.getState();

    expect(() => {
      for (let slot = range!.start; slot < range!.start + range!.count; slot++) {
        const p = slot * FLOATS_PER_POSITION;
        position.set(
          state.positions[p],
          state.positions[p + 1],
          state.positions[p + 2]
        );
        const s = state.scales[slot];
        scale.set(s, s, s);
        quaternion.identity();
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(slot, matrix);
        const c = slot * FLOATS_PER_COLOR;
        color.setRGB(
          state.colors[c],
          state.colors[c + 1],
          state.colors[c + 2]
        );
        mesh.setColorAt(slot, color);
        (impactAttr.array as Float32Array)[slot] = state.impacts[slot];
        (freshnessAttr.array as Float32Array)[slot] = state.freshness[slot];
        (selectedAttr.array as Float32Array)[slot] = state.selected[slot];
      }
    }).not.toThrow();

    // Slot 0 (impact 8) should be scaled larger than slot 1 (impact 3).
    expect(state.scales[0]).toBeGreaterThan(state.scales[1]);
    // Range clears after consume (demand loop would idle now).
    expect(store.getState().consumeDirtyRange()).toBeNull();

    // Explicit teardown must not throw.
    expect(() => {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    }).not.toThrow();
  });

  it("builds the edge LineSegments geometry with per-edge attributes", () => {
    const geometry = new THREE.BufferGeometry();
    const vertexCount = 4; // 2 edges worth
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3)
    );
    geometry.setAttribute(
      "aEndpoint",
      new THREE.BufferAttribute(new Float32Array(vertexCount), 1)
    );
    const material = createEdgeMaterial();
    expect(() => {
      const line = new THREE.LineSegments(geometry, material);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }).not.toThrow();
  });
});
