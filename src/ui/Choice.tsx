import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';

/** A large radio option: title, a hint below it and a dot that fills when chosen. Group them in a radiogroup. */
export function Choice({ title, hint, selected, onPress }: { title: string; hint?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 64,
        paddingVertical: spacing.md,
        paddingHorizontal: 18,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.line,
        backgroundColor: selected ? colors.raised : colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h3" style={{ fontSize: 17 }}>
          {title}
        </Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.accent : colors.lineStrong, backgroundColor: selected ? colors.accent : 'transparent' }} />
    </Pressable>
  );
}
