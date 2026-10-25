import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { dateAt, shiftDate } from '../../src/data/dates';
import { isPlus } from '../../src/data/entitlement';
import { useCaloriesByDay, useEntitlement, useGoals, useProfile, useToday, useWeights } from '../../src/data/hooks';
import { RANGES, dayMark, lastWeek, monthGrid, rangeText, signed, weightSeries, type DayMark, type Range } from '../../src/data/progress';
import { MyPango } from '../../src/pango/MyPango';
import { useTheme } from '../../src/theme/theme';
import { brand, radius, spacing } from '../../src/theme/tokens';
import { Button, Card, Icon, Screen, Segmented, Text } from '../../src/ui';
import { LineChart } from '../../src/ui/LineChart';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Weight trend, the weekly recap and how each day of the month went. */
export default function Progress() {
  const { colors } = useTheme();
  const today = useToday();
  const goals = useGoals();
  const profile = useProfile();
  const plus = isPlus(useEntitlement());
  const [range, setRange] = useState<Range>('month');
  const weights = useWeights(shiftDate(today, -365));
  const series = weightSeries(weights ?? [], today, range);
  const lockedYear = range === 'year' && !plus;
  const week = lastWeek(today);
  const month = today.slice(0, 7);
  const cells = monthGrid(today);
  const calories = useCaloriesByDay(`${month}-01`, `${month}-31`);
  const target = profile?.targetWeightKg;
  // Losing weight is the usual goal; colour the change by whether it moves towards the target, if there is one.
  const good = series.delta === null || !profile ? null : target ? Math.sign(target - (series.latest ?? 0)) === Math.sign(series.delta) || series.delta === 0 : profile.goal === 'gain' ? series.delta >= 0 : series.delta <= 0;

  return (
    <Screen gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Text variant="title">Progress</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={target ? `Goal weight ${target} kilograms. Change it` : 'Set a goal weight'}
          onPress={() => router.push({ pathname: '/weigh', params: { mode: 'target' } })}
          style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}
        >
          <Text variant="label">{target ? `Goal ${target.toLocaleString('en-ZA')} kg` : 'Set a goal weight'}</Text>
        </Pressable>
      </View>

      <Segmented options={RANGES} value={range} onChange={setRange} stretch />

      <Card padding={16} style={{ gap: 10, borderRadius: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text variant="eyebrow" tone="muted">
              Weight
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text variant="number">{series.latest !== null ? series.latest.toLocaleString('en-ZA') : '–'}</Text>
              <Text variant="bodyStrong" tone="muted">
                kg
              </Text>
            </View>
          </View>
          {series.delta !== null && !lockedYear ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="bodyStrong" style={{ color: good === false ? colors.warn : colors.goodText }}>
                {signed(series.delta)} kg
              </Text>
              <Text variant="caption" tone="muted">
                {series.since}
              </Text>
            </View>
          ) : null}
        </View>
        {lockedYear ? (
          <View style={{ height: 130, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Icon name="lock" size={22} color={colors.muted} />
            <Text variant="small" tone="muted" align="center">
              A year of trends comes with Plus.
            </Text>
            <Button title="See Plus" size="md" variant="secondary" onPress={() => router.push('/plus')} />
          </View>
        ) : series.points.length ? (
          <>
            <LineChart points={series.points} label={`Weight trend: ${series.latest} kilograms${series.delta !== null ? `, ${signed(series.delta)} ${series.since}` : ''}`} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {series.ticks.map((t, i) => (
                <Text key={i} variant="caption" tone="muted" style={{ fontSize: 11 }}>
                  {t}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <View style={{ height: 130, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="small" tone="muted" align="center">
              No weigh-ins in this range yet.
            </Text>
          </View>
        )}
        <Button title="Log my weight" icon="plus" size="md" variant="secondary" onPress={() => router.push('/weigh')} />
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open your weekly recap for ${rangeText(week.start, week.end)}`}
        onPress={() => router.push({ pathname: '/recap', params: { start: week.start } })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, paddingLeft: spacing.sm, paddingRight: 14, borderRadius: radius.xl, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accent, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <MyPango pose="cheer" crop="face" size={42} motion={false} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Your weekly recap is ready</Text>
          <Text variant="caption" tone="muted">
            {rangeText(week.start, week.end)}, three quick cards
          </Text>
        </View>
        <Icon name="chevron" size={20} color={colors.muted} />
      </Pressable>

      <Card padding={16} style={{ gap: 10, borderRadius: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Text variant="bodyStrong">{dateAt(today).toLocaleDateString('en-ZA', { month: 'long' })}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Legend color={brand.lime} label="On target" />
            <Legend color={brand.amber} label="Logged" />
            <Legend color={colors.line} label="Missed" />
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} variant="caption" tone="muted" align="center" style={{ flex: 1, fontSize: 11 }}>
              {d}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 5 }}>
          {cells.map((d, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, paddingHorizontal: 2.5 }}>
              {d ? <DayCell date={d} mark={dayMark(d, calories?.get(d), goals.calories, today)} today={d === today} kcal={calories?.get(d)} /> : <View style={{ height: 30 }} />}
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" tone="muted" style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

const MARK_TEXT: Record<DayMark, string> = { on: 'on target', logged: 'logged, off target', missed: 'nothing logged', future: 'still to come', 'today-empty': 'today, nothing logged yet' };

function DayCell({ date, mark, today, kcal }: { date: string; mark: DayMark; today: boolean; kcal?: number }) {
  const { colors } = useTheme();
  const bg = { on: brand.lime, logged: brand.amber, missed: colors.line, future: 'transparent', 'today-empty': 'transparent' }[mark];
  const fg = mark === 'on' || mark === 'logged' ? brand.ink : colors.muted;
  return (
    <View
      accessible
      accessibilityLabel={`${dateAt(date).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}, ${MARK_TEXT[mark]}${kcal !== undefined ? `, ${kcal} calories` : ''}`}
      style={{
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: mark === 'future' || mark === 'today-empty' ? 1 : 0,
        borderStyle: 'dashed',
        borderColor: today ? colors.accent : colors.line,
        ...(today && mark !== 'today-empty' ? { borderWidth: 2, borderStyle: 'solid' as const, borderColor: colors.accent } : {}),
      }}
    >
      <Text variant="caption" style={{ fontSize: 11, color: fg }}>
        {Number(date.slice(8))}
      </Text>
    </View>
  );
}
