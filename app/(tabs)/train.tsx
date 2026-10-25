import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { unwrap } from '../../src/api/client';
import type { components } from '../../src/api/schema';
import { dateAt, weekOf, weekStart } from '../../src/data/dates';
import { isPlus } from '../../src/data/entitlement';
import { useBurned, useCachedApi, useEntitlement, useSettings, useToday, useWorkouts } from '../../src/data/hooks';
import { MyPango } from '../../src/pango/MyPango';
import { useTheme } from '../../src/theme/theme';
import { brand, radius, spacing } from '../../src/theme/tokens';
import { BUILT_IN, type PlannedWorkout } from '../../src/train/library';
import { Card, Icon, Screen, Segmented, Text, type IconName } from '../../src/ui';

type ProgramSummary = components['schemas']['ProgramSummary'];
type Enrollment = components['schemas']['Enrollment'];
type Filter = 'foryou' | 'home' | 'gym' | 'quick';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'foryou', label: 'For you' },
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
  { value: 'quick', label: 'Quick' },
];
const EAT_BACK = [
  { value: 'none', label: 'None' },
  { value: 'half', label: 'Half' },
  { value: 'all', label: 'All' },
] as const;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week's training, what is up next, energy burned and the workouts on offer. */
export default function Train() {
  const { colors } = useTheme();
  const today = useToday();
  const plus = isPlus(useEntitlement());
  const [settings, update] = useSettings();
  const week = weekOf(today);
  const workouts = useWorkouts(weekStart(today)) ?? [];
  const { burned, added } = useBurned(today);
  const [filter, setFilter] = useState<Filter>('foryou');
  const programs = useCachedApi('programs', async (api) => (await unwrap(api.GET('/v1/programs'))).items, []);
  const current = useCachedApi('programs/current', async (api) => (await unwrap(api.GET('/v1/programs/current'))).enrollment, []);

  const doneDays = new Set(workouts.map((w) => w.localDate));
  const minutes = Math.round(workouts.reduce((s, w) => s + ((w.finishedAt ?? w.startedAt) - w.startedAt) / 60_000, 0));
  const enrollment = current.data?.status === 'active' ? current.data : null;
  const target = enrollment?.program.daysPerWeek ?? settings.workoutsPerWeek;
  const suggestion = BUILT_IN[(dateAt(today).getDay() + 6) % BUILT_IN.length];
  const list = listFor(filter, BUILT_IN, programs.data ?? [], enrollment);

  return (
    <Screen gap={12}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Text variant="title">Train</Text>
        {plus ? (
          <View style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
            <Text variant="label">Plus</Text>
          </View>
        ) : null}
      </View>

      <Card padding={16} style={{ gap: 10, borderRadius: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text variant="eyebrow" tone="muted">
              This week
            </Text>
            <Text variant="h2" style={{ fontSize: 20 }}>
              {doneDays.size} of {target} workouts
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyStrong">{minutes} min</Text>
            <Text variant="caption" tone="muted">
              active
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessible accessibilityLabel={`Worked out on ${week.filter((d) => doneDays.has(d)).map((d) => dateAt(d).toLocaleDateString('en-ZA', { weekday: 'long' })).join(', ') || 'no days yet'} this week`}>
          {week.map((d, i) => {
            const done = doneDays.has(d);
            const isToday = d === today;
            return (
              <View key={d} style={{ alignItems: 'center', gap: 4 }}>
                <Text variant="caption" style={{ fontSize: 11, color: isToday ? colors.accentText : colors.muted }}>
                  {LETTERS[i]}
                </Text>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? brand.lime : d < today ? colors.track : 'transparent',
                    borderWidth: done || d < today ? 0 : isToday ? 3 : 1,
                    borderStyle: isToday ? 'solid' : 'dashed',
                    borderColor: isToday ? colors.accent : colors.lineStrong,
                  }}
                >
                  {done ? <Icon name="check" size={16} color={brand.ink} strokeWidth={3.4} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <UpNext enrollment={enrollment} suggestion={suggestion} />

      <Card padding={16} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="flame" size={20} color={colors.warn} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{burned} kcal burned today</Text>
            <Text variant="caption" tone="muted">
              {settings.eatBack === 'none' ? 'Burned energy stays out of your food budget' : burned ? `Adds ${added} kcal to today's food. Estimates can run high` : 'Workouts you log here count towards it'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text variant="label" tone="muted">
            Add back to food
          </Text>
          <Segmented options={EAT_BACK} value={settings.eatBack} onChange={(eatBack) => update({ eatBack })} />
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <Pressable
              key={f.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setFilter(f.value)}
              style={{ height: 44, paddingHorizontal: spacing.lg, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.line }}
            >
              <Text variant="label" style={{ color: on ? colors.onAccent : colors.text }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: spacing.sm }}>
        {list.map((row) => (
          <Row key={row.key} row={row} plus={plus} />
        ))}
        {programs.error && !programs.data ? (
          <Text variant="caption" tone="muted" align="center">
            Programs load when you are online. The quick workouts above work any time.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

type ListRow = { key: string; title: string; meta: string; icon: IconName; tint: 'protein' | 'good' | 'fat' | 'carbs'; badge: 'Current' | 'Plus' | 'Free'; open: () => void };

function listFor(filter: Filter, builtIn: PlannedWorkout[], programs: ProgramSummary[], enrollment: Enrollment | null): ListRow[] {
  const workoutRows: ListRow[] = builtIn
    .filter((w) => filter === 'foryou' || w.place === filter)
    .map((w) => ({
      key: w.key,
      title: w.title,
      meta: `${w.minutes} min, ${w.exercises.length} exercises${w.exercises.some((e) => e.equipment.length) ? ', dumbbells' : ', no kit'}`,
      icon: w.kind === 'mobility' ? 'sparkle' : w.kind === 'cardio' ? 'bolt' : 'train',
      tint: w.kind === 'mobility' ? 'fat' : w.kind === 'cardio' ? 'good' : 'protein',
      badge: 'Free',
      open: () => router.push({ pathname: '/workout', params: { key: w.key } }),
    }));
  const programRows: ListRow[] = programs
    .filter((p) => filter === 'foryou' || (filter === 'home' ? p.equipment.every((e) => e === 'bodyweight' || e === 'bands') : filter === 'gym' ? p.equipment.some((e) => e !== 'bodyweight') : p.daysPerWeek <= 3))
    .map((p) => ({
      key: `program:${p.slug}`,
      title: p.title,
      meta: `${p.level[0].toUpperCase()}${p.level.slice(1)}, ${p.weeks} weeks, ${p.daysPerWeek} a week`,
      icon: 'calendar',
      tint: 'carbs',
      badge: enrollment?.program.slug === p.slug ? 'Current' : p.tier === 'pro' ? 'Plus' : 'Free',
      open: () => router.push({ pathname: '/program', params: { slug: p.slug } }),
    }));
  return filter === 'foryou' ? [...programRows, ...workoutRows] : [...workoutRows, ...programRows];
}

function UpNext({ enrollment, suggestion }: { enrollment: Enrollment | null; suggestion: PlannedWorkout }) {
  const { colors } = useTheme();
  const next = enrollment?.progress.nextWorkout;
  const title = next ? next.title : suggestion.title;
  const eyebrow = next ? `Up next, week ${next.week} day ${next.day}` : 'Try today';
  const meta = next ? `${next.estMinutes ? `${next.estMinutes} min, ` : ''}${next.exerciseCount} exercises, ${enrollment!.program.title}` : `${suggestion.minutes} min, ${suggestion.exercises.length} exercises`;
  const start = () => (next ? router.push({ pathname: '/workout', params: { id: next.id, program: enrollment!.program.id } }) : router.push({ pathname: '/workout', params: { key: suggestion.key } }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: spacing.lg, paddingRight: spacing.sm, borderRadius: 28, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="eyebrow" tone="accent" style={{ fontSize: 11 }}>
          {eyebrow}
        </Text>
        <Text variant="h2" style={{ fontSize: 21 }}>
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {meta}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${title}`}
          onPress={start}
          disabled={next?.locked}
          style={{ alignSelf: 'flex-start', marginTop: 4, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
          <Icon name="play" size={16} color={colors.onAccent} />
          <Text variant="bodyStrong" tone="onAccent">
            Start workout
          </Text>
        </Pressable>
      </View>
      <MyPango pose="cheer" outfit="gym" size={104} />
    </View>
  );
}

function Row({ row, plus }: { row: ListRow; plus: boolean }) {
  const { colors } = useTheme();
  const tint = colors[row.tint];
  const badge =
    row.badge === 'Current'
      ? { bg: colors.accent, fg: colors.onAccent, border: colors.accent }
      : row.badge === 'Plus'
        ? { bg: colors.raised, fg: colors.text, border: colors.lineStrong }
        : { bg: `${brand.lime}22`, fg: colors.goodText, border: 'transparent' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${row.meta}, ${row.badge === 'Plus' && !plus ? 'Plus' : row.badge}`}
      onPress={row.open}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingLeft: 10, paddingRight: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${tint}22`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={row.icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{row.title}</Text>
        <Text variant="caption" tone="muted">
          {row.meta}
        </Text>
      </View>
      <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', backgroundColor: badge.bg, borderWidth: 1, borderColor: badge.border }}>
        <Text variant="caption" style={{ color: badge.fg }}>
          {row.badge}
        </Text>
      </View>
    </Pressable>
  );
}
