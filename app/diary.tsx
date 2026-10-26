import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { dateAt, mealForTime, shiftDate, weekStart, type MealType } from '../src/data/dates';
import { mealLabel, portionText } from '../src/data/entryForm';
import { atDate, entryLike, mealTimeOn, sourceText, type Usual } from '../src/data/history';
import { useDay, useGoals, useLastMeal, useToday, useUsuals, useWeek } from '../src/data/hooks';
import type { DiaryEntry } from '../src/data/repo';
import { useTheme } from '../src/theme/theme';
import { brand, radius, spacing } from '../src/theme/tokens';
import { EmptyState, Icon, IconButton, Screen, Text } from '../src/ui';
import { EntryThumb } from '../src/ui/EntryThumb';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');
const time = (at: number) => new Date(at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
const weekday = (d: string, style: 'short' | 'long' = 'long') => dateAt(d).toLocaleDateString('en-ZA', { weekday: style });

/** Any day's meals: a week strip with how each day went, the timeline, quick ways to fill a gap. */
export default function Diary() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = useToday();
  const [date, setDate] = useState(params.date ?? today);
  const { colors } = useTheme();
  const goals = useGoals();
  const week = useWeek(date);
  const day = useDay(date);
  const isToday = date === today;
  const eaten = day?.totals.calories ?? 0;
  const left = goals.calories - eaten;
  const month = dateAt(date).toLocaleDateString('en-ZA', { month: 'long', year: date.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text variant="h2" accessibilityRole="header">
            Diary
          </Text>
          <Text variant="small" tone="muted">
            {month}
          </Text>
        </View>
        {!isToday ? <IconButton icon="calendar" label="Go to today" onPress={() => setDate(today)} /> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <IconButton icon="back" label="Previous week" onPress={() => setDate(shiftDate(date, -7))} style={{ width: 32, borderWidth: 0, backgroundColor: 'transparent' }} />
        <View accessibilityRole="radiogroup" style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {week?.days.map((d) => {
            const kcal = week.calories.get(d);
            const future = d > today;
            const on = d === date;
            const dot = kcal === undefined ? 'transparent' : kcal > goals.calories ? brand.amber : brand.lime;
            return (
              <Pressable
                key={d}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: future }}
                accessibilityLabel={`${weekday(d)} ${dateAt(d).getDate()}${kcal === undefined ? ', nothing logged' : `, ${kcal} calories${kcal > goals.calories ? ', over goal' : ''}`}`}
                disabled={future}
                onPress={() => setDate(d)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: on ? colors.accent : future ? 'transparent' : colors.surface,
                  borderWidth: future ? 1 : 0,
                  borderStyle: 'dashed',
                  borderColor: colors.line,
                }}
              >
                <Text variant="caption" style={{ color: on ? colors.onAccent : colors.muted }}>
                  {weekday(d, 'short')}
                </Text>
                <Text variant="bodyStrong" style={{ color: on ? colors.onAccent : future ? colors.muted : colors.text }}>
                  {dateAt(d).getDate()}
                </Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on && kcal !== undefined ? colors.onAccent : dot }} />
              </Pressable>
            );
          })}
        </View>
        {weekStart(date) < weekStart(today) ? (
          <IconButton
            icon="chevron"
            label="Next week"
            onPress={() => setDate(shiftDate(date, 7) > today ? today : shiftDate(date, 7))}
            style={{ width: 32, borderWidth: 0, backgroundColor: 'transparent' }}
          />
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="number" style={{ fontSize: 28 }}>
            {fmt(eaten)}
          </Text>
          <Text variant="small" tone="muted">
            kcal eaten{isToday ? '' : ` on ${weekday(date)}`}
          </Text>
        </View>
        <Text variant="label" tone={left < 0 ? 'bad' : 'accent'}>
          {left < 0 ? `${fmt(-left)} over` : `${fmt(left)} left`}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {day?.entries.map((e) => <TimelineRow key={e.id} entry={e} />)}
        {day && day.entries.length === 0 && !isToday ? <EmptyState pose="sleep" title={`Nothing logged on ${weekday(date)}`} body="Add a usual below, or copy a meal from another day." /> : null}
        {isToday ? <Later date={date} /> : null}
      </View>

      <Usuals date={date} today={today} />
    </Screen>
  );
}

