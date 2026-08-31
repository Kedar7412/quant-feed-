/**
 * Ambient type declarations for `troika-three-text`.
 *
 * troika-three-text ships no bundled TypeScript types, so this local
 * declaration exposes the small surface the label layer uses: the `Text` mesh
 * subclass (an SDF-text `THREE.Mesh`) with its layout/appearance properties and
 * the async `sync()` / `dispose()` lifecycle methods. It stays intentionally
 * minimal - just what GraphLabels touches - mirroring the local
 * `d3-force-3d.d.ts` shim under the strict tsconfig used by the WebGL engine.
 */

declare module "troika-three-text" {
  import { Mesh, Material } from "three";

  export class Text extends Mesh {
    text: string;
    fontSize: number;
    font: string | null;
    color: number | string;
    anchorX: number | "left" | "center" | "right" | string;
    anchorY:
      | number
      | "top"
      | "top-baseline"
      | "middle"
      | "bottom-baseline"
      | "bottom"
      | string;
    maxWidth: number;
    lineHeight: number | "normal";
    letterSpacing: number;
    textAlign: "left" | "right" | "center" | "justify";
    outlineWidth: number | string;
    outlineColor: number | string;
    outlineBlur: number | string;
    material: Material & { depthTest: boolean; depthWrite: boolean };
    /** Rebuild the text geometry/texture after property changes. */
    sync(callback?: () => void): void;
    /** Release all GPU resources held by this Text instance. */
    dispose(): void;
  }

  export function preloadFont(
    options: { font?: string; characters?: string | string[] },
    callback: () => void
  ): void;
}
