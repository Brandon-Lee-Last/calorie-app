import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';

/** A surface panel. `raised` sits one step brighter, for the card that matters most on a screen. */
export function Card({ children, raised, padding = spacing.lg, style }: { children: ReactNode; raised?: boolean; padding?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: raised ? colors.raised : colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.xl, padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}
