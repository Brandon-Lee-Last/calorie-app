import { SCENE } from '../src/pango/art.generated';
import { buildLayers, countLeaves, parseTransform, type Layer } from '../src/pango/layers';
import { resolveLook } from '../src/pango/looks';
import type { ArtNode } from '../src/pango/types';
import { OUTFITS, POSES } from '../src/pango/types';

const anims = (layers: Layer[], out: string[] = []): string[] => {
  for (const l of layers) if (l.kind === 'anim') { out.push(l.anim); anims(l.children, out); }
  return out;
};
const find = (layers: Layer[], anim: string): Extract<Layer, { kind: 'anim' }> | undefined => {
  for (const l of layers) {
    if (l.kind !== 'anim') continue;
    if (l.anim === anim) return l;
    const inner = find(l.children, anim);
    if (inner) return inner;
  }
};
/** Leaves drawn when walking the art directly, for comparison with the layered version. */
const visibleLeaves = (nodes: ArtNode[], show: ReadonlySet<string>): number =>
  nodes.reduce((n, node) => {
    if (node.show && !show.has(node.show)) return n;
    return n + (node.t === 'g' ? visibleLeaves(node.c ?? [], show) : 1);
  }, 0);

describe('buildLayers', () => {
  it('draws every visible part exactly once, for every pose and outfit', () => {
    for (const pose of POSES) {
      for (const outfit of OUTFITS) {
        const { show } = resolveLook({ pose, outfit, pin: 'star', scarfPattern: 'stripes' });
        expect(countLeaves(buildLayers(show, pose))).toBe(visibleLeaves(SCENE, show));
      }
    }
  });

  it('gives standing poses breathing, blinking, a swaying tail and a fluttering scarf', () => {
    const list = anims(buildLayers(resolveLook({ pose: 'idle' }).show, 'idle'));
    for (const a of ['breathe', 'blink', 'tail', 'scarf-tails', 'lift', 'head-pose', 'dart']) expect(list).toContain(a);
    expect(list).not.toContain('figure');
  });

  it('only splits off parts that move in this pose', () => {
    expect(anims(buildLayers(resolveLook({ pose: 'eat' }).show, 'eat'))).not.toContain('head-pose');
    expect(anims(buildLayers(resolveLook({ pose: 'cheer' }).show, 'cheer'))).toEqual(expect.arrayContaining(['figure', 'shadow', 'spark']));
    expect(anims(buildLayers(resolveLook({ pose: 'roll' }).show, 'roll'))).toEqual(expect.arrayContaining(['ball-spin', 'ball-breathe']));
  });

  it('maps the blink origin through the head drawing scale', () => {
    const blink = find(buildLayers(resolveLook().show, 'idle'), 'blink');
    expect(blink?.origin?.[0]).toBeCloseTo(1.08 * 62 - 7.68, 5);
    expect(blink?.origin?.[1]).toBeCloseTo(1.08 * 80 - 8.48, 5);
  });

  it('turns sparkles about their own centres, staggered', () => {
    const layers = buildLayers(resolveLook({ pose: 'cheer' }).show, 'cheer');
    const sparks: Extract<Layer, { kind: 'anim' }>[] = [];
    const collect = (ls: Layer[]) => ls.forEach((l) => { if (l.kind === 'anim') { if (l.anim === 'spark') sparks.push(l); collect(l.children); } });
    collect(layers);
    expect(sparks.map((s) => s.delay)).toEqual([0, 1, 2, 3]);
    expect(sparks[0].origin).toEqual([28, 45.5]);
  });

  it('gives each Svg the definitions it refers to', () => {
    const layers = buildLayers(resolveLook({ scarfPattern: 'dots' }).show, 'idle');
    const ids = new Set<string>();
    const collect = (ls: Layer[]) => ls.forEach((l) => (l.kind === 'svg' ? l.defs.forEach((d) => ids.add(d.a.id)) : collect(l.children)));
    collect(layers);
    for (const id of ['sc', 'cl', 'body', 'crown', 'head', 'tailc', 'vol', 'volskin', 'dot', 'stripe']) expect(ids).toContain(id);
  });
});

describe('parseTransform', () => {
  it('reads the transforms the art uses', () => {
    expect(parseTransform('matrix(1.08 0 0 1.08 -7.68 -8.48)')).toEqual([1.08, 0, 0, 1.08, -7.68, -8.48]);
    expect(parseTransform('translate(10 20) scale(2)')).toEqual([2, 0, 0, 2, 10, 20]);
    const r = parseTransform('rotate(90 10 10)');
    expect(r[4]).toBeCloseTo(20);
    expect(r[5]).toBeCloseTo(0);
  });
});
