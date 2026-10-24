import { DEFS, SCENE } from './art.generated';
import { motionFor, type Motion } from './motion';
import type { AnimKey, ArtNode, Pose } from './types';

/**
 * Pango is drawn as a stack of layers. Native views animate reliably while SVG groups do not, so every moving part
 * (tail, head, eyes, arms...) gets its own animated view holding its own Svg, and runs of still parts between them
 * share one Svg. Paint order is the art's document order, so the stack looks exactly like the single SVG on the canvas.
 */

/** A static group (kept as a <G> wrapper) or a drawable leaf, with what it contains. */
export type Tree = { node: ArtNode; children: Tree[] };
export type SvgLayer = { kind: 'svg'; roots: Tree[]; defs: ArtNode[] };
export type AnimLayer = {
  kind: 'anim';
  anim: AnimKey;
  motion: Motion;
  /** Origin in drawing units (already mapped through any static transform above the part). */
  origin: [number, number] | null;
  delay: number;
  children: Layer[];
};
export type Layer = SvgLayer | AnimLayer;

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Parses an SVG transform list (matrix, translate, scale, rotate). */
export function parseTransform(value: string | undefined): Matrix {
  let m = IDENTITY;
  if (!value) return m;
  for (const [, fn, args] of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
    let step: Matrix = IDENTITY;
    if (fn === 'matrix') step = [n[0], n[1], n[2], n[3], n[4], n[5]];
    else if (fn === 'translate') step = [1, 0, 0, 1, n[0], n[1] ?? 0];
    else if (fn === 'scale') step = [n[0], 0, 0, n[1] ?? n[0], 0, 0];
    else if (fn === 'rotate') {
      const a = (n[0] * Math.PI) / 180;
      const [cx, cy] = [n[1] ?? 0, n[2] ?? 0];
      const r: Matrix = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
      step = multiply(multiply([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
    } else throw new Error(`Unsupported transform ${fn}`);
    m = multiply(m, step);
  }
  return m;
}

const applyTo = (m: Matrix, [x, y]: [number, number]): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

function addLeaf(leaf: ArtNode, chain: ArtNode[], out: Layer[]) {
  let layer = out[out.length - 1];
  if (!layer || layer.kind !== 'svg') {
    layer = { kind: 'svg', roots: [], defs: [] };
    out.push(layer);
  }
  let level = layer.roots;
  for (const group of chain) {
    const last = level[level.length - 1];
    if (last && last.node === group) level = last.children;
    else {
      const wrapper: Tree = { node: group, children: [] };
      level.push(wrapper);
      level = wrapper.children;
    }
  }
  level.push({ node: leaf, children: [] });
}

/** Builds the layer stack for one pose and set of visible parts. */
export function buildLayers(show: ReadonlySet<string>, pose: Pose): Layer[] {
  const top: Layer[] = [];
  const walk = (node: ArtNode, chain: ArtNode[], m: Matrix, out: Layer[]) => {
    if (node.show && !show.has(node.show)) return;
    const motion = node.anim ? motionFor(node.anim, pose) : null;
    if (node.anim && motion) {
      const own: ArtNode = { t: node.t, a: node.a };
      const origin =
        motion.origin === 'own' ? applyTo(m, node.o ?? [120, 120]) : motion.origin ? applyTo(m, motion.origin) : null;
      const layer: AnimLayer = { kind: 'anim', anim: node.anim, motion, origin, delay: node.delay ?? 0, children: [] };
      out.push(layer);
      if (node.t === 'g') {
        const inner = Object.keys(own.a).length ? [...chain, own] : chain;
        for (const child of node.c ?? []) walk(child, inner, multiply(m, parseTransform(own.a.transform)), layer.children);
      } else addLeaf(own, chain, layer.children);
      return;
    }
    if (node.t === 'g') {
      for (const child of node.c ?? []) walk(child, [...chain, node], multiply(m, parseTransform(node.a.transform)), out);
    } else addLeaf(node, chain, out);
  };
  for (const node of SCENE) walk(node, [], IDENTITY, top);
  attachDefs(top);
  return top;
}

function referencedIds(trees: Tree[], ids = new Set<string>()): Set<string> {
  for (const { node, children } of trees) {
    for (const value of Object.values(node.a)) {
      if (value === '$pattern') {
        ids.add('stripe');
        ids.add('dot');
      }
      if (value.startsWith('#')) ids.add(value.slice(1));
      for (const [, id] of value.matchAll(/url\(#([\w-]+)\)/g)) ids.add(id);
    }
    referencedIds(children, ids);
  }
  return ids;
}

/** Each Svg gets only the definitions its own drawing refers to. */
function attachDefs(layers: Layer[]) {
  for (const layer of layers) {
    if (layer.kind === 'anim') attachDefs(layer.children);
    else {
      const ids = referencedIds(layer.roots);
      layer.defs = DEFS.filter((d) => ids.has(d.a.id));
    }
  }
}

/** Counts drawable leaves, for tests and diagnostics. */
export function countLeaves(layers: Layer[]): number {
  const inTree = (trees: Tree[]): number =>
    trees.reduce((n, t) => n + (t.node.t === 'g' && t.children.length ? inTree(t.children) : t.node.t === 'g' ? 0 : 1), 0);
  return layers.reduce((n, l) => n + (l.kind === 'svg' ? inTree(l.roots) : countLeaves(l.children)), 0);
}
