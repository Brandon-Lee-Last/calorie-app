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
  const { total, walking, burned } = useBurned(today);
  const since = shiftDate(today, -400);
  const history = useRepoQuery(['activity'], (r) => r.stepsByDay(since), [since]);
  const streak = history ? goalStreak(history, stepGoal, today) : 0;
  const count = steps?.steps ?? 0;
  const detail = count
    ? `About ${steps!.km.toFixed(1)} km · ${fmt(walking)} kcal walking${burned ? `, ${fmt(burned)} training` : ''}`
    : stepsFrom === 'health-connect'
      ? 'No steps yet today. Health Connect updates when Pango is open.'
      : 'Count your steps automatically with Health Connect, or add them yourself.';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Activity: ${fmt(count)} of ${fmt(stepGoal)} steps, ${fmt(total)} of ${fmt(burnGoal)} calories burned${streak > 1 ? `, ${streak} day streak` : ''}`}
      accessibilityHint="Opens your steps and goals"
      onPress={() => router.push('/activity')}
      style={({ pressed }) => ({ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="walk" size={20} color={colors.goodText} />
        <Text variant="h3" style={{ flex: 1 }}>
          Activity
        </Text>
        {streak > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, height: 26, borderRadius: 13, backgroundColor: colors.raised }}>
            <Icon name="flame" size={14} color={colors.warn} />
            <Text variant="caption">{streak} days</Text>
          </View>
        ) : null}
        <Icon name="chevron" size={18} color={colors.muted} />
      </View>
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="good">
            Steps
          </Text>
          <Text variant="caption">
            {fmt(count)} / {fmt(stepGoal)}
          </Text>
        </View>
        <ProgressBar value={count / stepGoal} color={colors.good} label={`${fmt(count)} of ${fmt(stepGoal)} steps`} />
      </View>
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="accent">
            Burned
          </Text>
          <Text variant="caption">
            {fmt(total)} / {fmt(burnGoal)} kcal
          </Text>
        </View>
        <ProgressBar value={total / burnGoal} color={colors.accent} label={`${fmt(total)} of ${fmt(burnGoal)} calories burned`} />
      </View>
      <Text variant="caption" tone="muted">
        {detail}
      </Text>
    </Pressable>
  );
}
