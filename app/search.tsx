import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { useData } from '../src/data/DataProvider';
import { mealForTime, type MealType } from '../src/data/dates';
import { MEALS, mealLabel } from '../src/data/entryForm';
import type { Food } from '../src/data/foodMath';
import { MIN_QUERY, describeFood, matchMeals, withoutShown } from '../src/data/foodSearch';
import type { Usual } from '../src/data/history';
import { useDay, useMealHistory, useToday } from '../src/data/hooks';
import { OffSearchError, offSearch, type OffHit } from '../src/data/offSearch';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Icon, IconButton, Screen, Text, type IconName } from '../src/ui';
import { Field } from '../src/ui/Field';

type Found = { status: 'idle' | 'loading' | 'offline' | 'failed' } | { status: 'done'; items: Food[] };
type FromOff = { status: 'idle' } | { status: 'loading'; query: string } | { status: 'done'; query: string; items: OffHit[] } | { status: 'problem'; query: string; message: string };

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

const OFF_PROBLEM: Record<OffSearchError['reason'], string> = {
  busy: 'Open Food Facts allows 10 searches a minute. Try again in a moment.',
  offline: 'Searching Open Food Facts needs the internet.',
  failed: 'Open Food Facts is not answering. Try again later.',
};

/**
 * Find a food to log: meals you had before (on the phone, offline too), the shared food list as you type, and Open
 * Food Facts' millions of products when you ask. Picking one opens the food screen to choose how much.
 */
