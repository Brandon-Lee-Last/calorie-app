import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'lg' | 'md';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Pill button. Primary is the one loud action on a screen. */
export function Button({ title, onPress, variant = 'primary', size = 'lg', icon, disabled, loading, accessibilityLabel, style }: ButtonProps) {
  const { colors } = useTheme();
  const height = size === 'lg' ? 56 : 48;
  const look = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: 'transparent' },
    secondary: { bg: colors.raised, fg: colors.text, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.muted, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        if (variant === 'primary') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { height, borderRadius: height / 2, backgroundColor: look.bg, borderColor: look.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={look.fg} /> : icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
        <Text variant={size === 'lg' ? 'h3' : 'bodyStrong'} style={{ color: look.fg }}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

