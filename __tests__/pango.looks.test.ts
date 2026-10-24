import { CLASSIC, OUTFIT_LOOKS, frameFor, resolveLook, tint, tones } from '../src/pango/looks';
import { OUTFITS, POSES } from '../src/pango/types';

describe('resolveLook', () => {
  it('defaults to the classic standing Pango', () => {
    const r = resolveLook();
    expect(r.pose).toBe('idle');
    expect(r.look).toEqual(CLASSIC);
    expect([...r.show].sort()).toEqual(['eyesOpen', 'farIdle', 'mouthSmile', 'nearIdle', 'stand']);
    expect(r.label).toBe('Pango the pangolin, standing by');
  });

  it('curls into a ball for sleep and roll, with a face only when asleep', () => {
    expect(resolveLook({ pose: 'sleep' }).show).toEqual(new Set(['ball', 'face']));
    expect(resolveLook({ pose: 'roll' }).show).toEqual(new Set(['ball']));
    expect(resolveLook({ pose: 'roll' }).ball).toBe(true);
  });

  it('lets set fields win over the outfit, and the outfit win over classic', () => {
    const r = resolveLook({ outfit: 'gym', scarf: '#FFC04D' });
    expect(r.look.hat).toBe('headband');
    expect(r.look.scarf).toBe('#FFC04D');
    expect(r.look.scales).toBe('classic');
    expect(r.show.has('hatHeadband')).toBe(true);
    expect(r.show.has('pinBolt')).toBe(true);
  });

  it('ignores values it does not know', () => {
    // @ts-expect-error testing a bad value from outside
    const r = resolveLook({ pose: 'dance', hat: 'tophat', outfit: 'disco' });
    expect(r.pose).toBe('idle');
    expect(r.look.hat).toBe('none');
  });

  it('fills every colour slot the art uses', () => {
    const { values } = resolveLook({ scarfPattern: 'dots', scales: 'sage' });
    for (const key of ['scarf.main', 'scarf.dark', 'scarf.shade', 'scarf.light', 'scarf.ink', 'hat.main', 'hat.dark', 'hat.light', 'skin.scale', 'skin.edge', 'skin.hi', 'skin.lo', 'skin.gap']) {
      expect(values[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(values.pattern).toBe('url(#dot)');
    expect(values['skin.scale']).toBe('#8FAE7A');
  });

  it('describes what Pango wears', () => {
    expect(resolveLook({ pose: 'wave', outfit: 'beach' }).label).toBe(
      'Pango the pangolin, waving hello, wearing a bucket hat and sunglasses',
    );
    expect(resolveLook({ pose: 'sleep', outfit: 'beach' }).label).toBe('Pango the pangolin, curled up asleep');
  });

  it('knows every pose and outfit', () => {
    for (const pose of POSES) expect(() => resolveLook({ pose })).not.toThrow();
    for (const outfit of OUTFITS) expect(OUTFIT_LOOKS[outfit]).toBeDefined();
  });
});

describe('colours', () => {
  it('mixes towards a colour', () => {
    expect(tint('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(tint('#FF5D73', '#FF5D73', 0.3)).toBe('#FF5D73');
  });

  it('keeps the hand-picked guava shades and derives others', () => {
    expect(tones('#FF5D73', '#000000').dark).toBe('#E8485F');
    expect(tones('#7C9CFF', '#000000').main).toBe('#7C9CFF');
    expect(tones('not a colour', '#FF5D73').main).toBe('#FF5D73');
  });

  it('picks a pattern colour that shows: dark on light fabric, light on dark', () => {
    const lime = tones('#B8F25B', '#000000');
    const ink = tones('#3A4460', '#000000');
    expect(parseInt(lime.ink.slice(1, 3), 16)).toBeLessThan(parseInt(lime.main.slice(1, 3), 16));
    expect(parseInt(ink.ink.slice(1, 3), 16)).toBeGreaterThan(parseInt(ink.main.slice(1, 3), 16));
  });
});

describe('frameFor', () => {
  it('shows the whole drawing for full', () => {
    expect(frameFor('full', 120, 'none', false)).toMatchObject({ x: 0, y: 0, w: 240, h: 240, width: 120, height: 120, k: 0.5, clip: false });
  });

  it('frames the head for face, taller with a hat', () => {
    expect(frameFor('face', 100, 'none', false)).toMatchObject({ x: 8, y: 28, width: 128, height: 100, clip: true });
    expect(frameFor('face', 126, 'beanie', false)).toMatchObject({ y: 2, width: 138, height: 126 });
  });

  it('never crops a ball', () => {
    expect(frameFor('face', 100, 'none', true).clip).toBe(false);
  });
});
