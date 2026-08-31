/**
 * Custom node shader for the single-draw-call InstancedMesh.
 *
 * The engine renders every graph node through ONE THREE.InstancedMesh built
 * from a single IcosahedronGeometry. Per-instance appearance is driven entirely
 * on the GPU by three custom instanced buffer attributes plus the built-in
 * per-instance matrix/color:
 *
 *   - instanceMatrix  (built-in) : position + uniform scale from impact
 *   - instanceColor   (built-in) : category base color
 *   - aImpact         (custom)   : raw impact score (reserved for future sizing)
 *   - aFreshness      (custom)   : 0..1 emissive-glow intensity
 *   - aSelected       (custom)   : 0/1 selection highlight flag
 *
 * The fragment shader adds a fresnel rim + freshness-driven emissive glow and a
 * lime selection halo, so glow/size/selection are all GPU-side with zero
 * per-node React reconciliation. Scale (from impact) is baked into the instance
 * matrix by the render loop, keeping the vertex path cheap.
 */

import * as THREE from "three";

export const NODE_VERTEX_SHADER = /* glsl */ `
  attribute float aImpact;
  attribute float aFreshness;
  attribute float aSelected;

  // Semantic LOD: when uCollapse=1 (camera zoomed out), low-impact nodes
  // (impact < uLowImpactCutoff) shrink to zero so their per-category cluster
  // impostor sphere represents them instead. GPU-side, so no CPU per-node work.
  uniform float uCollapse;
  uniform float uLowImpactCutoff;

  varying vec3 vColor;
  varying float vFreshness;
  varying float vSelected;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;

  void main() {
    vColor = instanceColor;
    vFreshness = aFreshness;
    vSelected = aSelected;

    // Collapse factor: 0 hides the node (low-impact + zoomed out), else 1.
    float collapsed = (uCollapse > 0.5 && aImpact < uLowImpactCutoff && aSelected < 0.5)
      ? 0.0 : 1.0;

    vec3 localPos = position * collapsed;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(localPos, 1.0);
    vViewNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const NODE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSelectionColor;

  varying vec3 vColor;
  varying float vFreshness;
  varying float vSelected;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;

  void main() {
    // Fresnel rim: brighter at grazing angles for a glassy sphere look.
    float fresnel = pow(1.0 - max(dot(vViewNormal, vViewDir), 0.0), 2.0);

    // Base lit color: cheap hemispheric-ish term from the view normal.
    float lambert = 0.45 + 0.55 * max(vViewNormal.z, 0.0);
    vec3 base = vColor * lambert;

    // Freshness drives emissive glow (fresher = hotter core + stronger rim).
    vec3 emissive = vColor * (0.25 + vFreshness * 1.4);
    vec3 color = base + emissive * fresnel + emissive * 0.15;

    // Selection halo: blend toward the lime selection color on the rim.
    color = mix(color, uSelectionColor, vSelected * (0.35 + 0.65 * fresnel));

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Build the ShaderMaterial used by the instanced node mesh. */
export function createNodeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      // Lime selection highlight from the design system.
      uSelectionColor: { value: new THREE.Color("#a3e635") },
      // Semantic LOD controls (driven by the camera distance in ClusterImpostors).
      uCollapse: { value: 0 },
      uLowImpactCutoff: { value: 5 },
    },
    vertexShader: NODE_VERTEX_SHADER,
    fragmentShader: NODE_FRAGMENT_SHADER,
    // instanceColor is a built-in attribute enabled by InstancedMesh; declaring
    // vertexColors here lets three inject the attribute wiring.
    vertexColors: true,
    transparent: false,
  });
}
