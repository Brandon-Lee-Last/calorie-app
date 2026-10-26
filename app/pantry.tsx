import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { addToPantry, coachProblem, PANTRY_KEY, recipeEntry, type PantryItem, type PantryRecipe } from '../src/data/coach';
import { useData } from '../src/data/DataProvider';
import { mealForTime, type MealType } from '../src/data/dates';
import { MEALS } from '../src/data/entryForm';
import type { Food } from '../src/data/foodMath';
import { useRepoQuery } from '../src/data/hooks';
import { useTheme } from '../src/theme/theme';
import { fontFamily, radius, spacing } from '../src/theme/tokens';
import { Button, Chip, Icon, IconButton, Screen, Text } from '../src/ui';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

/** My groceries: what is at home, and Pango's meal ideas from it, counted by the server from the foods' own numbers. */
export default function Pantry() {
  const { colors } = useTheme();
  const { api, repo } = useData();
  const items = useRepoQuery(['meta'], (r) => r.getMeta<PantryItem[]>(PANTRY_KEY), []) ?? [];
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Food[]>([]);
  const [meal, setMeal] = useState<MealType>(mealForTime());
  const [busy, setBusy] = useState(false);
  const [recipes, setRecipes] = useState<PantryRecipe[] | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof coachProblem> | null>(null);
  const [logged, setLogged] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setFound([]);
    let alive = true;
    const timer = setTimeout(() => {
      unwrap(api.GET('/v1/foods/search', { params: { query: { q, limit: 8 } } }))
        .then((r) => alive && setFound(r.items))
        .catch(() => alive && setFound([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api, query]);

  const save = (next: PantryItem[]) => repo.setMeta(PANTRY_KEY, next);
  const add = async (f: Food) => {
    Haptics.selectionAsync().catch(() => {});
    await save(addToPantry(items, { id: f.id, name: f.name, brand: f.brand }));
    setQuery('');
    setFound([]);
  };
  const make = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const out = await unwrap(api.POST('/v1/coach/pantry-meals', { body: { foodIds: items.map((i) => i.id), mealType: meal } }));
      setRecipes(out.recipes);
      setLogged([]);
    } catch (e) {
      setProblem(coachProblem(e));
    } finally {
      setBusy(false);
    }
  };
  const log = async (r: PantryRecipe) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await repo.addEntry(recipeEntry(r, r.mealType));
      setLogged((l) => [...l, r.title]);
    } catch (e) {
      Alert.alert('Could not log it', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          My groceries
        </Text>
      </View>
      <Text variant="body" tone="muted">
        Add what you have at home and Pango suggests meals that fit your goal. Salt, pepper, herbs, spices, garlic, lemon and vinegar are assumed.
      </Text>

      <View style={{ gap: spacing.xs }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add a food, e.g. eggs, brown rice, spinach"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Find a food to add"
          style={{
            height: 48,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            color: colors.text,
            fontFamily: fontFamily[500],
            fontSize: 16,
          }}
        />
        {found.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityLabel={`Add ${f.name}`}
            onPress={() => add(f)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="plus" size={16} color={colors.accentText} />
            <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
              {f.name}
              {f.brand ? ` (${f.brand})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {items.map((i) => (
            <Chip key={i.id} label={`${i.name}  ✕`} onPress={() => save(items.filter((x) => x.id !== i.id))} />
          ))}
        </View>
      ) : (
        <Text variant="small" tone="muted">
          Nothing added yet.
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MEALS.map((m) => (
          <Chip key={m.value} label={m.label} selected={meal === m.value} onPress={() => setMeal(m.value)} />
        ))}
      </View>
      <Button
        title={items.length < 2 ? 'Add at least two foods' : `Make ${MEALS.find((m) => m.value === meal)!.label.toLowerCase()} ideas`}
        icon="sparkle"
        disabled={items.length < 2}
        loading={busy}
        onPress={make}
      />

      {problem ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
          <Text variant="bodyStrong">{problem.title}</Text>
          <Text variant="small" tone="muted">
            {problem.body}
          </Text>
          {problem.plus ? <Button title="See Plus" size="md" onPress={() => router.push('/plus')} /> : null}
        </View>
      ) : null}

      {(recipes ?? []).map((r) => (
        <View key={r.title} style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text variant="h3" style={{ flex: 1 }}>
              {r.title}
            </Text>
            <Text variant="label">{fmt(r.nutrition.calories)} kcal</Text>
          </View>
          <Text variant="small" tone="muted">
            {r.minutes} min. Protein {fmt(r.nutrition.proteinG)} g, carbs {fmt(r.nutrition.carbG)} g, fat {fmt(r.nutrition.fatG)} g
          </Text>
          {r.ingredients.map((i) => (
            <Text key={i.name} variant="small">
              {i.name}: {i.grams} g
            </Text>
          ))}
          {r.steps.map((s, n) => (
            <Text key={n} variant="small" tone="muted">
              {n + 1}. {s}
            </Text>
          ))}
          <Button title={logged.includes(r.title) ? 'Logged' : 'Log it'} icon={logged.includes(r.title) ? 'check' : undefined} disabled={logged.includes(r.title)} size="md" onPress={() => log(r)} />
        </View>
      ))}
      {recipes?.length ? (
        <Text variant="caption" tone="muted" align="center">
          Ideas by Pango (AI). Calories are worked out from your foods&apos; own figures (USDA or the label) for these amounts.
        </Text>
      ) : null}
    </Screen>
  );
}
