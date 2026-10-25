import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';

import { useTheme } from '../theme/theme';

export type Point = { x: number; y: number };

/** Where each point sits in a box, with room for the end marker. Exported for tests. */
export function layout(points: Point[], width: number, height: number, pad = 10): [number, number][] {
  if (!points.length) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const lo = Math.min(...ys) - 0.4;
  const hi = Math.max(...ys) + 0.4;
  return points.map((p) => [
    pad + (x1 === x0 ? (width - 2 * pad) / 2 : ((p.x - x0) / (x1 - x0)) * (width - 2 * pad)),
    pad + ((hi - p.y) / (hi - lo)) * (height - 2 * pad),
  ]);
}

/** A trend line with a soft fill and a ring on the latest point. `label` is what screen readers hear. */
export function LineChart({ points, height = 130, label, color }: { points: Point[]; height?: number; label: string; color?: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? colors.accent;
  const xy = width ? layout(points, width, height) : [];
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={height * 0.34} y2={height * 0.34} stroke={colors.line} strokeDasharray="4 5" />
          <Line x1={0} x2={width} y1={height * 0.66} y2={height * 0.66} stroke={colors.line} strokeDasharray="4 5" />
          {xy.length > 1 ? (
            <>
              <Polygon points={`${xy[0][0]},${height} ${line} ${last[0]},${height}`} fill={stroke} fillOpacity={0.14} />
              <Polyline points={line} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : null}
          {last ? <Circle cx={last[0]} cy={last[1]} r={7} fill={colors.surface} stroke={stroke} strokeWidth={3} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}
