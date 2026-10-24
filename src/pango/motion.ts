import { cubicBezier, type CSSAnimationKeyframes, type CSSAnimationTimingFunction } from 'react-native-reanimated';

import type { AnimKey, Pose } from './types';

/**
 * Pango's motion, ported from the design canvas (design/pango/pango.css). Each moving part is a layer turned or
 * shifted about an origin in the 240-unit drawing. `k` converts drawing units to points.
 */
export type Motion = {
  /** Origin in drawing units, or 'own' for parts that turn about their own centre. */
  origin?: [number, number] | 'own';
  /** A looping animation. */
  loop?: {
    keyframes: (k: number) => CSSAnimationKeyframes;
    duration: number;
    easing?: CSSAnimationTimingFunction;
    /** Seconds, by stagger index. */
    delays?: number[];
  };
  /** A held offset (applied even when motion is off). */
  hold?: (k: number) => TransformList;
};

type TransformList = ({ translateX: number } | { translateY: number } | { scale: number } | { scaleX: number } | { scaleY: number } | { rotate: string })[];

const pct = (frames: Record<number, Record<string, unknown>>): CSSAnimationKeyframes => {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [at, style] of Object.entries(frames)) out[`${at}%`] = style;
  return out as CSSAnimationKeyframes;
};
const rot = (deg: number) => ({ transform: [{ rotate: `${deg}deg` }] });
const sxy = (x: number, y: number) => ({ transform: [{ scaleX: x }, { scaleY: y }] });
const jump = cubicBezier(0.3, 0.7, 0.4, 1);
/** The head is drawn 1.08x larger than its source shapes, so small shifts inside it scale with it. */
const HEAD = 1.08;

const MOTIONS: Partial<Record<AnimKey, Motion>> = {
  breathe: {
    origin: [128, 214],
    loop: { duration: 3.6, keyframes: () => pct({ 0: sxy(1, 1), 50: sxy(1.012, 1.028), 100: sxy(1, 1) }) },
  },
  lift: {
    loop: {
      duration: 3.6,
      keyframes: (k) => pct({ 0: { transform: [{ translateY: 0 }] }, 50: { transform: [{ translateY: -3.4 * k }] }, 100: { transform: [{ translateY: 0 }] } }),
    },
  },
  blink: {
    origin: [62, 80],
    loop: {
      duration: 5.2,
      easing: 'linear',
      keyframes: () =>
        pct({ 0: sxy(1, 1), 90: sxy(1, 1), 92.5: sxy(1, 0.08), 96: sxy(1, 1), 100: sxy(1, 1) }),
    },
  },
  tail: { origin: [150, 198], loop: { duration: 4.4, keyframes: () => pct({ 0: rot(0), 50: rot(-4), 100: rot(0) }) } },
  'scarf-tails': {
    origin: [131, 116],
    loop: { duration: 1.9, keyframes: () => pct({ 0: rot(0), 50: rot(-8), 100: rot(0) }) },
  },
  wave: {
    origin: [106, 127],
    loop: {
      duration: 1.8,
      keyframes: () => pct({ 0: rot(0), 10: rot(-18), 22: rot(10), 34: rot(-18), 46: rot(10), 56: rot(-4), 62: rot(0), 100: rot(0) }),
    },
  },
  dart: {
    loop: {
      duration: 3.2,
      keyframes: (k) => {
        const at = (x: number, y: number) => ({ transform: [{ translateX: x * HEAD * k }, { translateY: y * HEAD * k }] });
        return pct({ 0: at(0, 0), 38: at(0, 0), 44: at(-1.8, 1.4), 68: at(-1.8, 1.4), 74: at(0.8, 1.8), 94: at(0.8, 1.8), 100: at(0, 0) });
      },
    },
  },
  beam: { loop: { duration: 1.8, keyframes: () => pct({ 0: { opacity: 0.55 }, 50: { opacity: 1 }, 100: { opacity: 0.55 } }) } },
  scanline: {
    loop: {
      duration: 1.8,
      keyframes: (k) => pct({ 0: { transform: [{ translateX: 0 }] }, 50: { transform: [{ translateX: 40 * k }] }, 100: { transform: [{ translateX: 0 }] } }),
    },
  },
  chomp: {
    origin: [47, 104],
    loop: {
      duration: 1.4,
      keyframes: () => pct({ 0: sxy(1, 1), 28: sxy(1, 1), 42: sxy(1, 0.2), 56: sxy(1, 1), 68: sxy(1, 0.3), 80: sxy(1, 1), 100: sxy(1, 1) }),
    },
  },
  tongue: {
    origin: [42, 106],
    loop: { duration: 4.2, keyframes: () => pct({ 0: sxy(0, 1), 72: sxy(0, 1), 79: sxy(1, 1), 86: sxy(0, 1), 100: sxy(0, 1) }) },
  },
  spark: {
    origin: 'own',
    loop: {
      duration: 1.5,
      delays: [0, 0.4, 0.8, 1.1],
      keyframes: () => {
        const f = (s: number, r: number, o: number) => ({ opacity: o, transform: [{ scale: s }, { rotate: `${r}deg` }] });
        return pct({ 0: f(0.3, 0, 0), 40: f(1.1, 25, 1), 70: f(0.85, 40, 0.85), 100: f(0.3, 0, 0) });
      },
    },
  },
  dot: {
    origin: 'own',
    loop: {
      duration: 2.6,
      delays: [0, 0.3, 0.6],
      keyframes: (k) => {
        const f = (o: number, y: number, s: number) => ({ opacity: o, transform: [{ translateY: y * k }, { scale: s }] });
        return pct({ 0: f(0, 4, 0.6), 8: f(0, 4, 0.6), 28: f(1, 0, 1), 74: f(1, 0, 1), 100: f(0, -4, 0.9) });
      },
    },
  },
  sweat: {
    loop: {
      duration: 3,
      easing: 'ease-in',
      keyframes: (k) => {
        const f = (y: number, o: number) => ({ opacity: o, transform: [{ translateY: y * k }] });
        return pct({ 0: f(-4, 0), 12: f(-4, 0), 28: f(0, 1), 84: f(9, 1), 100: f(13, 0) });
      },
    },
  },
  z: {
    origin: 'own',
    loop: {
      duration: 3.6,
      delays: [0, 1.2, 2.4],
      keyframes: (k) => {
        const f = (o: number, t: number) => ({
          opacity: o,
          transform: [{ translateX: 9 * t * k }, { translateY: (6 - 22 * t) * k }, { scale: 0.7 + 0.4 * t }],
        });
        return pct({ 0: f(0, 0), 22: f(1, 0.22), 78: f(0.9, 0.78), 100: f(0, 1) });
      },
    },
  },
};

