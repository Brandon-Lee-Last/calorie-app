/** One element of Pango's art, in a 240 x 240 drawing space. Produced by scripts/pango-sync.mjs. */
export type ArtNode = {
  /** SVG tag: g, path, circle, ellipse, rect, use, clipPath, radialGradient, stop, pattern. */
  t: string;
  /** Attributes, camelCased for react-native-svg. Values starting with `$` are filled in at render time. */
  a: Record<string, string>;
  c?: ArtNode[];
  /** Drawn only when this part is switched on (see looks.ts). */
  show?: string;
  /** This part moves (see motion.ts). */
  anim?: AnimKey;
  /** Stagger index for repeated parts (sparkles, thought dots, z's). */
  delay?: number;
  /** Centre of the part's own drawing, for parts that turn about themselves. */
  o?: [number, number];
};

export type AnimKey =
  | 'breathe'
  | 'lift'
  | 'blink'
  | 'tail'
  | 'scarf-tails'
  | 'head-pose'
  | 'wave'
  | 'dart'
  | 'beam'
  | 'scanline'
  | 'food'
  | 'chomp'
  | 'tongue'
  | 'figure'
  | 'shadow'
  | 'spark'
  | 'dot'
  | 'sweat'
  | 'ball-breathe'
  | 'z'
  | 'ball-spin';

export const POSES = ['idle', 'wave', 'scan', 'eat', 'cheer', 'think', 'oops', 'sleep', 'roll'] as const;
export type Pose = (typeof POSES)[number];

export const HATS = ['none', 'beanie', 'bucket', 'cap', 'chef', 'headband', 'party', 'crown', 'protea'] as const;
export type Hat = (typeof HATS)[number];

export const GLASSES = ['none', 'round', 'sunnies', 'stars'] as const;
export type Glasses = (typeof GLASSES)[number];

export const PINS = ['none', 'star', 'heart', 'bolt', 'leaf'] as const;
export type Pin = (typeof PINS)[number];

export const SCARF_PATTERNS = ['plain', 'stripes', 'dots'] as const;
export type ScarfPattern = (typeof SCARF_PATTERNS)[number];

export const SCALES = ['classic', 'honey', 'cocoa', 'rooibos', 'slate', 'sage'] as const;
export type Scales = (typeof SCALES)[number];

export const OUTFITS = ['none', 'gym', 'chef', 'beach', 'winter', 'party', 'royal', 'protea', 'scholar', 'weekend'] as const;
export type Outfit = (typeof OUTFITS)[number];

/** Everything Pango can wear. Any field left out comes from the outfit, then from the classic look. */
export type Look = {
  hat: Hat;
  hatColour: string;
  glasses: Glasses;
  scarf: string;
  scarfPattern: ScarfPattern;
  pin: Pin;
  scales: Scales;
};
