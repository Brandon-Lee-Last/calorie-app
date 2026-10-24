import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { TOUCH } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

/** A round icon-only button. `label` is what screen readers say. */
export function IconButton({ icon, label, onPress, tone = 'surface', style }: { icon: IconName; label: string; onPress?: () => void; tone?: 'surface' | 'overlay' | 'accent'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, overlay: colors.overlay, accent: colors.accent }[tone];
  const fg = tone === 'accent' ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: bg, borderWidth: tone === 'surface' ? 1 : 0, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={20} color={fg} />
    </Pressable>
  );
}
