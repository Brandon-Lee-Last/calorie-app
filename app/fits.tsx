import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { mealForTime } from '../src/data/dates';
import { mealLabel } from '../src/data/entryForm';
import { LOCAL_IDEAS, ideasFromHistory, portionNote, suggest, type Fit, type Remaining } from '../src/data/fits';
import { entryLike } from '../src/data/history';
import { useDay, useGoals, useMealHistory, useToday } from '../src/data/hooks';
import { Pango } from '../src/pango/Pango';
import { useTheme } from '../src/theme/theme';
import { brand, radius, spacing } from '../src/theme/tokens';
import { EmptyState, IconButton, Screen, Text } from '../src/ui';

type Filter = 'mine' | 'protein' | 'local';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'mine', label: 'Your meals' },
  { value: 'protein', label: 'Most protein' },
  { value: 'local', label: 'Local ideas' },
];
const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');

/** Ideas for the next meal that fit what is left today, scaled down when they would not. */
export default function WhatFits() {
  const { colors } = useTheme();
  const { repo } = useData();
  const today = useToday();
  const goals = useGoals();
  const day = useDay(today);
  const history = useMealHistory(today);
  const [filter, setFilter] = useState<Filter>('mine');
  const [logged, setLogged] = useState<Record<string, string>>({});
  const meal = mealForTime();

  const totals = day?.totals ?? { calories: 0, proteinG: 0, carbG: 0, fatG: 0 };
  const left: Remaining = {
    calories: Math.max(0, goals.calories - totals.calories),
    proteinG: Math.max(0, goals.proteinG - totals.proteinG),
    carbG: Math.max(0, goals.carbG - totals.carbG),
    fatG: Math.max(0, goals.fatG - totals.fatG),
  };
  const mine = ideasFromHistory(history ?? [], today);
  const ideas = filter === 'mine' ? suggest(mine, left, 'fit') : filter === 'protein' ? suggest([...mine, ...LOCAL_IDEAS], left, 'protein') : suggest(LOCAL_IDEAS, left, 'fit');

  const toggle = async (f: Fit) => {
    Haptics.selectionAsync().catch(() => {});
    const id = logged[f.key];
    if (id) {
      await repo.deleteEntry(id);
      setLogged(({ [f.key]: _, ...rest }) => rest);
      return;
    }
    const entry = await repo.addEntry({
      ...entryLike({ name: f.name, calories: f.kcal, proteinG: f.protein, carbG: f.carbs, fatG: f.fat, quantityG: f.quantityG ? Math.round(f.quantityG * f.portion) : null }, meal, Date.now()),
    });
    setLogged((l) => ({ ...l, [f.key]: entry.id }));
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text variant="h2" accessibilityRole="header">
            What fits?
          </Text>
          <Text variant="small" tone="muted">
            {mealLabel(meal)} ideas for what is left today
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 14, paddingHorizontal: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: colors.raised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Pango pose="think" crop="face" size={44} />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`Left today: ${fmt(left.calories)} calories, ${fmt(left.proteinG)} grams protein, ${fmt(left.carbG)} carbs, ${fmt(left.fatG)} fat`}>
          <Left value={fmt(left.calories)} label="kcal" color={colors.accentText} />
          <Left value={`${fmt(left.proteinG)} g`} label="protein" color={colors.protein} />
          <Left value={`${fmt(left.carbG)} g`} label="carbs" color={colors.carbs} />
          <Left value={`${fmt(left.fatG)} g`} label="fat" color={colors.fat} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <Pressable
              key={f.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setFilter(f.value)}
              style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.line }}
            >
              <Text variant="label" style={{ color: on ? colors.onAccent : colors.text }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {left.calories <= 0 ? (
        <EmptyState pose="cheer" title="That is today's energy used" body="You have reached your goal for today. Water, tea or a walk are always on the menu." />
      ) : ideas.length === 0 ? (
        <EmptyState
          pose="think"
          title={filter === 'mine' ? 'No meals of yours fit yet' : 'Nothing fits what is left'}
          body={filter === 'mine' ? 'Pango learns from what you log. Try the local ideas meanwhile.' : 'Even half portions are bigger than what is left today.'}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {ideas.map((f) => (
            <IdeaCard key={f.key} fit={f} left={left.calories} logged={!!logged[f.key]} onToggle={() => toggle(f).catch((e) => console.warn(e))} />
          ))}
        </View>
      )}

      <Text variant="caption" tone="muted" align="center">
        Ideas come from your own meals and common South African dishes. Local ideas use typical values, so treat them as a rough guide. Portions shrink to fit what is
        left.
      </Text>
    </Screen>
  );
}

function Left({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="h3" style={{ color }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function IdeaCard({ fit, left, logged, onToggle }: { fit: Fit; left: number; logged: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const note = portionNote(fit.portion);
  return (
    <View style={{ padding: 14, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Plate colours={fit.colours} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong">{note ? `${fit.name}, ${note}` : fit.name}</Text>
          <Text variant="caption" tone="muted">
            {fit.meta}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="h3">{fmt(fit.kcal)}</Text>
          <Text variant="caption" tone="muted">
            kcal
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track }}>
            <View style={{ width: `${Math.min(100, Math.round((fit.kcal / left) * 100))}%`, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="protein">
              {fmt(fit.protein)} g protein
            </Text>
            <Text variant="caption" tone="muted">
              {fit.leaves > 0 ? `Leaves ${fmt(fit.leaves)} kcal` : 'Uses it all'}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={logged ? `Logged ${fit.name}. Tap to undo` : `Log ${fit.name}, ${fit.kcal} calories`}
          onPress={onToggle}
          style={{ height: 44, minWidth: 84, paddingHorizontal: spacing.lg, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: logged ? brand.lime : colors.raised, borderWidth: 1, borderColor: logged ? brand.lime : colors.line }}
        >
          <Text variant="label" style={{ fontSize: 14, color: logged ? brand.ink : colors.text }}>
            {logged ? 'Logged' : 'Log it'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A tiny drawn plate in the food's colours (no photos for ideas). */
function Plate({ colours: [a, b, c] }: { colours: [string, string, string] }) {
  return (
    <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: '#2B211A', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 6, top: 6, width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECE6DA' }} />
      <View style={{ position: 'absolute', left: 13, top: 15, width: 22, height: 18, borderRadius: 9, backgroundColor: a }} />
      <View style={{ position: 'absolute', left: 29, top: 24, width: 20, height: 16, borderRadius: 8, backgroundColor: b }} />
      <View style={{ position: 'absolute', left: 16, top: 34, width: 16, height: 10, borderRadius: 5, backgroundColor: c }} />
    </View>
  );
}
