import {
  GLASSES,
  HATS,
  OUTFITS,
  PINS,
  POSES,
  SCALES,
  SCARF_PATTERNS,
  type Look,
  type Outfit,
  type Pose,
  type Scales,
} from './types';

/** Which parts of the art are drawn for each pose. Matches the canvas component. */
const POSE_PARTS: Record<Pose, { parts: string[]; says: string }> = {
  idle: { parts: ['nearIdle', 'farIdle', 'eyesOpen', 'mouthSmile'], says: 'standing by' },
  wave: { parts: ['nearWave', 'farIdle', 'eyesOpen', 'mouthOpen'], says: 'waving hello' },
  scan: { parts: ['nearScan', 'farScan', 'eyesWide', 'browFocus', 'mouthO', 'scanProps'], says: 'scanning a plate' },
  eat: { parts: ['farEat', 'eyesOpen', 'mouthChomp', 'fruit'], says: 'having a snack' },
  cheer: { parts: ['nearCheer', 'farCheer', 'eyesHappy', 'mouthOpen', 'sparks'], says: 'cheering' },
  think: { parts: ['nearThink', 'farIdle', 'eyesUp', 'browThink', 'mouthHmm', 'dots'], says: 'thinking it over' },
  oops: { parts: ['nearOops', 'farOops', 'eyesWorried', 'browWorried', 'mouthWavy', 'sweat'], says: 'a little worried' },
  sleep: { parts: ['ball', 'face'], says: 'curled up asleep' },
  roll: { parts: ['ball'], says: 'rolling while it loads' },
};

export const CLASSIC: Look = {
  hat: 'none',
  hatColour: '#7C9CFF',
  glasses: 'none',
  scarf: '#FF5D73',
  scarfPattern: 'plain',
  pin: 'none',
  scales: 'classic',
};

/** Ready-made looks. Anything set directly on Pango wins over the outfit. */
export const OUTFIT_LOOKS: Record<Outfit, Partial<Look>> = {
  none: {},
  gym: { hat: 'headband', hatColour: '#B8F25B', scarf: '#7C9CFF', pin: 'bolt' },
  chef: { hat: 'chef', scarf: '#FFC04D', scarfPattern: 'stripes', pin: 'leaf' },
  beach: { hat: 'bucket', hatColour: '#FFC04D', glasses: 'sunnies', scarf: '#7C9CFF', scarfPattern: 'dots' },
  winter: { hat: 'beanie', hatColour: '#FF5D73', scarf: '#7C9CFF', scarfPattern: 'stripes' },
  party: { hat: 'party', hatColour: '#E58BFF', glasses: 'stars', scarf: '#FFC04D', scarfPattern: 'dots', pin: 'star' },
  royal: { hat: 'crown', scarf: '#B5523B', pin: 'star', scales: 'honey' },
  protea: { hat: 'protea', scarf: '#FF5D73', pin: 'heart' },
  scholar: { glasses: 'round', scarf: '#E58BFF', scarfPattern: 'stripes', scales: 'slate' },
  weekend: { hat: 'cap', hatColour: '#FF5D73', glasses: 'sunnies', scarf: '#B8F25B' },
};

