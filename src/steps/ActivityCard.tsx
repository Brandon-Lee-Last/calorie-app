import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { shiftDate } from '../data/dates';
import { useBurned, useRepoQuery, useSettings, useSteps, useToday } from '../data/hooks';
import { goalStreak } from '../data/steps';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';
import { Icon, ProgressBar, Text } from '../ui';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

/** On Today: steps and energy burned against their goals, and the streak. Opens the activity screen. */
export function ActivityCard() {
  const { colors } = useTheme();
  const today = useToday();
  const [{ stepGoal, burnGoal, stepsFrom }] = useSettings();
  const steps = useSteps(today);
  const { total } = useBurned(today);
  const since = shiftDate(today, -400);
  const history = useRepoQuery(['activity'], (r) => r.stepsByDay(since), [since]);
  const streak = history ? goalStreak(history, stepGoal, today) : 0;
  const count = steps?.steps ?? 0;
  const bar = (label: string, value: string, fraction: number, color: string, a11y: string) => (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="caption">{value}</Text>
      </View>
      <ProgressBar value={fraction} color={color} height={6} label={a11y} />
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Activity: ${fmt(count)} of ${fmt(stepGoal)} steps, ${fmt(total)} of ${fmt(burnGoal)} calories burned${streak > 1 ? `, ${streak} day streak` : ''}`}
      accessibilityHint="Opens your steps and goals"
      onPress={() => router.push('/activity')}
      style={({ pressed }) => ({ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="walk" size={18} color={colors.goodText} />
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {count || stepsFrom === 'health-connect' ? `${fmt(count)} steps` : 'Activity'}
          <Text variant="small" tone="muted">
            {count ? `  ·  ${steps!.km.toFixed(1)} km` : stepsFrom === 'health-connect' ? '' : '  ·  add your steps'}
          </Text>
        </Text>
        {streak > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, height: 24, borderRadius: 12, backgroundColor: colors.raised }}>
            <Icon name="flame" size={13} color={colors.warn} />
            <Text variant="caption">{streak}</Text>
          </View>
        ) : null}
        <Icon name="chevron" size={16} color={colors.muted} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {bar('Steps', `${fmt(count)} / ${fmt(stepGoal)}`, count / stepGoal, colors.good, `${fmt(count)} of ${fmt(stepGoal)} steps`)}
        {bar('Burned', `${fmt(total)} / ${fmt(burnGoal)}`, total / burnGoal, colors.accent, `${fmt(total)} of ${fmt(burnGoal)} calories burned`)}
      </View>
    </Pressable>
  );
}
