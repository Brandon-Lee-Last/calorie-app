import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/theme';

/** Stroke icons from the design canvas, on a 24-unit grid. */
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5 9-10',
  scan: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M15.2 12a3.2 3.2 0 1 1-6.4 0a3.2 3.2 0 1 1 6.4 0',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  train: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  progress: 'M4 19V9M10 19V5M16 19v-7M21 19H3',
  me: 'M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0M4 21a8 8 0 0 1 16 0',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  drop: 'M12 2.5c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  mic: 'M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3',
  image: 'M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM21 16l-5-5-9 9M11 10a2 2 0 1 1-4 0a2 2 0 1 1 4 0',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  calendar: 'M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM3 10h18M8 3v4M16 3v4',
  lock: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  play: 'M8 5v14l11-7z',
  sun: 'M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  search: 'M18 11a7 7 0 1 1-14 0a7 7 0 1 1 14 0M20 20l-4-4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  sparkle: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
  barcode: 'M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  meal: 'M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 21V3c-2 1-3 4-3 7 0 2 1 3 3 3',
  clock: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 7v5l3 2',
  chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 11h.01M12 11h.01M16 11h.01',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
} as const;

const FILLED = new Set<IconName>(['drop', 'play']);

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color, strokeWidth = 2.2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  const filled = FILLED.has(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        d={PATHS[name]}
        fill={filled ? c : 'none'}
        stroke={filled ? 'none' : c}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