export default function Search() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const meal: MealType = MEALS.some((m) => m.value === mealParam) ? (mealParam as MealType) : mealForTime();
  const { api } = useData();
  const { colors } = useTheme();
  const today = useToday();
  const history = useMealHistory(today);
  const day = useDay(today);
  const [opened] = useState(Date.now);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found>({ status: 'idle' });
  const [fromOff, setFromOff] = useState<FromOff>({ status: 'idle' });
  const q = query.trim();
  const searching = q.length >= MIN_QUERY;

  useEffect(() => {
    if (q.length < MIN_QUERY) return setFound({ status: 'idle' });
    let alive = true;
    setFound({ status: 'loading' });
    // Wait for a pause in typing, so each word does not cost a request.
    const timer = setTimeout(() => {
      unwrap(api.GET('/v1/foods/search', { params: { query: { q, limit: 25 } } })).then(
        (r) => alive && setFound({ status: 'done', items: r.items }),
        (e) => alive && setFound({ status: e instanceof ApiError && e.status === 0 ? 'offline' : 'failed' }),
      );
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api, q]);

  const mine = searching ? matchMeals(history ?? [], q) : [];
  const recent = (history ?? []).slice(0, 8);
  const foods = found.status === 'done' ? withoutShown(found.items, mine) : [];
  const added = (day?.entries ?? []).filter((e) => e.loggedAt >= opened);
  const off = fromOff.status !== 'idle' && fromOff.query === q ? fromOff : null;

  const openFood = (params: { id: string } | { barcode: string }) => router.push({ pathname: '/food', params: { ...params, meal } });
  const reuse = (u: Usual) =>
    u.foodId
      ? openFood({ id: u.foodId })
      : router.push({ pathname: '/add', params: { name: u.name, calories: String(u.calories), proteinG: String(u.proteinG), carbG: String(u.carbG), fatG: String(u.fatG), meal } });
  const searchOff = () => {
    const term = q;
    setFromOff({ status: 'loading', query: term });
    offSearch.search(term).then(
      (items) => setFromOff({ status: 'done', query: term, items }),
      (e) => setFromOff({ status: 'problem', query: term, message: OFF_PROBLEM[e instanceof OffSearchError ? e.reason : 'failed'] }),
    );
  };

  const foodsNote =
    found.status === 'loading'
      ? 'Searching…'
      : found.status === 'offline'
        ? 'Searching the food list needs the internet. Meals you had before still show up.'
        : found.status === 'failed'
          ? 'The food list is not answering. Try again in a moment.'
          : found.status === 'done' && foods.length === 0
            ? `Nothing called "${q}" in the food list yet.`
            : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen keyboardShouldPersistTaps="handled" gap={spacing.md}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title" accessibilityRole="header">
            Add food
          </Text>
          <IconButton icon="close" label="Close" onPress={() => router.back()} />
        </View>

        <Field label="Search foods" value={query} onChangeText={setQuery} placeholder="Rusks, chicken mayo, banana…" autoFocus returnKeyType="search" autoCapitalize="none" maxLength={80} />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Action icon="barcode" label="Barcode" a11y="Scan a barcode" onPress={() => router.push({ pathname: '/lens', params: { mode: 'barcode' } })} />
          <Action icon="scan" label="Photo" a11y="Photograph your plate" onPress={() => router.push('/lens')} />
          <Action icon="edit" label="Type it in" a11y="Type it in yourself" onPress={() => router.push({ pathname: '/add', params: { name: q, meal } })} />
        </View>

        {added.length ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingLeft: 14, paddingRight: 8, borderRadius: radius.lg, backgroundColor: colors.raised }}>
            <Icon name="check" size={18} />
            <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>
              Added {added.length === 1 ? added[0].name : `${added.length} foods`}, {fmt(added.reduce((s, e) => s + e.calories, 0))} kcal
            </Text>
            <Button title="Done" size="md" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : null}

        {!searching ? (
          <Section title="Recent">
            {recent.length ? (
              recent.map((u) => <MealRow key={u.key} meal={u} onPress={() => reuse(u)} />)
            ) : (
              <Text variant="small" tone="muted">
                Search for a food or a brand, or scan the barcode on the pack. What you log shows up here for next time.
              </Text>
            )}
          </Section>
        ) : (
          <>
            {mine.length ? (
              <Section title="Your meals">
                {mine.map((u) => (
                  <MealRow key={u.key} meal={u} onPress={() => reuse(u)} />
                ))}
              </Section>
            ) : null}
            <Section title="Foods" busy={found.status === 'loading'}>
              {foods.map((f) => {
                const d = describeFood(f);
                return <Row key={f.id} title={f.name} detail={d.detail} kcal={d.kcal} label={`${f.name}${f.brand ? `, ${f.brand}` : ''}, ${d.kcal} calories per ${d.per}`} onPress={() => openFood({ id: f.id })} />;
              })}
              {foodsNote ? (
                <Text variant="small" tone="muted">
                  {foodsNote}
                </Text>
              ) : null}
            </Section>

            {off?.status === 'done' ? (
              <Section title="From Open Food Facts">
                {off.items.length ? (
                  off.items.map((h) => {
                    const d = describeFood({ brand: h.brand, servingG: h.servingG, servingLabel: h.servingLabel, calories100g: h.calories100g });
                    return <Row key={h.barcode} title={h.name} detail={d.detail} kcal={d.kcal} label={`${h.name}${h.brand ? `, ${h.brand}` : ''}, ${d.kcal} calories per ${d.per}`} onPress={() => openFood({ barcode: h.barcode })} />;
                  })
                ) : (
                  <Text variant="small" tone="muted">
                    Open Food Facts has nothing called "{q}" either. Type it in from the pack, or scan its barcode.
                  </Text>
                )}
                <Text variant="caption" tone="muted">
                  Product data from Open Food Facts, available under the Open Database Licence (ODbL).
                </Text>
              </Section>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Button title="Search Open Food Facts" icon="search" variant="secondary" loading={off?.status === 'loading'} onPress={searchOff} />
                <Text variant="caption" tone="muted" align="center">
                  {off?.status === 'problem' ? off.message : 'Millions of packaged foods from around the world, added by people like you.'}
                </Text>
              </View>
            )}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Section({ title, busy, children }: { title: string; busy?: boolean; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="label" tone="muted" accessibilityRole="header">
          {title}
        </Text>
        {busy ? <ActivityIndicator size="small" /> : null}
      </View>
      {children}
    </View>
  );
}

function MealRow({ meal, onPress }: { meal: Usual; onPress: () => void }) {
  const detail = [meal.quantityG ? `${fmt(meal.quantityG)} g` : null, meal.times > 1 ? `logged ${meal.times} times` : 'logged once'].filter(Boolean).join(' · ');
  return <Row title={meal.name} detail={detail} kcal={meal.calories} label={`${meal.name}, ${meal.calories} calories, ${detail}`} onPress={onPress} />;
}

function Row({ title, detail, kcal, label, onPress }: { title: string; detail: string; kcal: number; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="bodyStrong">{fmt(kcal)}</Text>
        <Text variant="caption" tone="muted">
          kcal
        </Text>
      </View>
    </Pressable>
  );
}

function Action({ icon, label, a11y, onPress }: { icon: IconName; label: string; a11y: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: 64, borderRadius: radius.lg, backgroundColor: colors.raised, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name={icon} size={20} color={colors.accentText} />
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}
