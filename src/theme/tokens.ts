/**
 * Design tokens, taken from the design canvas. Dark first; light follows the phone.
 * Colours that must be told apart (the macros) also differ in lightness, not hue alone.
 */
export const brand = {
  guava: '#FF5D73',
  guavaDeep: '#E8485F',
  lime: '#B8F25B',
  amber: '#FFC04D',
  periwinkle: '#7C9CFF',
  orchid: '#E58BFF',
  rooibos: '#B5523B',
  mint: '#2FD3A1',
  ink: '#0B0E17',
} as const;

export type Palette = {
  bg: string;
  surface: string;
  raised: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  subtle: string;
  track: string;
  tabBar: string;
  overlay: string;
  /** Fill for primary actions; text on it uses `onAccent`. */
  accent: string;
  onAccent: string;
  /** Accent used as text on `bg`/`surface` (meets 4.5:1). */
  accentText: string;
  good: string;
  goodText: string;
  warn: string;
  bad: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
};

export const dark: Palette = {
  bg: '#0B0E17',
  surface: '#151A27',
  raised: '#1D2333',
  line: '#2A3248',
  lineStrong: '#3A4460',
  text: '#F4F1EC',
  muted: '#9AA3B8',
  subtle: '#C9CFDC',
  track: '#232A3D',
  tabBar: '#0F1320',
  overlay: '#0B0E17AA',
  accent: brand.guava,
  onAccent: brand.ink,
  accentText: brand.guava,
  good: brand.lime,
  goodText: brand.lime,
  warn: brand.amber,
  bad: '#FF7A7A',
  protein: brand.periwinkle,
  carbs: brand.amber,
  fat: brand.orchid,
  water: brand.periwinkle,
};

export const light: Palette = {
  bg: '#F4F1EC',
  surface: '#FFFFFF',
  raised: '#FBF8F2',
  line: '#E2DCD0',
  lineStrong: '#CFC7B8',
  text: '#1D2333',
  muted: '#5B6275',
  subtle: '#3A4460',
  track: '#E9E3D6',
  tabBar: '#FFFFFF',
  overlay: '#1D233366',
  accent: brand.guava,
  onAccent: brand.ink,
  accentText: '#C2334A',
  good: '#7FB832',
  goodText: '#3E7A12',
  warn: '#C98A12',
  bad: '#C0392B',
  protein: '#4C6FE0',
  carbs: '#C98A12',
  fat: '#B455D6',
  water: '#4C6FE0',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const;

/** Minimum touch target, in points. */
export const TOUCH = 44;

export const fontFamily = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

export type Weight = keyof typeof fontFamily;

type TypeStyle = { size: number; weight: Weight; lineHeight?: number; tracking?: number; upper?: boolean };

/** Type scale. `tracking` is in em, like the canvas. */
export const typeScale = {
  display: { size: 38, weight: 800, lineHeight: 1.05, tracking: -0.03 },
  title: { size: 26, weight: 800, lineHeight: 1.15, tracking: -0.02 },
  h2: { size: 22, weight: 800, lineHeight: 1.2, tracking: -0.02 },
  h3: { size: 18, weight: 800, lineHeight: 1.25 },
  body: { size: 15, weight: 500, lineHeight: 1.45 },
  bodyStrong: { size: 15, weight: 700, lineHeight: 1.4 },
  small: { size: 13, weight: 500, lineHeight: 1.45 },
  label: { size: 13, weight: 700, lineHeight: 1.3 },
  caption: { size: 12, weight: 600, lineHeight: 1.35 },
  eyebrow: { size: 12, weight: 700, lineHeight: 1.3, tracking: 0.12, upper: true },
  number: { size: 34, weight: 800, lineHeight: 1.05, tracking: -0.03 },
  numberXL: { size: 52, weight: 800, lineHeight: 1, tracking: -0.03 },
} satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typeScale;
