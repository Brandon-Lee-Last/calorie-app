import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { isPlus } from '../src/data/entitlement';
import { useDay, useEntitlement, useGoals, useMealPlans, usePlanDiet, usePlanSwaps, useToday } from '../src/data/hooks';
import { dayName, entryFor, isLogged, keepRecentSwaps, planDates, planDay, portionLabel, PLAN_SWAPS_KEY, SLOT_LABEL, swapKey, type PlanItem } from '../src/data/mealPlan';
import { MyPango } from '../src/pango/MyPango';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Card, Chip, EmptyState, Icon, IconButton, Screen, Text } from '../src/ui';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

/** The day's planned meals in the chosen style: log one, swap one, open its recipe; Plus plans the week ahead. */
export default function Plan() {
  const { colors } = useTheme();
  const { repo } = useData();
  const today = useToday();
  const goals = useGoals();
  const plus = isPlus(useEntitlement());
  const plans = useMealPlans();
  const [dietSlug] = usePlanDiet();
  const swaps = usePlanSwaps();
  const params = useLocalSearchParams<{ date?: string }>();
  const dates = planDates(today, plus);
  const [picked, setPicked] = useState(params.date ?? today);
  const date = dates.includes(picked) ? picked : today;
  const entries = useDay(date)?.entries ?? [];
  const data = plans.data;
  const diet = data?.diets.find((d) => d.slug === dietSlug);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <IconButton icon="back" label="Back" onPress={() => router.back()} />
      <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
        Meal plan
      </Text>
      {diet ? <Button title="Change" variant="ghost" size="md" onPress={() => router.push('/diets')} accessibilityLabel="Change the meal plan style" /> : null}
    </View>
  );

  if (!data)
    return (
      <Screen>
        {header}
        {plans.loading ? (
          <EmptyState pose="roll" title="Loading your plan" />
        ) : (
          <EmptyState pose="sleep" title="Meal plans need a connection the first time" body="Open this again when you are online; after that they work offline." />
        )}
      </Screen>
    );

  if (!diet || (diet.locked && !plus))
    return (
      <Screen>
        {header}
        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <MyPango moment="cooking" size={110} />
          <Text variant="h3" align="center">
            {diet ? `${diet.title} is a Plus plan` : 'Pick a meal plan style'}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {diet ? 'Plus has lapsed on this account. Pick a free style, or get Plus back.' : 'Pango plans breakfast, lunch, dinner and snacks to fit your calorie goal.'}
          </Text>
          <Button title="Choose a style" onPress={() => router.push('/diets')} />
        </Card>
      </Screen>
    );

  const plan = planDay(data, diet, date, goals.calories, swaps);
  const isToday = date === today;

  const log = async (item: PlanItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await repo.addEntry(entryFor(item));
    } catch (e) {
      Alert.alert('Could not log it', e instanceof Error ? e.message : String(e));
    }
  };
  const swap = async (item: PlanItem) => {
    Haptics.selectionAsync().catch(() => {});
    const key = swapKey(date, item.slot);
    await repo.setMeta(PLAN_SWAPS_KEY, keepRecentSwaps({ ...swaps, [key]: (swaps[key] ?? 0) + 1 }, today));
  };

  return (
    <Screen>
      {header}
      <Pressable accessibilityRole="button" accessibilityLabel={`${diet.title} plan. Change it`} onPress={() => router.push('/diets')}>
        <Text variant="body" tone="muted">
          {diet.title}: {diet.summary}
        </Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {dates.map((d) => (
          <Chip key={d} label={dayName(d, today)} selected={d === date} onPress={() => setPicked(d)} />
        ))}
        {!plus ? <Chip label="The week ahead" icon="lock" onPress={() => router.push('/plus')} /> : null}
      </ScrollView>

      <Card style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">
          {fmt(plan.calories)} of {fmt(goals.calories)} kcal planned
        </Text>
        <Text variant="small" tone="muted">
          Protein {fmt(plan.proteinG)} g, carbs {fmt(plan.carbG)} g, fat {fmt(plan.fatG)} g
        </Text>
      </Card>

      {diet.caution ? (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.raised,
          }}
        >
          <Icon name="bolt" size={16} color={colors.warn} />
          <Text variant="small" style={{ flex: 1 }}>
            {diet.caution}
          </Text>
        </View>
      ) : null}

      {plan.items.map((item) => (
        <PlanRow key={item.slot} item={item} date={date} logged={isLogged(item, entries)} canLog={isToday} onLog={() => log(item)} onSwap={() => swap(item)} />
      ))}

      <Button title={plus ? 'Shopping list' : 'Shopping list for the week (Plus)'} icon="list" variant="secondary" onPress={() => router.push(plus ? '/shopping' : '/plus')} />
      <Text variant="caption" tone="muted" align="center">
        Portions are sized to your goal. Numbers are worked out from USDA FoodData Central; your own ingredients and cooking will vary. General guidance, not medical advice.
      </Text>
    </Screen>
  );
}

function PlanRow({ item, date, logged, canLog, onLog, onSwap }: { item: PlanItem; date: string; logged: boolean; canLog: boolean; onLog: () => void; onSwap: () => void }) {
  const { colors } = useTheme();
  const m = item.meal;
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label" tone="muted">
          {SLOT_LABEL[item.slot]}
        </Text>
        <Text variant="label">{fmt(item.calories)} kcal</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${m.title}, ${portionLabel(item.portion)}, ${fmt(item.calories)} calories. Opens the recipe`}
        onPress={() =>
          router.push({
            pathname: '/meal',
            params: {
              slug: m.slug,
              portion: String(item.portion),
              meal: item.mealType,
              date,
            },
          })
        }
        style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.7 : 1 })}
      >
        <Text variant="bodyStrong">{m.title}</Text>
        <Text variant="small" tone="muted">
          {portionLabel(item.portion)}
          {m.minutes ? `, ${m.minutes} min` : ''}. Protein {fmt(item.proteinG)} g, carbs {fmt(item.carbG)} g, fat {fmt(item.fatG)} g
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {logged ? (
          <View
            accessibilityLabel="Logged"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
            }}
          >
            <Icon name="check" size={16} color={colors.good} />
            <Text variant="bodyStrong" tone="good">
              Logged
            </Text>
          </View>
        ) : canLog ? (
          <Button title="Log it" size="md" style={{ flex: 1 }} onPress={onLog} accessibilityLabel={`Log ${m.title}`} />
        ) : null}
        {item.options > 1 && !logged ? (
          <Button title="Swap" icon="swap" size="md" variant="secondary" style={{ flex: canLog ? undefined : 1 }} onPress={onSwap} accessibilityLabel={`Swap ${m.title} for something else`} />
        ) : null}
      </View>
    </View>
  );
}