/** Parts that only move in some poses. */
function posed(anim: AnimKey, pose: Pose): Motion | null {
  switch (anim) {
    case 'head-pose':
      if (pose === 'idle')
        return { origin: [96, 106], loop: { duration: 8, keyframes: () => pct({ 0: rot(0), 55: rot(0), 62: rot(-5), 80: rot(-5), 88: rot(0), 100: rot(0) }) } };
      if (pose === 'wave') return { origin: [96, 106], loop: { duration: 1.8, keyframes: () => pct({ 0: rot(-2), 50: rot(-5), 100: rot(-2) }) } };
      if (pose === 'think') return { origin: [96, 106], loop: { duration: 3.4, keyframes: () => pct({ 0: rot(2), 50: rot(4.5), 100: rot(2) }) } };
      if (pose === 'scan') return { origin: [96, 106], hold: () => [{ rotate: '-4deg' }] };
      return null;
    case 'food':
      return pose === 'eat'
        ? { origin: [106, 128], loop: { duration: 1.4, keyframes: () => pct({ 0: rot(0), 40: rot(-7), 100: rot(0) }) } }
        : null;
    case 'figure':
      if (pose === 'cheer')
        return {
          origin: [128, 222],
          loop: {
            duration: 1.2,
            easing: jump,
            keyframes: (k) => {
              const f = (y: number, sx: number, sy: number) => ({ transform: [{ translateY: y * k }, { scaleX: sx }, { scaleY: sy }] });
              return pct({ 0: f(0, 1, 1), 12: f(0, 1.06, 0.92), 40: f(-18, 0.97, 1.04), 62: f(0, 1.05, 0.93), 74: f(0, 0.99, 1.01), 100: f(0, 1, 1) });
            },
          },
        };
      if (pose === 'oops')
        return {
          origin: [128, 222],
          loop: {
            duration: 3,
            keyframes: (k) => {
              const f = (x: number, r: number) => ({ transform: [{ translateX: x * k }, { rotate: `${r}deg` }] });
              return pct({ 0: f(0, 0), 58: f(0, 0), 62: f(-1.6, -1), 66: f(1.6, 1), 70: f(-1.2, -0.6), 74: f(1, 0.4), 78: f(0, 0), 100: f(0, 0) });
            },
          },
        };
      return null;
    case 'shadow':
      if (pose === 'cheer')
        return {
          origin: [124, 224],
          loop: {
            duration: 1.2,
            easing: jump,
            // The ellipse is already drawn at 35% opacity; the layer's opacity multiplies it.
            keyframes: () => {
              const f = (s: number, o: number) => ({ opacity: o, transform: [{ scale: s }] });
              return pct({ 0: f(1, 1), 12: f(1, 1), 40: f(0.7, 0.46), 62: f(1, 1), 100: f(1, 1) });
            },
          },
        };
      if (pose === 'roll')
        return { origin: [124, 224], loop: { duration: 0.65, keyframes: () => pct({ 0: { transform: [{ scale: 1 }] }, 50: { transform: [{ scale: 0.88 }] }, 100: { transform: [{ scale: 1 }] } }) } };
      return null;
    case 'ball-breathe':
      if (pose === 'sleep') return { origin: [124, 220], loop: { duration: 4.4, keyframes: () => pct({ 0: sxy(1, 1), 50: sxy(1.02, 1.035), 100: sxy(1, 1) }) } };
      if (pose === 'roll')
        return {
          loop: {
            duration: 0.65,
            keyframes: (k) => pct({ 0: { transform: [{ translateY: 0 }] }, 50: { transform: [{ translateY: -4 * k }] }, 100: { transform: [{ translateY: 0 }] } }),
          },
        };
      return null;
    case 'ball-spin':
      return pose === 'roll'
        ? { origin: [124, 160], loop: { duration: 1.3, easing: 'linear', keyframes: () => pct({ 0: rot(0), 100: rot(360) }) } }
        : null;
    default:
      return MOTIONS[anim] ?? null;
  }
}

/** How a part moves in a pose, or null when it stays still (and needs no layer of its own). */
export function motionFor(anim: AnimKey, pose: Pose): Motion | null {
  return posed(anim, pose);
}

const cache = new Map<string, CSSAnimationKeyframes>();

/** Keyframes are cached so a re-render keeps the same object and does not restart the loop. */
export function keyframesFor(anim: AnimKey, pose: Pose, motion: Motion, k: number): CSSAnimationKeyframes | null {
  if (!motion.loop) return null;
  const key = `${anim}:${pose}:${k.toFixed(4)}`;
  let frames = cache.get(key);
  if (!frames) {
    frames = motion.loop.keyframes(k);
    cache.set(key, frames);
  }
  return frames;
}
