/**
 * Ambient type declarations for `d3-force-3d`.
 *
 * `d3-force-3d` mirrors the `d3-force` API but runs the simulation in up to
 * three dimensions (adding a z-axis to nodes and a `forceZ` force). No
 * `@types/d3-force-3d` package is published, so this local declaration keeps
 * the module usable under the strict tsconfig used by the WebGL engine.
 *
 * The shapes intentionally stay close to `@types/d3-force`, extended with the
 * optional `z`/`vz`/`fz` node coordinates and the `numDimensions`/`z` helpers
 * that the 3D fork adds.
 */
declare module "d3-force-3d" {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
    source: NodeDatum | string | number;
    target: NodeDatum | string | number;
    index?: number;
  }

  export interface Force<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> | undefined
  > {
    (alpha: number): void;
    initialize?(nodes: NodeDatum[], random: () => number): void;
  }

  export interface Simulation<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> | undefined
  > {
    restart(): this;
    stop(): this;
    tick(iterations?: number): this;
    nodes(): NodeDatum[];
    nodes(nodes: NodeDatum[]): this;
    numDimensions(): number;
    numDimensions(dimensions: number): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaMin(): number;
    alphaMin(min: number): this;
    alphaDecay(): number;
    alphaDecay(decay: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
    velocityDecay(): number;
    velocityDecay(decay: number): this;
    force(name: string): Force<NodeDatum, LinkDatum> | undefined;
    force(name: string, force: Force<NodeDatum, LinkDatum> | null): this;
    find(x: number, y: number, z?: number, radius?: number): NodeDatum | undefined;
    randomSource(): () => number;
    randomSource(source: () => number): this;
    on(typenames: string): ((this: this) => void) | undefined;
    on(typenames: string, listener: ((this: this) => void) | null): this;
  }

  export function forceSimulation<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> | undefined = undefined
  >(nodes?: NodeDatum[], numDimensions?: number): Simulation<NodeDatum, LinkDatum>;

  export interface ForceCenter<NodeDatum extends SimulationNodeDatum>
    extends Force<NodeDatum, undefined> {
    x(): number;
    x(x: number): this;
    y(): number;
    y(y: number): this;
    z(): number;
    z(z: number): this;
    strength(): number;
    strength(strength: number): this;
  }
  export function forceCenter<NodeDatum extends SimulationNodeDatum>(
    x?: number,
    y?: number,
    z?: number
  ): ForceCenter<NodeDatum>;

  export interface ForceCollide<NodeDatum extends SimulationNodeDatum>
    extends Force<NodeDatum, undefined> {
    radius(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    radius(radius: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    strength(): number;
    strength(strength: number): this;
    iterations(): number;
    iterations(iterations: number): this;
  }
  export function forceCollide<NodeDatum extends SimulationNodeDatum>(
    radius?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)
  ): ForceCollide<NodeDatum>;

  export interface ForceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>
  > extends Force<NodeDatum, LinkDatum> {
    links(): LinkDatum[];
    links(links: LinkDatum[]): this;
    id(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => string | number;
    id(id: (node: NodeDatum, i: number, nodes: NodeDatum[]) => string | number): this;
    distance(): (link: LinkDatum, i: number, links: LinkDatum[]) => number;
    distance(distance: number | ((link: LinkDatum, i: number, links: LinkDatum[]) => number)): this;
    strength(): (link: LinkDatum, i: number, links: LinkDatum[]) => number;
    strength(strength: number | ((link: LinkDatum, i: number, links: LinkDatum[]) => number)): this;
    iterations(): number;
    iterations(iterations: number): this;
  }
  export function forceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>
  >(links?: LinkDatum[]): ForceLink<NodeDatum, LinkDatum>;

  export interface ForceManyBody<NodeDatum extends SimulationNodeDatum>
    extends Force<NodeDatum, undefined> {
    strength(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    strength(strength: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    theta(): number;
    theta(theta: number): this;
    distanceMin(): number;
    distanceMin(distance: number): this;
    distanceMax(): number;
    distanceMax(distance: number): this;
  }
  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>;

  export interface ForceRadial<NodeDatum extends SimulationNodeDatum>
    extends Force<NodeDatum, undefined> {
    strength(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    strength(strength: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    radius(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    radius(radius: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    x(x: number): this;
    y(y: number): this;
    z(z: number): this;
  }
  export function forceRadial<NodeDatum extends SimulationNodeDatum>(
    radius: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number),
    x?: number,
    y?: number,
    z?: number
  ): ForceRadial<NodeDatum>;

  export interface ForcePositioning<NodeDatum extends SimulationNodeDatum>
    extends Force<NodeDatum, undefined> {
    strength(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    strength(strength: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    x?(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    x?(x: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    y?(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    y?(y: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
    z?(): (node: NodeDatum, i: number, nodes: NodeDatum[]) => number;
    z?(z: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): this;
  }
  export function forceX<NodeDatum extends SimulationNodeDatum>(
    x?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)
  ): ForcePositioning<NodeDatum>;
  export function forceY<NodeDatum extends SimulationNodeDatum>(
    y?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)
  ): ForcePositioning<NodeDatum>;
  export function forceZ<NodeDatum extends SimulationNodeDatum>(
    z?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)
  ): ForcePositioning<NodeDatum>;
}