function TimelineRow({ entry }: { entry: DiaryEntry }) {
  const { colors } = useTheme();
  const portion = portionText(entry);
  const detail = `${mealLabel(entry.mealType)}, ${sourceText(entry.source)}${portion ? ` · ${portion}` : ''}`;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Text variant="caption" tone="muted" style={{ width: 42, paddingTop: 24 }}>
        {time(entry.loggedAt)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}, ${entry.calories} calories, ${detail}, ${time(entry.loggedAt)}`}
        accessibilityHint="Opens it to change or delete"
        onPress={() => router.push({ pathname: '/add', params: { id: entry.id } })}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 70, paddingLeft: spacing.sm, paddingRight: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
      >
        <EntryThumb entry={entry} size={54} rounded={15} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {entry.name}
          </Text>
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        </View>
        <Text variant="bodyStrong">{fmt(entry.calories)}</Text>
      </Pressable>
    </View>
  );
}

/** The next meal not logged yet today: copy it from the last time, or see what fits. */
function Later({ date }: { date: string }) {
  const { colors } = useTheme();
  const { repo } = useData();
  const day = useDay(date);
  const meal: MealType = mealForTime();
  const last = useLastMeal(date, meal);
  if (!day || day.entries.some((e) => e.mealType === meal)) return null;
  const copy = async () => {
    if (!last) return;
    Haptics.selectionAsync().catch(() => {});
    for (const e of last.entries) await repo.addEntry(entryLike(e, meal, atDate(date, Date.now())));
  };
  const lastName = last ? (last.date === shiftDate(date, -1) ? 'yesterday' : weekday(last.date)) : null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Text variant="caption" tone="muted" style={{ width: 42, paddingTop: 18 }}>
        Later
      </Text>
      <View style={{ flex: 1, padding: 14, gap: 10, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.lineStrong }}>
        <Text variant="bodyStrong">{mealLabel(meal)}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {last && lastName ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy ${lastName}'s ${mealLabel(meal).toLowerCase()}, ${fmt(last.entries.reduce((s, e) => s + e.calories, 0))} calories`}
              onPress={copy}
              style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text variant="label">Copy {lastName === 'yesterday' ? "yesterday's" : `${lastName}'s`}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/fits')}
            style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="label" tone="onAccent">
              What fits?
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Usuals({ date, today }: { date: string; today: string }) {
  const { colors } = useTheme();
  const { repo } = useData();
  const usuals = useUsuals(today);
  const add = (u: Usual) => {
    Haptics.selectionAsync().catch(() => {});
    const meal = date === today ? mealForTime() : u.mealType;
    const at = date === today ? Date.now() : mealTimeOn(date, meal);
    repo.addEntry(entryLike(u, meal, at)).catch((e) => console.warn(e));
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3" style={{ fontSize: 16 }}>
          Your usuals
        </Text>
        <Text variant="caption" tone="muted">
          Learned from your last 30 days
        </Text>
      </View>
      {usuals && usuals.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {usuals.map((u) => (
            <Pressable
              key={u.key}
              accessibilityRole="button"
              accessibilityLabel={`Add ${u.name}, ${u.calories} calories`}
              onPress={() => add(u)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 44, paddingLeft: 14, paddingRight: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 })}
            >
              <Text variant="label" numberOfLines={1} style={{ maxWidth: 160 }}>
                {u.name}
              </Text>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={14} color={colors.accentText} strokeWidth={3} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text variant="small" tone="muted">
          Log the same meal twice and it shows up here, ready to add in one tap.
        </Text>
      )}
    </View>
  );
}
