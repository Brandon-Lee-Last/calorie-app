import { View } from 'react-native';

import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';
import { Text } from './Text';

/** A recipe's method: one step a row, its number in a small accent circle, in body text that is easy to follow. */
export function Steps({ steps }: { steps: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {steps.map((s, n) => (
        <View key={n} style={{ flexDirection: 'row', gap: spacing.md }}>
          <View accessibilityLabel={`Step ${n + 1}`} style={{ width: 26, height: 26, borderRadius: 13, marginTop: 1, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="label" style={{ color: colors.onAccent }}>
              {n + 1}
            </Text>
          </View>
          <Text variant="body" style={{ flex: 1 }}>
            {s}
          </Text>
        </View>
      ))}
    </View>
  );
}
