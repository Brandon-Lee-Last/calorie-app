import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { useData } from '../src/data/DataProvider';
import { mealForTime, type MealType } from '../src/data/dates';
import { MEALS } from '../src/data/entryForm';
import type { Food } from '../src/data/foodMath';
import { MIN_QUERY, dedupeFoods, describeFood, highlightParts, matchMeals, matchesQuery, withoutShown, words } from '../src/data/foodSearch';
import type { Usual } from '../src/data/history';
import { useDay, useMealHistory, useToday } from '../src/data/hooks';
import { OffSearchError, offSearch, type OffHit } from '../src/data/offSearch';
import { useTheme } from '../src/theme/theme';
import { fontFamily, radius, spacing } from '../src/theme/tokens';
import { Button, Icon, IconButton, Screen, Text, type IconName } from '../src/ui';

type Status = 'idle' | 'loading' | 'done' | 'offline' | 'failed';
type FromOff = { status: 'idle' } | { status: 'loading'; query: string } | { status: 'done'; query: string; items: OffHit[] } | { status: 'problem'; query: string; message: string };

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');
/** Long enough to skip the letters of a word typed quickly, short enough to feel like it keeps up. */
const TYPING_PAUSE_MS = 150;

const OFF_PROBLEM: Record<OffSearchError['reason'], string> = {
  busy: 'Open Food Facts allows 10 searches a minute. Try again in a moment.',
  offline: 'Searching Open Food Facts needs the internet.',
  failed: 'Open Food Facts is not answering. Try again later.',
};

/**
 * Find a food to log, like Samsung Health's search: matches drop down under the box as you type, your own meals first
 * (on the phone, offline too), then the shared food list, then Open Food Facts' millions of products when you ask.
 * Picking one opens the food screen to choose how much.
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
  const [status, setStatus] = useState<Status>('idle');
  // The last answer, kept on screen while the next one loads so the list does not blink at every letter.
  const [answer, setAnswer] = useState<{ query: string; items: Food[] } | null>(null);
  const answers = useRef(new Map<string, Food[]>());
  const [fromOff, setFromOff] = useState<FromOff>({ status: 'idle' });
  const q = query.trim();
  const typing = q.length > 0;

  useEffect(() => {
    if (q.length < MIN_QUERY) return setStatus('idle');
    const key = words(q).join(' ');
    const known = answers.current.get(key);
    if (known) {
      setAnswer({ query: q, items: known });
      return setStatus('done');
    }
    let alive = true;
    setStatus('loading');
    const timer = setTimeout(() => {
      unwrap(api.GET('/v1/foods/search', { params: { query: { q, limit: 20 } } })).then(
        (r) => {
          answers.current.set(key, r.items);
          if (!alive) return;
          setAnswer({ query: q, items: r.items });
          setStatus('done');
        },
        (e) => alive && setStatus(e instanceof ApiError && e.status === 0 ? 'offline' : 'failed'),
      );
    }, TYPING_PAUSE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api, q]);

  const mine = typing ? matchMeals(history ?? [], q) : [];
  // An older answer only shows the foods that still match what is typed now.
  const shown = q.length >= MIN_QUERY && answer ? (answer.query === q ? answer.items : answer.items.filter((f) => matchesQuery(`${f.name} ${f.brand ?? ''}`, q))) : [];
  const foods = withoutShown(dedupeFoods(shown), mine);
  const recent = (history ?? []).slice(0, 8);
  const added = (day?.entries ?? []).filter((e) => e.loggedAt >= opened);
  const off = fromOff.status !== 'idle' && fromOff.query === q ? fromOff : null;

  const openFood = (params: { id: string } | { barcode: string }) => router.push({ pathname: '/food', params: { ...params, meal } });
  const reuse = (u: Usual) =>
    u.foodId
      ? openFood({ id: u.foodId })
      : router.push({ pathname: '/add', params: { name: u.name, calories: String(u.calories), proteinG: String(u.proteinG), carbG: String(u.carbG), fatG: String(u.fatG), meal } });
  const typeIt = () => router.push({ pathname: '/add', params: { name: q, meal } });
  const scan = () => router.push({ pathname: '/lens', params: { mode: 'barcode' } });
  const searchOff = () => {
    const term = q;
    setFromOff({ status: 'loading', query: term });
    offSearch.search(term).then(
      (items) => setFromOff({ status: 'done', query: term, items }),
      (e) => setFromOff({ status: 'problem', query: term, message: OFF_PROBLEM[e instanceof OffSearchError ? e.reason : 'failed'] }),
    );
  };

  const note =
    q.length < MIN_QUERY
      ? null
      : status === 'offline'
        ? 'Searching the food list needs the internet. Meals you had before still show up.'
        : status === 'failed'
          ? 'The food list is not answering. Try again in a moment.'
          : status === 'done' && foods.length === 0
            ? `Nothing called "${q}" in the food list yet.`
            : status === 'loading' && foods.length === 0 && mine.length === 0
              ? 'Searching…'
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

        {added.length ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, paddingLeft: 14, paddingRight: 6, borderRadius: radius.lg, backgroundColor: colors.raised }}>
            <Icon name="check" size={16} />
            <Text variant="small" style={{ flex: 1 }} numberOfLines={1}>
              Added {added.length === 1 ? added[0].name : `${added.length} foods`}, {fmt(added.reduce((s, e) => s + e.calories, 0))} kcal
            </Text>
            <Button title="Done" size="md" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : null}

        <SearchBar value={query} onChangeText={setQuery} busy={status === 'loading'} />

        {!typing ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Action icon="barcode" label="Barcode" a11y="Scan a barcode" onPress={scan} />
              <Action icon="scan" label="Photo" a11y="Photograph your plate" onPress={() => router.push('/lens')} />
              <Action icon="edit" label="Type it in" a11y="Type it in yourself" onPress={typeIt} />
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" tone="muted" accessibilityRole="header">
                Recent
              </Text>
              {recent.length ? (
                <List>
                  {recent.map((u) => (
                    <MealRow key={u.key} meal={u} query="" onPress={() => reuse(u)} />
                  ))}
                </List>
              ) : (
                <Text variant="small" tone="muted">
                  Search for a food or a brand, or scan the barcode on the pack. What you log shows up here for next time.
                </Text>
              )}
            </View>
          </>
        ) : (
          <>
            {mine.length || foods.length ? (
              <List>
                {mine.map((u) => (
                  <MealRow key={u.key} meal={u} query={q} onPress={() => reuse(u)} />
                ))}
                {foods.map((f) => (
                  <FoodRow key={f.id} food={f} query={q} onPress={() => openFood({ id: f.id })} />
                ))}
              </List>
            ) : null}
            {note ? (
              <Text variant="small" tone="muted">
                {note}
              </Text>
            ) : null}

            {off?.status === 'done' ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" tone="muted" accessibilityRole="header">
                  From Open Food Facts
                </Text>
                {off.items.length ? (
                  <List>
                    {off.items.map((h) => (
                      <FoodRow key={h.barcode} food={{ name: h.name, brand: h.brand, servingG: h.servingG, servingLabel: h.servingLabel, calories100g: h.calories100g }} query={q} onPress={() => openFood({ barcode: h.barcode })} />
                    ))}
                  </List>
                ) : (
                  <Text variant="small" tone="muted">
                    Open Food Facts has nothing called "{q}" either. Type it in from the pack, or scan its barcode.
                  </Text>
                )}
                <Text variant="caption" tone="muted">
                  Product data from Open Food Facts, available under the Open Database Licence (ODbL).
                </Text>
              </View>
            ) : null}

            <List>
              {q.length >= MIN_QUERY && off?.status !== 'done' ? (
                <ActionRow icon="search" label={`Search Open Food Facts for "${q}"`} detail={off?.status === 'problem' ? off.message : 'Millions of packaged foods from around the world'} busy={off?.status === 'loading'} onPress={searchOff} />
              ) : null}
              <ActionRow icon="edit" label={`Type in "${q}" yourself`} onPress={typeIt} />
              <ActionRow icon="barcode" label="Scan a barcode" onPress={scan} />
            </List>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** The search box: a magnifier, the text, and a button to clear it. */
