import { View } from 'react-native';

import { useTheme } from '../theme/theme';

/** A thin bar showing `value` (0..1) of a total. */
export function ProgressBar({ value, color, height = 8, label }: { value: number; color?: string; height?: number; label?: string }) {
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.track, overflow: 'hidden' }}
    >
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? colors.accent }} />
    </View>
  );
}
