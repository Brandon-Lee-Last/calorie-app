import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { useData } from '../src/data/DataProvider';
import { mealForTime, type MealType } from '../src/data/dates';
import { MEALS, mealLabel, parseNumber } from '../src/data/entryForm';
import { amountLabel, defaultAmount, entryFromFood, gramsFor, nutritionFor, type Amount, type Food } from '../src/data/foodMath';
import { Pango } from '../src/pango/Pango';
import type { Pose } from '../src/pango/types';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Icon, IconButton, Screen, Segmented, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

type State = { kind: 'loading' } | { kind: 'found'; food: Food } | { kind: 'problem'; pose: Pose; title: string; body: string; retry?: boolean };
const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

function problemFor(e: unknown): State {
  if (e instanceof ApiError) {
    if (e.status === 0) return { kind: 'problem', pose: 'sleep', title: 'No connection', body: 'Looking up a barcode needs the internet. Try again when you are online, or add the food by hand.', retry: true };
    if (e.status === 404) return { kind: 'problem', pose: 'think', title: 'Pango does not know this one yet', body: 'No product with nutrition facts was found for this barcode. Add it by hand from the pack.' };
    if (e.status === 422) return { kind: 'problem', pose: 'oops', title: 'That barcode did not read properly', body: 'Hold the phone steady with the whole barcode in view, then scan it again.' };
  }
  return { kind: 'problem', pose: 'oops', title: 'The food list is not answering', body: 'Try again in a moment.', retry: true };
}

/** A packaged food found by its barcode: choose how much, pick the meal, save. */
export default function FoodScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { api, repo } = useData();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [amount, setAmount] = useState<Amount>({ unit: 'g', grams: 100 });
  const [gramsText, setGramsText] = useState('100');
  const [meal, setMeal] = useState<MealType>(() => mealForTime());
  const [saving, setSaving] = useState(false);

  const look = useCallback(() => {
    setState({ kind: 'loading' });
    unwrap(api.GET('/v1/foods/barcode/{code}', { params: { path: { code: barcode } } })).then(
      (food) => {
        const start = defaultAmount(food);
        setAmount(start);
        setGramsText(String(Math.round(gramsFor(food, start))));
        setState({ kind: 'found', food });
      },
      (e) => setState(problemFor(e)),
    );
  }, [api, barcode]);

  useEffect(() => {
    if (barcode) look();
  }, [barcode, look]);

  const food = state.kind === 'found' ? state.food : null;
  const grams = food ? gramsFor(food, amount) : 0;
  const n = food ? nutritionFor(food, grams) : null;
  const gramsError = amount.unit === 'g' && !(amount.grams > 0 && amount.grams <= 5000) ? 'Enter grams from 1 to 5 000.' : null;

  const setUnit = (unit: 'serving' | 'g') => {
    if (!food) return;
    if (unit === 'serving') setAmount({ unit, servings: 1 });
    else {
      const g = Math.round(grams);
      setAmount({ unit, grams: g });
      setGramsText(String(g));
    }
  };

  const save = async () => {
    if (!food || gramsError || saving) return;
    setSaving(true);
    try {
      await repo.addEntry(entryFromFood(food, amount, meal));
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="label" tone="muted">
          Barcode {barcode}
        </Text>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>

      {state.kind === 'loading' ? (
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl }} accessibilityLiveRegion="polite">
          <Pango pose="think" size={140} />
          <Text variant="h3">Looking it up…</Text>
        </View>
      ) : state.kind === 'problem' ? (
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
          <Pango pose={state.pose} size={140} />
          <Text variant="h2" align="center">
            {state.title}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {state.body}
          </Text>
          {state.retry ? <Button title="Try again" onPress={look} style={{ alignSelf: 'stretch' }} /> : null}
          <Button title="Scan again" variant={state.retry ? 'secondary' : 'primary'} onPress={() => router.replace('/lens')} style={{ alignSelf: 'stretch' }} />
          <Button title="Add it by hand" variant="ghost" onPress={() => router.replace('/add')} />
        </View>
      ) : food && n ? (
        <>
          <View style={{ gap: 4 }}>
            <Text variant="title" accessibilityRole="header">
              {food.name}
            </Text>
            {food.brand ? (
              <Text variant="body" tone="muted">
                {food.brand}
              </Text>
            ) : null}
            <Text variant="small" tone="muted">
              {fmt(food.calories100g)} kcal per 100 g{food.servingG ? `, ${food.servingLabel ?? `serving ${food.servingG} g`}` : ''}
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="label" tone="muted">
              How much
            </Text>
            {food.servingG ? (
              <Segmented
                options={[
                  { value: 'serving', label: 'Servings' },
                  { value: 'g', label: 'Grams' },
                ]}
                value={amount.unit}
                onChange={setUnit}
                stretch
              />
            ) : null}
            {amount.unit === 'serving' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingLeft: 18, paddingRight: spacing.sm, borderRadius: 26, backgroundColor: colors.raised }}>
                <Text variant="bodyStrong" accessibilityLiveRegion="polite">
                  {amountLabel(food, amount)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Step icon="minus" label="Less" disabled={amount.servings <= 0.5} onPress={() => setAmount({ unit: 'serving', servings: Math.max(0.5, amount.servings - 0.5) })} />
                  <Step icon="plus" label="More" disabled={amount.servings >= 20} onPress={() => setAmount({ unit: 'serving', servings: Math.min(20, amount.servings + 0.5) })} />
                </View>
              </View>
            ) : (
              <Field
                label="Grams"
                value={gramsText}
                onChangeText={(t) => {
                  setGramsText(t);
                  const g = parseNumber(t);
                  setAmount({ unit: 'g', grams: g === null || Number.isNaN(g) ? 0 : g });
                }}
                keyboardType="decimal-pad"
                suffix="g"
                error={gramsError}
              />
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Tile value={fmt(n.calories)} label="kcal" />
            <Tile value={`${n.proteinG} g`} label="Protein" color={colors.protein} />
            <Tile value={`${n.carbG} g`} label="Carbs" color={colors.carbs} />
            <Tile value={`${n.fatG} g`} label="Fat" color={colors.fat} />
          </View>

          <Segmented options={MEALS} value={meal} onChange={setMeal} stretch />
          <Button title={`Save to ${mealLabel(meal).toLowerCase()}, ${fmt(n.calories)} kcal`} onPress={save} loading={saving} disabled={!!gramsError} />
          {food.source === 'openfoodfacts' ? (
            <Text variant="caption" tone="muted" align="center">
              Product data from Open Food Facts, available under the Open Database Licence (ODbL).
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.raised }}>
      <Text variant="h3" style={{ fontSize: 17, color: color ?? colors.text }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Step({ icon, label, disabled, onPress }: { icon: 'plus' | 'minus'; label: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Icon name={icon} size={20} />
    </Pressable>
  );
}
