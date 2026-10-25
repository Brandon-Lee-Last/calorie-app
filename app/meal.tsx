import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import type { MealType } from '../src/data/dates';
import { mealLabel } from '../src/data/entryForm';
import { useMealPlans, useToday } from '../src/data/hooks';
import { entryFor, itemFor, portionLabel, PORTIONS, scaledIngredients } from '../src/data/mealPlan';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Card, EmptyState, IconButton, Screen, Text } from '../src/ui';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

/** One meal from the plans: ingredients for the portion chosen, how to make it, and logging it. */
export default function MealScreen() {
  const { colors } = useTheme();
  const { repo } = useData();
  const today = useToday();
  const params = useLocalSearchParams<{
    slug: string;
    portion?: string;
    meal?: MealType;
    date?: string;
  }>();
  const meal = useMealPlans().data?.meals.find((m) => m.slug === params.slug);
  const [portion, setPortion] = useState(() => {
    const p = Number(params.portion);
    return (PORTIONS as readonly number[]).includes(p) ? p : 1;
  });
  const [logged, setLogged] = useState(false);

  if (!meal)
    return (
      <Screen>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <EmptyState pose="think" title="This meal is not on the phone yet" body="Open your meal plan while online, then try again." />
      </Screen>
    );

  const mealType: MealType = params.meal && meal.slots.includes(params.meal) ? params.meal : meal.slots[0];
  const item = itemFor(meal, portion, mealType, mealType);
  const canLog = !params.date || params.date === today;
  const step = (dir: 1 | -1) => {
    const i = PORTIONS.indexOf(portion as (typeof PORTIONS)[number]) + dir;
    if (i >= 0 && i < PORTIONS.length) setPortion(PORTIONS[i]);
  };
  const log = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await repo.addEntry(entryFor(item));
      setLogged(true);
    } catch (e) {
      Alert.alert('Could not log it', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          {meal.title}
        </Text>
      </View>
      {meal.summary ? (
        <Text variant="body" tone="muted">
          {meal.summary}
        </Text>
      ) : null}
      <Text variant="small" tone="muted">
        {meal.slots.map(mealLabel).join(' or ')}
        {meal.minutes ? `, ${meal.minutes} min` : ''}
      </Text>

      {meal.locked ? (
        <Card style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">The recipe for this one comes with Plus</Text>
          <Text variant="small" tone="muted">
            {fmt(meal.nutrition.calories)} kcal a portion. Plus opens every meal plan style, the week ahead and a shopping list.
          </Text>
          <Button title="See Plus" onPress={() => router.push('/plus')} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <IconButton icon="minus" label="Smaller portion" onPress={() => step(-1)} />
              <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${portionLabel(portion)}, ${fmt(item.calories)} calories`}>
                <Text variant="h3">{portionLabel(portion)}</Text>
                <Text variant="small" tone="muted">
                  {fmt(item.calories)} kcal
                </Text>
              </View>
              <IconButton icon="plus" label="Bigger portion" onPress={() => step(1)} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Text variant="caption" tone="protein">
                Protein {fmt(item.proteinG)} g
              </Text>
              <Text variant="caption" tone="carbs">
                Carbs {fmt(item.carbG)} g
              </Text>
              <Text variant="caption" tone="fat">
                Fat {fmt(item.fatG)} g
              </Text>
            </View>
          </Card>

          <Text variant="h3">Ingredients</Text>
          <View
            style={{
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            {scaledIngredients(meal, portion).map((i, n) => (
              <View
                key={i.name}
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderTopWidth: n ? 1 : 0,
                  borderColor: colors.line,
                }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {i.name}
                </Text>
                <Text variant="body" tone="muted">
                  {i.grams} g{i.measure ? ` (${i.measure})` : ''}
                </Text>
              </View>
            ))}
          </View>

          {meal.steps.length ? <Text variant="h3">Method</Text> : null}
          {meal.steps.map((s, n) => (
            <View key={n} style={{ flexDirection: 'row', gap: spacing.md }}>
              <Text variant="bodyStrong" tone="accent">
                {n + 1}
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {s}
              </Text>
            </View>
          ))}

          {canLog ? <Button title={logged ? 'Logged' : `Log as ${mealLabel(mealType).toLowerCase()}`} icon={logged ? 'check' : undefined} disabled={logged} onPress={log} /> : null}
          <Text variant="caption" tone="muted" align="center">
            {meal.source ?? 'Numbers are estimates'}. Brands, portions and cooking change them.
          </Text>
        </>
      )}
    </Screen>
  );
}
