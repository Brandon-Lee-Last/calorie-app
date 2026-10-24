import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { TOUCH, spacing } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** A selectable pill: filters, choices, quick adds. */
export function Chip({ label, selected, onPress, icon, style }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: TOUCH,
          paddingHorizontal: spacing.lg,
          borderRadius: TOUCH / 2,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.line,
          backgroundColor: selected ? colors.accent : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? colors.onAccent : colors.text} /> : null}
      <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
