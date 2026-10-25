import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { unwrap } from '../src/api/client';
import { useData } from '../src/data/DataProvider';
import { useProfile } from '../src/data/hooks';
import { MyPango } from '../src/pango/MyPango';
import { useTheme } from '../src/theme/theme';
import { brand, radius, spacing } from '../src/theme/tokens';
import { builtInByKey, caloriesBurned, fromServer, usesWeight, type PlannedWorkout } from '../src/train/library';
import { clock, setText, startSets, targetText, toSetLogs, type LiveSet, type SetLog } from '../src/train/session';
import { Button, EmptyState, Icon, IconButton, Screen, Text } from '../src/ui';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; plan: PlannedWorkout };

/** A workout in progress: log each set, rest between them, then save the session. */
export default function Workout() {
  const params = useLocalSearchParams<{ key?: string; id?: string; program?: string }>();
  const { api, repo } = useData();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    if (params.key) {
      const plan = builtInByKey(params.key);
      setLoad(plan ? { kind: 'ready', plan } : { kind: 'error', message: 'That workout is not in this version of the app.' });
    } else if (params.id) {
      unwrap(api.GET('/v1/workouts/{id}', { params: { path: { id: params.id } } })).then(
        (w) => setLoad({ kind: 'ready', plan: fromServer(w, params.program ?? null) }),
        (e) => setLoad({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
      );
    } else setLoad({ kind: 'error', message: 'No workout was chosen.' });
  }, [api, params.key, params.id, params.program]);

  const last = useLastSets(repo);
  if (load.kind === 'loading')
    return (
      <Screen>
        <EmptyState pose="roll" title="Getting the workout ready" />
      </Screen>
    );
  if (load.kind === 'error')
    return (
      <Screen>
        <EmptyState pose="oops" title="This workout did not load" body={load.message} action={<Button title="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  return <Session plan={load.plan} last={last} />;
}

/** The latest logged sets for each exercise, for the "last time" column and starting numbers. */
function useLastSets(repo: ReturnType<typeof useData>['repo']): Map<string, SetLog[]> {
  const [last, setLast] = useState(new Map<string, SetLog[]>());
  useEffect(() => {
    repo.workouts('0000-01-01').then((sessions) => {
      const map = new Map<string, SetLog[]>();
      for (const s of sessions) {
        const bySlug = new Map<string, SetLog[]>();
        for (const set of s.sets ?? []) bySlug.set(set.exercise, [...(bySlug.get(set.exercise) ?? []), set]);
        for (const [slug, sets] of bySlug) map.set(slug, sets); // later sessions overwrite earlier ones
      }
      setLast(map);
    });
  }, [repo]);
  return last;
}

function Session({ plan, last }: { plan: PlannedWorkout; last: Map<string, SetLog[]> }) {
  const { colors } = useTheme();
  const { repo } = useData();
  const profile = useProfile();
  const startedAt = useRef(Date.now()).current;
  const [now, setNow] = useState(Date.now());
  const [idx, setIdx] = useState(0);
  const [sets, setSets] = useState<LiveSet[][]>(() => plan.exercises.map((e) => startSets(e, last.get(e.slug) ?? [])));
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [timerUntil, setTimerUntil] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ minutes: number; kcal: number; sets: number } | null>(null);
  const restedFor = useRef(false);

  // Fill in last time's numbers once they have loaded, for exercises not started yet.
  useEffect(() => {
    setSets((cur) => cur.map((list, i) => (list.some((s) => s.done) ? list : startSets(plan.exercises[i], last.get(plan.exercises[i].slug) ?? []))));
  }, [last, plan]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const exercise = plan.exercises[idx];
  const list = sets[idx] ?? [];
  const current = list.findIndex((s) => !s.done);
  const exerciseDone = current === -1;
  const timed = !!exercise.durationS;
  const resting = restUntil !== null && restUntil > now;
  const timing = timerUntil !== null;
  const doneCount = sets.flat().filter((s) => s.done).length;
  const allDone = sets.every((l) => l.every((s) => s.done));

  // Rest and timed sets end by themselves.
  useEffect(() => {
    if (restUntil !== null && restUntil <= now && !restedFor.current) {
      restedFor.current = true;
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (timerUntil !== null && timerUntil <= now) logSet(list[current]?.durationS ?? exercise.durationS ?? 0);
  }, [now]);

  const edit = (patch: Partial<LiveSet>) => setSets((all) => all.map((l, i) => (i === idx ? l.map((s, n) => (n === current ? { ...s, ...patch } : s)) : l)));
  const logSet = (durationS?: number) => {
    if (current < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimerUntil(null);
    setSets((all) => all.map((l, i) => (i === idx ? l.map((s, n) => (n === current ? { ...s, done: true, ...(durationS !== undefined ? { durationS } : {}) } : s)) : l)));
    const finishing = current === list.length - 1;
    if (!finishing && exercise.restS > 0) {
      restedFor.current = false;
      setRestUntil(Date.now() + exercise.restS * 1000);
    } else setRestUntil(null);
  };

  const finish = async () => {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    const kcal = caloriesBurned(plan.kind, minutes, profile?.weightKg ?? 70);
    const logs = toSetLogs(plan, sets);
    await repo.addWorkout({ workoutId: plan.workoutId, programId: plan.programId, title: plan.title, startedAt, finishedAt: Date.now(), sets: logs, notes: null, rating: null, caloriesBurned: kcal });
    setSaved({ minutes, kcal, sets: logs.length });
  };

  const askFinish = () => {
    if (!doneCount) return leave();
    if (allDone) return finish();
    Alert.alert('Finish now?', `${doneCount} sets done. They will be saved.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: () => finish() },
    ]);
  };
  const leave = () => {
    if (!doneCount) return router.back();
    Alert.alert('Leave without saving?', 'The sets you logged will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const best = useMemo(() => {
    const done = list.filter((s) => s.done);
    return done.reduce<LiveSet | null>((b, s) => (!b || s.kg * s.reps > b.kg * b.reps ? s : b), null);
  }, [list]);

  if (saved)
    return (
      <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <MyPango pose="cheer" outfit="gym" size={180} />
          <Text variant="title" align="center">
            {plan.title} done
          </Text>
          <Text variant="body" tone="muted" align="center">
            {saved.minutes} min, {saved.sets} sets, about {saved.kcal} kcal burned.
          </Text>
          <Button title="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );

  const next = plan.exercises[idx + 1];
  const mainLabel = exerciseDone ? (next ? `Next: ${next.name}` : 'Finish workout') : resting ? 'Skip rest' : timed ? (timing ? 'Stop and log' : `Start ${list[current].durationS} s timer`) : `Log set ${current + 1}`;
  const main = () => {
    if (exerciseDone) {
      if (next) {
        setIdx(idx + 1);
        setRestUntil(null);
      } else finish();
    } else if (resting) setRestUntil(null);
    else if (timed) {
      if (timing) logSet(Math.round((list[current].durationS * 1000 - Math.max(0, timerUntil! - Date.now())) / 1000));
      else setTimerUntil(Date.now() + list[current].durationS * 1000);
    } else logSet();
  };

  return (
    <Screen gap={12}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="close" label="Close the workout" onPress={leave} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" style={{ fontSize: 16 }} numberOfLines={1}>
            {plan.title}
          </Text>
          <Text variant="caption" tone="muted">
            Exercise {idx + 1} of {plan.exercises.length}, {clock((now - startedAt) / 1000)}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={askFinish} style={{ height: 44, paddingHorizontal: spacing.lg, borderRadius: 22, justifyContent: 'center', backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
          <Text variant="bodyStrong">Finish</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        {plan.exercises.map((e, i) => (
          <View key={e.slug + i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: sets[i]?.every((s) => s.done) ? brand.lime : i === idx ? colors.accent : colors.track }} />
        ))}
      </View>

      <View style={{ gap: 6 }}>
        <Text variant="h2" style={{ fontSize: 24 }} accessibilityRole="header">
          {exercise.name}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {exercise.muscles.map((m) => (
            <Chip key={m} label={m} color={colors.protein} />
          ))}
          {exercise.equipment.map((q) => (
            <Chip key={q} label={q} />
          ))}
          <Chip label={targetText(exercise)} />
        </View>
        {exercise.cue ? (
          <Text variant="small" tone="muted">
            {exercise.cue}
          </Text>
        ) : null}
      </View>

      <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 28 }}>
          <Text variant="caption" tone="muted" style={{ width: 40 }}>
            SET
          </Text>
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            LAST TIME
          </Text>
          <Text variant="caption" tone="muted" style={{ width: 90 }}>
            {timed ? 'TIME' : usesWeight(exercise) ? 'KG × REPS' : 'REPS'}
          </Text>
          <View style={{ width: 32 }} />
        </View>
        {list.map((s, n) => {
          const isCurrent = n === current;
          return (
            <View
              key={n}
              accessible
              accessibilityLabel={`Set ${n + 1}: ${setText(s, timed)}${s.done ? ', done' : isCurrent ? ', current' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', height: 42, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 14, backgroundColor: isCurrent ? colors.raised : 'transparent', borderTopWidth: n && !isCurrent ? 1 : 0, borderColor: colors.line }}
            >
              <Text variant="bodyStrong" style={{ width: 40 }}>
                {n + 1}
              </Text>
              <Text variant="small" tone="muted" style={{ flex: 1 }}>
                {setText(last.get(exercise.slug)?.find((l) => l.setNo === n + 1), timed)}
              </Text>
              <Text variant="bodyStrong" style={{ width: 90, color: s.done || isCurrent ? colors.text : colors.muted }}>
                {setText(s, timed)}
              </Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? brand.lime : 'transparent', borderWidth: 2, borderColor: s.done ? brand.lime : isCurrent ? colors.accent : colors.lineStrong }}>
                {s.done ? <Icon name="check" size={14} color={brand.ink} strokeWidth={3.4} /> : null}
              </View>
            </View>
          );
        })}
      </View>

      {!exerciseDone && !resting && !timing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: usesWeight(exercise) ? 'space-between' : 'center', padding: 12, borderRadius: 22, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
          {usesWeight(exercise) ? <Stepper label="kg" value={list[current].kg} step={2} min={0} max={300} onChange={(kg) => edit({ kg })} names={['Less weight', 'More weight']} /> : null}
          {timed ? (
            <Stepper label="seconds" value={list[current].durationS} step={5} min={5} max={600} onChange={(durationS) => edit({ durationS })} names={['Shorter', 'Longer']} />
          ) : (
            <Stepper label="reps" value={list[current].reps} step={1} min={1} max={100} onChange={(reps) => edit({ reps })} names={['Fewer reps', 'More reps']} />
          )}
        </View>
      ) : null}

      {timing ? (
        <View style={{ alignItems: 'center', padding: spacing.lg, borderRadius: 22, backgroundColor: colors.raised }} accessibilityLiveRegion="polite">
          <Text variant="numberXL">{clock(Math.max(0, (timerUntil! - now) / 1000))}</Text>
          <Text variant="caption" tone="muted">
            Hold it. Pango is counting.
          </Text>
        </View>
      ) : null}

      {resting && !exerciseDone ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 10, paddingHorizontal: 12, borderRadius: 22, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }} accessibilityLiveRegion="polite">
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accent, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <MyPango pose="cheer" outfit="gym" crop="face" size={42} motion={false} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              Rest before set {current + 1}
            </Text>
            <Text variant="number" style={{ fontSize: 26 }}>
              {clock((restUntil! - now) / 1000)}
            </Text>
            <Text variant="caption" tone="good">
              {cheerFor(list, last.get(exercise.slug) ?? [])}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fifteen seconds more rest" onPress={() => setRestUntil((r) => (r ?? Date.now()) + 15_000)} style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: 'center' }}>
            <Text variant="label">+15 s</Text>
          </Pressable>
        </View>
      ) : null}

      {exerciseDone ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 12, borderRadius: 22, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: brand.lime, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <MyPango pose="cheer" outfit="gym" crop="face" size={42} motion={false} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{exercise.name} done</Text>
            {best && !timed ? (
              <Text variant="caption" tone="good">
                Best set: {setText(best, false)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ flexGrow: 1 }} />
      {next ? (
        <Text variant="small" tone="muted">
          Next up <Text variant="label">{next.name}, {targetText(next)}</Text>
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={main}
        style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: exerciseDone ? brand.lime : resting ? colors.text : colors.accent }}
      >
        <Text variant="h3" style={{ color: exerciseDone ? brand.ink : resting ? colors.bg : colors.onAccent }}>
          {mainLabel}
        </Text>
      </Pressable>
    </Screen>
  );
}

