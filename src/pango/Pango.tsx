import { memo, useId, useMemo, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationProperties } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Pattern, RadialGradient, Rect, Stop, Use } from 'react-native-svg';

import { buildLayers, type Layer, type Tree } from './layers';
import { frameFor, resolveLook, type PangoLookOptions } from './looks';
import { keyframesFor } from './motion';
import type { ArtNode } from './types';

export type PangoProps = PangoLookOptions & {
  /** Height in points. */
  size?: number;
  /** `face` frames the head for avatars and icons. */
  crop?: 'full' | 'face';
  /** Set false to hold still. Pango also holds still when the phone asks for reduced motion. */
  motion?: boolean;
  style?: StyleProp<ViewStyle>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TAGS: Record<string, ComponentType<any>> = {
  g: G,
  path: Path,
  circle: Circle,
  ellipse: Ellipse,
  rect: Rect,
  use: Use,
  clipPath: ClipPath,
  radialGradient: RadialGradient,
  stop: Stop,
  pattern: Pattern,
};

type Ctx = { k: number; size: number; values: Readonly<Record<string, string>>; uid: string; animate: boolean; pose: PangoLookOptions['pose'] };

function props(node: ArtNode, ctx: Ctx): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(node.a)) {
    let value = raw.startsWith('$') ? (ctx.values[raw.slice(1)] ?? raw) : raw;
    if (name === 'id' || name === 'href') value += ctx.uid;
    else if (value.includes('url(#')) value = value.replace(/url\(#([\w-]+)\)/g, `url(#$1${ctx.uid})`);
    out[name] = value;
  }
  return out;
}

function renderArt(node: ArtNode, ctx: Ctx, key: number | string, children?: ReactNode): ReactNode {
  const Tag = TAGS[node.t];
  if (!Tag) throw new Error(`Pango: no renderer for <${node.t}>`);
  return (
    <Tag key={key} {...props(node, ctx)}>
      {children ?? node.c?.map((child, i) => renderArt(child, ctx, i))}
    </Tag>
  );
}

const renderTree = (tree: Tree, ctx: Ctx, key: number): ReactNode =>
  tree.children.length || tree.node.t === 'g'
    ? renderArt(tree.node, ctx, key, tree.children.map((child, i) => renderTree(child, ctx, i)))
    : renderArt(tree.node, ctx, key);

function layerStyle(layer: Extract<Layer, { kind: 'anim' }>, ctx: Ctx): ViewStyle {
  const { motion, origin } = layer;
  const style: Record<string, unknown> & Partial<Record<keyof CSSAnimationProperties, unknown>> = {};
  if (origin) style.transformOrigin = [origin[0] * ctx.k, origin[1] * ctx.k, 0];
  if (motion.hold) style.transform = motion.hold(ctx.k);
  if (ctx.animate && motion.loop) {
    const frames = keyframesFor(layer.anim, ctx.pose ?? 'idle', motion, ctx.k);
    if (frames) {
      style.animationName = frames;
      style.animationDuration = `${motion.loop.duration}s`;
      style.animationIterationCount = 'infinite';
      style.animationTimingFunction = motion.loop.easing ?? 'ease-in-out';
      const delay = motion.loop.delays?.[layer.delay] ?? 0;
      if (delay) style.animationDelay = `${delay}s`;
    }
  }
  // Reanimated reads the CSS animation keys from the style of an Animated component.
  return style as ViewStyle;
}

function renderLayer(layer: Layer, ctx: Ctx, key: number): ReactNode {
  if (layer.kind === 'svg') {
    return (
      <Svg key={key} width={ctx.size} height={ctx.size} viewBox="0 0 240 240" style={StyleSheet.absoluteFill}>
        {layer.defs.length > 0 && <Defs>{layer.defs.map((d, i) => renderArt(d, ctx, i))}</Defs>}
        {layer.roots.map((tree, i) => renderTree(tree, ctx, i))}
      </Svg>
    );
  }
  return (
    <Animated.View key={key} pointerEvents="none" style={[StyleSheet.absoluteFill, layerStyle(layer, ctx)]}>
      {layer.children.map((child, i) => renderLayer(child, ctx, i))}
    </Animated.View>
  );
}

/**
 * Pango the pangolin. Every pose, outfit and accessory from the design canvas, drawn with react-native-svg and
 * animated with Reanimated CSS keyframes.
 */
function PangoView({ size = 240, crop = 'full', motion = true, style, ...options }: PangoProps) {
  const reduced = useReducedMotion();
  const uid = '-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const resolved = useMemo(
    () => resolveLook(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.pose, options.outfit, options.hat, options.hatColour, options.glasses, options.scarf, options.scarfPattern, options.pin, options.scales],
  );
  const showKey = [...resolved.show].sort().join(',');
  const layers = useMemo(() => buildLayers(resolved.show, resolved.pose), [showKey, resolved.pose]); // eslint-disable-line react-hooks/exhaustive-deps
  const frame = frameFor(crop, size, resolved.look.hat, resolved.ball);
  const ctx: Ctx = {
    k: frame.k,
    size: 240 * frame.k,
    values: resolved.values,
    uid,
    animate: motion && !reduced,
    pose: resolved.pose,
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={resolved.label}
      style={[{ width: frame.width, height: frame.height, overflow: frame.clip ? 'hidden' : 'visible' }, style]}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -frame.x * frame.k, top: -frame.y * frame.k, width: ctx.size, height: ctx.size }}
      >
        {layers.map((layer, i) => renderLayer(layer, ctx, i))}
      </View>
    </View>
  );
}

export const Pango = memo(PangoView);
