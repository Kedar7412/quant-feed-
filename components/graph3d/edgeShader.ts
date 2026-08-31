/**
 * Flow shader for the graph edges.
 *
 * Edges are drawn as a single THREE.LineSegments BufferGeometry (two vertices
 * per edge) in ONE draw call. Per-vertex attributes carry:
 *   - aEndpoint : 0 at the source vertex, 1 at the target vertex (flow param t)
 *   - aCausal   : 1 for causal relationships (animated cause->effect flow),
 *                 0 for semantic relationships (static, dimmer)
 *   - aHighlight: 1 when the edge touches the selected node
 *   - aStrength : edge strength 0..1 (drives base opacity)
 *
 * The fragment shader animates a bright pulse travelling from source to target
 * on causal edges (using a `uTime` uniform), leaves semantic edges static and
 * dim, and brightens highlighted edges toward the lime selection color.
 */

import * as THREE from "three";

export const EDGE_VERTEX_SHADER = /* glsl */ `
  attribute float aEndpoint;
  attribute float aCausal;
  attribute float aHighlight;
  attribute float aStrength;

  varying float vEndpoint;
  varying float vCausal;
  varying float vHighlight;
  varying float vStrength;

  void main() {
    vEndpoint = aEndpoint;
    vCausal = aCausal;
    vHighlight = aHighlight;
    vStrength = aStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const EDGE_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;

  varying float vEndpoint;
  varying float vCausal;
  varying float vHighlight;
  varying float vStrength;

  void main() {
    // Base dim line; semantic edges stay here.
    float baseAlpha = 0.06 + vStrength * 0.14;
    vec3 color = uBaseColor;
    float alpha = baseAlpha;

    // Causal edges: a travelling pulse from source (t=0) to target (t=1).
    if (vCausal > 0.5) {
      float head = fract(uTime * 0.35);
      float d = abs(vEndpoint - head);
      float pulse = smoothstep(0.25, 0.0, d);
      alpha = max(alpha, 0.15 + pulse * 0.7);
      color = mix(color, uHighlightColor, pulse * 0.6);
    }

    // Highlighted edges (connected to the selection) glow brightly.
    if (vHighlight > 0.5) {
      color = uHighlightColor;
      alpha = max(alpha, 0.55 + vStrength * 0.4);
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createEdgeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color("#a3e635") },
      uHighlightColor: { value: new THREE.Color("#4ade80") },
    },
    vertexShader: EDGE_VERTEX_SHADER,
    fragmentShader: EDGE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