function cheerFor(list: LiveSet[], last: SetLog[]): string {
  const done = list.filter((s) => s.done);
  const lastDone = done[done.length - 1];
  const before = last[done.length - 1];
  if (lastDone && before?.weightKg && lastDone.kg > before.weightKg) return `${lastDone.kg - before.weightKg} kg more than last time`;
  if (lastDone && before?.reps && lastDone.reps > before.reps) return `${lastDone.reps - before.reps} more reps than last time`;
  return 'Nice and steady';
}

function Chip({ label, color }: { label: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', backgroundColor: color ? `${color}22` : colors.raised }}>
      <Text variant="caption" style={{ color: color ?? colors.subtle }}>
        {label}
      </Text>
    </View>
  );
}

function Stepper({ label, value, step, min, max, onChange, names }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void; names: [string, string] }) {
  const { colors } = useTheme();
  const btn = (dir: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={names[dir === -1 ? 0 : 1]}
      onPress={() => onChange(Math.min(max, Math.max(min, value + dir * step)))}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={dir === -1 ? 'minus' : 'plus'} size={20} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {btn(-1)}
      <View style={{ minWidth: 54, alignItems: 'center' }} accessible accessibilityLabel={`${value} ${label}`}>
        <Text variant="h3" style={{ fontSize: 20 }}>
          {value}
        </Text>
        <Text variant="caption" tone="muted" style={{ fontSize: 11 }}>
          {label}
        </Text>
      </View>
      {btn(1)}
    </View>
  );
}
