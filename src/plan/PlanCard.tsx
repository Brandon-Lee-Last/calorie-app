import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { View } from 'react-native';

import { useData } from '../data/DataProvider';
import { mealForTime, shiftDate } from '../data/dates';
import { isPlus } from '../data/entitlement';
import { useDay, useEntitlement, useGoals, useMealPlans, usePlanDiet, usePlanSwaps, useRepoQuery, useToday } from '../data/hooks';
import { entryFor, isLogged, nextPlanned, planDay, PLAN_INVITE_KEY, portionLabel, SLOT_LABEL } from '../data/mealPlan';
import { MyPango } from '../pango/MyPango';
import { spacing } from '../theme/tokens';
import { Button, Card, Text } from '../ui';

/** On Today: the next meal on the plan to log, or an invitation to start a plan. */
export function PlanCard() {
  const { repo } = useData();
  const [dietSlug] = usePlanDiet();
  const dismissed = useRepoQuery(['meta'], (r) => r.getMeta<boolean>(PLAN_INVITE_KEY), []);
  if (dietSlug === undefined || dismissed === undefined) return null;
  // Meal plans are only fetched once someone has a plan: the invitation costs no data.
  if (dietSlug) return <NextMeal dietSlug={dietSlug} />;
  if (dismissed) return null;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <MyPango moment="cooking" size={72} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Text variant="bodyStrong">Want a meal plan?</Text>
        <Text variant="small" tone="muted">
          Pango plans your meals to fit your goal. Balanced and Budget plans are free.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Choose a plan" size="md" onPress={() => router.push('/diets')} />
          <Button title="Not now" size="md" variant="ghost" accessibilityLabel="Not now, hide the meal plan card" onPress={() => repo.setMeta(PLAN_INVITE_KEY, true)} />
        </View>
      </View>
    </Card>
  );
}

function NextMeal({ dietSlug }: { dietSlug: string }) {
  const { repo } = useData();
  const today = useToday();
  const goals = useGoals();
  const plus = isPlus(useEntitlement());
  const data = useMealPlans().data;
  const swaps = usePlanSwaps();
  const entries = useDay(today)?.entries;
  const diet = data?.diets.find((d) => d.slug === dietSlug);
  if (!entries) return null;
  if (!data || !diet) return null;
  if (diet.locked && !plus)
    return (
      <Card style={{ gap: spacing.sm }}>
        <Text variant="bodyStrong">Your {diet.title} plan needs Plus</Text>
        <Button title="Choose another plan" size="md" variant="secondary" onPress={() => router.push('/diets')} />
      </Card>
    );

  const plan = planDay(data, diet, today, goals.calories, swaps);
  const next = nextPlanned(plan, entries, mealForTime());
  if (!next)
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <MyPango pose="cheer" size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{plan.items.every((i) => isLogged(i, entries)) ? "Today's plan is all logged" : 'That is it for today'}</Text>
          <Button
            title="See tomorrow"
            size="md"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/plan',
                params: { date: shiftDate(today, 1) },
              })
            }
          />
        </View>
      </Card>
    );

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="label" tone="muted">
        Next on your {diet.title} plan: {SLOT_LABEL[next.slot].toLowerCase()}
      </Text>
      <Text variant="bodyStrong">{next.meal.title}</Text>
      <Text variant="small" tone="muted">
        {portionLabel(next.portion)}
        {next.portion !== 1 ? ' to fit your goal' : ''} · {next.calories} kcal
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Log it"
          size="md"
          style={{ flex: 1 }}
          accessibilityLabel={`Log ${next.meal.title}`}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            repo.addEntry(entryFor(next)).catch((e) => console.warn(e));
          }}
        />
        <Button title="See plan" size="md" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/plan')} />
      </View>
    </Card>
  );
}
