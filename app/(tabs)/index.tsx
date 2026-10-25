import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useData } from '../../src/data/DataProvider';
import { mealForTime } from '../../src/data/dates';
import { mealLabel } from '../../src/data/entryForm';
import { useBurned, useDay, useGoals, useSettings, useStreak, useSyncStatus, useToday, useWater } from '../../src/data/hooks';
import type { DiaryEntry } from '../../src/data/repo';
import { EntryThumb, MEAL_TINT } from '../../src/ui/EntryThumb';
import { describeSync } from '../../src/data/syncText';
import { MyPango } from '../../src/pango/MyPango';
import { useTheme } from '../../src/theme/theme';
import { radius, spacing } from '../../src/theme/tokens';
import { Card, Icon, IconButton, ProgressBar, Ring, Screen, Text } from '../../src/ui';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');
const time = (at: number) => new Date(at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

export default function Today() {
  const { colors } = useTheme();
  const today = useToday();
  const day = useDay(today);
  const plan = useGoals();
  const { added } = useBurned(today);
  // Energy burned training adds to the day's food (the share is set on Train).
  const goals = { ...plan, calories: plan.calories + added };
  const streak = useStreak(today) ?? 0;
  const totals = day?.totals ?? { entries: 0, calories: 0, proteinG: 0, carbG: 0, fatG: 0 };
  const left = goals.calories - totals.calories;
  const date = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
  const nextMeal = mealLabel(mealForTime()).toLowerCase();
  const macros = [
    { key: 'protein', label: 'Protein', eaten: totals.proteinG, goal: goals.proteinG },
    { key: 'carbs', label: 'Carbs', eaten: totals.carbG, goal: goals.carbG },
    { key: 'fat', label: 'Fat', eaten: totals.fatG, goal: goals.fatG },
  ] as const;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <MyPango crop="face" size={40} motion={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h2">Hey there</Text>
          <Text variant="small" tone="muted">
            {date}
          </Text>
        </View>
        <View accessibilityLabel={`${streak} day streak`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: 18, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
          <Icon name="flame" size={16} color={streak ? colors.warn : colors.muted} />
          <Text variant="label">
            {streak} {streak === 1 ? 'day' : 'days'}
          </Text>
        </View>
        <IconButton icon="calendar" label="Open the diary" onPress={() => router.push('/diary')} />
      </View>

      <Card padding={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Ring value={totals.calories / goals.calories} label={`${fmt(totals.calories)} of ${fmt(goals.calories)} calories eaten`}>
          <Text variant="number">{fmt(totals.calories)}</Text>
          <Text variant="caption" tone="muted">
            of {fmt(goals.calories)} kcal
          </Text>
          {added ? (
            <Text variant="caption" tone="good">
              +{fmt(added)} from training
            </Text>
          ) : null}
        </Ring>
        <View style={{ flex: 1, gap: spacing.md }}>
          {macros.map((m) => (
            <View key={m.key} style={{ gap: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone={m.key}>
                  {m.label}
                </Text>
                <Text variant="caption">
                  {fmt(m.eaten)} / {m.goal} g
                </Text>
              </View>
              <ProgressBar value={m.goal ? m.eaten / m.goal : 0} color={colors[m.key]} label={`${m.label} ${fmt(m.eaten)} of ${m.goal} grams`} />
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text variant="h3">Meals</Text>
        <Text variant="label" tone={left < 0 ? 'bad' : 'accent'}>
          {left < 0 ? `${fmt(-left)} kcal over` : `${fmt(left)} kcal left`}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {day && day.entries.length === 0 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <MyPango pose="think" size={72} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">Nothing logged yet today</Text>
              <Text variant="small" tone="muted">
                Scan your plate with the button below, or add a meal yourself.
              </Text>
            </View>
          </Card>
        ) : (
          day?.entries.map((e) => <EntryRow key={e.id} entry={e} />)
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/search', params: { meal: mealForTime() } })}
            style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.lineStrong, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="plus" size={18} color={colors.muted} />
            <Text variant="bodyStrong" tone="muted">
              Add {nextMeal}
            </Text>
          </Pressable>
          {left > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`What fits in ${fmt(left)} calories?`}
              onPress={() => router.push('/fits')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 54, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}
            >
              <Icon name="sparkle" size={18} color={colors.accentText} />
              <Text variant="bodyStrong">What fits?</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <WaterCard date={today} />
      <SyncLine />
    </Screen>
  );
}

function EntryRow({ entry }: { entry: DiaryEntry }) {
  const { colors } = useTheme();
  const scanned = entry.source === 'scan';
  const detail = `${mealLabel(entry.mealType)}, ${time(entry.loggedAt)}${scanned ? ', scanned' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${entry.calories} calories, ${detail}`}
      accessibilityHint="Opens it to change or delete"
      onPress={() => router.push({ pathname: '/add', params: { id: entry.id } })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 62, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
    >
      <EntryThumb entry={entry} />
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
  );
}

function WaterCard({ date }: { date: string }) {
  const { colors } = useTheme();
  const { repo } = useData();
  const ml = useWater(date) ?? 0;
  const [{ waterGoalMl, glassMl }] = useSettings();
  const glasses = Math.min(12, Math.max(1, Math.round(waterGoalMl / glassMl)));
  const filled = Math.min(glasses, Math.floor(ml / glassMl));
  const litres = (n: number) => (n / 1000).toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  const add = () => {
    Haptics.selectionAsync().catch(() => {});
    repo.addWater(glassMl).catch((e) => console.warn(e));
  };
  const remove = () => {
    Haptics.selectionAsync().catch(() => {});
    repo.removeLastWater(date).catch((e) => console.warn(e));
  };
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Icon name="drop" size={22} color={colors.water} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          Water
        </Text>
        <Text variant="label" tone="muted">
          {litres(ml)} / {litres(waterGoalMl)} L
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View accessible accessibilityLabel={`${filled} of ${glasses} glasses`} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: glasses }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: i < filled ? colors.water : colors.track }} />
          ))}
        </View>
        <IconButton icon="minus" label="Take back a glass" onPress={remove} />
        <IconButton icon="plus" label={`Add a glass, ${glassMl} millilitres`} tone="accent" onPress={add} />
      </View>
    </Card>
  );
}

function SyncLine() {
  const line = describeSync(useSyncStatus());
  return (
    <Text variant="caption" tone={line.tone} align="center">
      {line.text}
    </Text>
  );
}
