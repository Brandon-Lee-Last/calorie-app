import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'home' },
  train: { label: 'Train', icon: 'train' },
  progress: { label: 'Progress', icon: 'progress' },
  me: { label: 'Me', icon: 'me' },
};

/** Today, Train, a raised Scan button in the middle, Progress, Me. */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const tab = (index: number) => {
    const route = state.routes[index];
    const meta = TABS[route.name];
    if (!meta) return null;
    const on = state.index === index;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={meta.label}
        onPress={() => !on && navigateToTab(route.key)}
        style={{ width: 64, minHeight: 48, alignItems: 'center', gap: 4 }}
      >
        <Icon name={meta.icon} size={24} color={on ? colors.accentText : colors.muted} />
        <Text variant="caption" style={{ fontSize: 11, color: on ? colors.accentText : colors.muted }}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        paddingHorizontal: spacing.md,
        backgroundColor: colors.tabBar,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {tab(0)}
      {tab(1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan a meal"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/lens');
        }}
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          marginTop: -26,
          borderRadius: 32,
          backgroundColor: colors.accent,
          borderWidth: 5,
          borderColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Icon name="scan" size={28} color={colors.onAccent} strokeWidth={2.4} />
      </Pressable>
      {tab(2)}
      {tab(3)}
    </View>
  );
}