function SearchBar({ value, onChangeText, busy }: { value: string; onChangeText: (t: string) => void; busy: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingLeft: 16, paddingRight: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
      <Icon name="search" size={20} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Search foods"
        placeholder="Search foods and brands"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        maxLength={80}
        style={{ flex: 1, minWidth: 0, minHeight: 50, color: colors.text, fontFamily: fontFamily[600], fontSize: 17 }}
      />
      {busy ? <ActivityIndicator size="small" /> : null}
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear the search" onPress={() => onChangeText('')} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rows in one rounded box with hairlines between them, like a drop-down. */
function List({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, marginLeft: 48, backgroundColor: colors.line }} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** A name with what was typed in bold. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <Text variant="body" numberOfLines={2}>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <Text key={i} variant="bodyStrong">
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}

function Row({ icon, title, query, detail, kcal, label, onPress }: { icon: IconName; title: string; query: string; detail: string; kcal: number; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: pressed ? colors.raised : 'transparent' })}>
      <Icon name={icon} size={18} color={colors.muted} />
      <View style={{ flex: 1, gap: 1 }}>
        <Highlighted text={title} query={query} />
        {detail ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text variant="small" tone="muted">
        {fmt(kcal)} kcal
      </Text>
    </Pressable>
  );
}

function MealRow({ meal, query, onPress }: { meal: Usual; query: string; onPress: () => void }) {
  const detail = [meal.quantityG ? `${fmt(meal.quantityG)} g` : null, meal.times > 1 ? `logged ${meal.times} times` : 'logged once'].filter(Boolean).join(' · ');
  return <Row icon="clock" title={meal.name} query={query} detail={detail} kcal={meal.calories} label={`${meal.name}, ${meal.calories} calories, ${detail}`} onPress={onPress} />;
}

function FoodRow({ food, query, onPress }: { food: Pick<Food, 'name' | 'brand' | 'servingG' | 'servingLabel' | 'calories100g'>; query: string; onPress: () => void }) {
  const d = describeFood(food);
  return <Row icon="search" title={food.name} query={query} detail={d.detail} kcal={d.kcal} label={`${food.name}${food.brand ? `, ${food.brand}` : ''}, ${d.kcal} calories per ${d.per}`} onPress={onPress} />;
}

function ActionRow({ icon, label, detail, busy, onPress }: { icon: IconName; label: string; detail?: string; busy?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy }} disabled={busy} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: pressed ? colors.raised : 'transparent' })}>
      <Icon name={icon} size={18} color={colors.accentText} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {busy ? <ActivityIndicator size="small" /> : null}
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