export const PALETTES: Record<Scales, { scale: string; edge: string; hi: string; lo: string; gap: string }> = {
  classic: { scale: '#C8915C', edge: '#7A4C2C', hi: '#F0C894', lo: '#A26C3F', gap: '#A0693A' },
  honey: { scale: '#E0A84E', edge: '#8A5A1E', hi: '#FFE09A', lo: '#B9802F', gap: '#B57A2C' },
  cocoa: { scale: '#8E5B3A', edge: '#4A2E1D', hi: '#C08A62', lo: '#6C4029', gap: '#6A4029' },
  rooibos: { scale: '#C2643F', edge: '#6E3020', hi: '#F0A07A', lo: '#9A4A2C', gap: '#93472B' },
  slate: { scale: '#8C97A8', edge: '#4A5262', hi: '#C9D2E0', lo: '#6E7888', gap: '#6A7486' },
  sage: { scale: '#8FAE7A', edge: '#4C6440', hi: '#CFE3B8', lo: '#6F8D5C', gap: '#6C8A58' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Mixes `hex` towards `to` by `t` (0..1). */
export function tint(hex: string, to: string, t: number): string {
  const channel = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return (
    '#' +
    [1, 3, 5]
      .map((i) => Math.round(channel(hex, i) + (channel(to, i) - channel(hex, i)) * t).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export type Tones = { main: string; dark: string; shade: string; light: string; ink: string };

/** The shades a fabric colour needs: folds, highlights and a pattern colour that shows on it. */
export function tones(value: string | undefined, fallback: string): Tones {
  const c = value && HEX.test(value) ? value.toUpperCase() : fallback;
  const lum =
    (0.299 * parseInt(c.slice(1, 3), 16) + 0.587 * parseInt(c.slice(3, 5), 16) + 0.114 * parseInt(c.slice(5, 7), 16)) /
    255;
  const ink = lum > 0.72 ? tint(c, '#000000', 0.28) : tint(c, '#FFFFFF', 0.72);
  if (c === '#FF5D73') return { main: c, dark: '#E8485F', shade: '#D63E57', light: '#FF8EA0', ink };
  return { main: c, dark: tint(c, '#000000', 0.12), shade: tint(c, '#000000', 0.22), light: tint(c, '#FFFFFF', 0.4), ink };
}

const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

export type PangoLookOptions = Partial<Look> & { pose?: Pose; outfit?: Outfit };

export type ResolvedLook = {
  pose: Pose;
  look: Look;
  ball: boolean;
  /** Parts of the art that are drawn. */
  show: ReadonlySet<string>;
  /** Fills for the `$...` slots in the art. */
  values: Readonly<Record<string, string>>;
  label: string;
};

const HAT_WORDS: Record<string, string> = {
  beanie: 'a beanie',
  bucket: 'a bucket hat',
  cap: 'a cap',
  chef: "a chef's hat",
  headband: 'a headband',
  party: 'a party hat',
  crown: 'a crown',
  protea: 'a protea',
};
const GLASSES_WORDS: Record<string, string> = { round: 'round glasses', sunnies: 'sunglasses', stars: 'star glasses' };
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function resolveLook(options: PangoLookOptions = {}): ResolvedLook {
  const pose = oneOf(options.pose, POSES, 'idle');
  const outfit = OUTFIT_LOOKS[oneOf(options.outfit, OUTFITS, 'none')];
  const pick = <K extends keyof Look>(key: K): Look[K] => options[key] ?? outfit[key] ?? CLASSIC[key];
  const look: Look = {
    hat: oneOf(pick('hat'), HATS, 'none'),
    hatColour: pick('hatColour'),
    glasses: oneOf(pick('glasses'), GLASSES, 'none'),
    scarf: pick('scarf'),
    scarfPattern: oneOf(pick('scarfPattern'), SCARF_PATTERNS, 'plain'),
    pin: oneOf(pick('pin'), PINS, 'none'),
    scales: oneOf(pick('scales'), SCALES, 'classic'),
  };
  const ball = pose === 'sleep' || pose === 'roll';

  const show = new Set<string>(POSE_PARTS[pose].parts);
  if (!ball) show.add('stand');
  if (look.hat !== 'none') show.add('hat' + upper(look.hat));
  if (look.glasses !== 'none') show.add('glasses' + upper(look.glasses));
  if (look.pin !== 'none') {
    show.add('pin');
    show.add('pin' + upper(look.pin));
  }
  if (look.scarfPattern !== 'plain') show.add('scarfPattern');

  const scarf = tones(look.scarf, CLASSIC.scarf);
  const hat = tones(look.hatColour, CLASSIC.hatColour);
  const skin = PALETTES[look.scales];
  const values: Record<string, string> = {
    pattern: look.scarfPattern === 'dots' ? 'url(#dot)' : 'url(#stripe)',
  };
  for (const [prefix, set] of [['scarf', scarf], ['hat', hat], ['skin', skin]] as const) {
    for (const [k, v] of Object.entries(set)) values[`${prefix}.${k}`] = v;
  }

  const worn = [HAT_WORDS[look.hat], GLASSES_WORDS[look.glasses]].filter(Boolean);
  const label =
    'Pango the pangolin, ' + POSE_PARTS[pose].says + (worn.length && !ball ? ', wearing ' + worn.join(' and ') : '');

  return { pose, look, ball, show, values, label };
}

export type Frame = {
  /** Drawing-space rectangle that is shown. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Points per drawing unit. */
  k: number;
  width: number;
  height: number;
  clip: boolean;
};

/**
 * Where to look in the 240 x 240 drawing. `face` frames the head (taller when a hat is on); balls always show whole.
 * `size` is the height in points.
 */
export function frameFor(crop: 'full' | 'face', size: number, hat: Look['hat'], ball: boolean): Frame {
  const s = Math.max(16, Math.min(800, size));
  if (crop === 'face' && !ball) {
    const [x, y, w, h] = hat !== 'none' ? [4, 2, 138, 126] : [8, 28, 128, 100];
    const k = s / h;
    return { x, y, w, h, k, width: Math.round(w * k), height: s, clip: true };
  }
  const k = s / 240;
  return { x: 0, y: 0, w: 240, h: 240, k, width: s, height: s, clip: false };
}
