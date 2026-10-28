import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { useData } from '../src/data/DataProvider';
import { dateAt, shiftDate } from '../src/data/dates';
import { useBurned, useProfile, useRepoQuery, useSettings, useSteps, useToday } from '../src/data/hooks';
import { BURN_GOAL_RANGE, STEP_GOAL_RANGE, USUAL_STEPS, goalStreak, kcalForSteps, kmForSteps, parseSteps } from '../src/data/steps';
import { MyPango } from '../src/pango/MyPango';
import { healthConnect, type HealthState } from '../src/steps/healthConnect';
import { syncHealthSteps } from '../src/steps/StepSync';
import { useTheme } from '../src/theme/theme';
import { radius, spacing } from '../src/theme/tokens';
import { Button, Card, Icon, IconButton, Ring, Screen, Text } from '../src/ui';
import { Field } from '../src/ui/Field';

const fmt = (n: number) => Math.round(n).toLocaleString('en-ZA');
const EAT_BACK_TEXT = { none: 'none of it (set on Train)', half: 'half of it (set on Train)', all: 'all of it (set on Train)' } as const;

/** Steps and energy burned: today against the goals, the last week, where steps come from, and the goals themselves. */
export default function ActivityScreen() {
  const { colors } = useTheme();
  const { repo } = useData();
  const today = useToday();
  const [settings, update] = useSettings();
  const profile = useProfile();
  const body = { heightCm: profile?.heightCm, weightKg: profile?.weightKg };
  const steps = useSteps(today);
  const { total, walking, burned, walkingAdded } = useBurned(today);
  const since = shiftDate(today, -400);
  const history = useRepoQuery(['activity'], (r) => r.stepsByDay(since), [since]);
  const best = useRepoQuery(['activity'], (r) => r.bestStepDay(shiftDate(today, 1)), [today]);
  const [health, setHealth] = useState<HealthState>();
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(today);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string>();

  const checkHealth = useCallback(() => healthConnect.state().then(setHealth, () => setHealth('unsupported')), []);
  useEffect(() => {
    checkHealth();
    // Back from Health Connect's own screens, access may have changed.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkHealth());
    return () => sub.remove();
  }, [checkHealth]);

  const connected = settings.stepsFrom === 'health-connect' && health === 'connected';
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 6));
  const streak = history ? goalStreak(history, settings.stepGoal, today) : 0;
  const count = steps?.steps ?? 0;

  const connect = async () => {
    setBusy(true);
    try {
      if (await healthConnect.connect()) {
        await update({ stepsFrom: 'health-connect' });
        await syncHealthSteps(repo, body);
      }
    } catch (e) {
      console.warn('Connecting Health Connect failed', e);
    } finally {
      await checkHealth();
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    await syncHealthSteps(repo, body).catch((e) => console.warn('Reading steps failed', e));
    setBusy(false);
  };

  const saveTyped = async () => {
    const n = parseSteps(typed);
    if (n === null) return setTypedError('Enter steps from 1 to 100 000.');
    await repo.setDaySteps(day, n, { caloriesBurned: kcalForSteps(n, body), distanceKm: kmForSteps(n, body), note: null });
    Haptics.selectionAsync().catch(() => {});
    setTyped('');
    setTypedError(undefined);
  };

  const stepGoal = (dir: number) => {
    const { min, max, step } = STEP_GOAL_RANGE;
    update({ stepGoal: Math.min(max, Math.max(min, settings.stepGoal + dir * step)) });
  };
  const burnGoal = (dir: number) => {
    const { min, max, step } = BURN_GOAL_RANGE;
    update({ burnGoal: Math.min(max, Math.max(min, settings.burnGoal + dir * step)) });
  };

  const top = Math.max(settings.stepGoal, ...week.map((d) => history?.get(d) ?? 0)) * 1.1;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
          Activity
        </Text>
      </View>

      <Card padding={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Ring value={count / settings.stepGoal} color={colors.good} label={`${fmt(count)} of ${fmt(settings.stepGoal)} steps today`}>
          <Text variant="number">{fmt(count)}</Text>
          <Text variant="caption" tone="muted">
            of {fmt(settings.stepGoal)} steps
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Stat label="Distance" value={`about ${(steps?.km ?? 0).toFixed(1)} km`} />
          <Stat label="Burned today" value={`${fmt(total)} of ${fmt(settings.burnGoal)} kcal`} />
          <Text variant="caption" tone="muted">
            {fmt(walking)} walking{burned ? ` + ${fmt(burned)} training` : ''}
          </Text>
          <Stat label="Streak" value={streak ? `${streak} ${streak === 1 ? 'day' : 'days'}` : 'Not yet'} />
          {best ? <Stat label="Best day" value={`${fmt(best.steps)} steps`} /> : null}
        </View>
      </Card>

      <Text variant="h3">Last 7 days</Text>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + (settings.stepGoal / top) * 110, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong }} />
          {week.map((d) => {
            const n = history?.get(d) ?? 0;
            const met = n >= settings.stepGoal;
            const label = d === today ? 'Today' : dateAt(d).toLocaleDateString('en-ZA', { weekday: 'short' });
            return (
              <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${label}: ${fmt(n)} steps${met ? ', goal reached' : ''}`} accessibilityState={{ selected: d === day }} onPress={() => setDay(d)} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: '70%', height: Math.max(4, (n / top) * 110), borderRadius: 6, backgroundColor: met ? colors.good : colors.track, borderWidth: d === day ? 2 : 0, borderColor: colors.accent }} />
                <Text variant="caption" tone={d === day ? 'accent' : 'muted'} style={{ fontSize: 11 }}>
                  {label === 'Today' ? 'Today' : label.slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" tone="muted">
          The dashed line is your goal. Green days reached it.
        </Text>
      </Card>

      <Text variant="h3">Where steps come from</Text>
      {connected ? (
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="check" size={18} color={colors.goodText} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Counting from Health Connect
            </Text>
          </View>
          <Text variant="small" tone="muted">
            Pango reads your step count while it is open: when you open it, when you come back to it, and every few minutes. It only reads steps and never writes anything.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Refresh" icon="swap" size="md" variant="secondary" loading={busy} style={{ flex: 1 }} onPress={refresh} />
            <Button title="Manage access" size="md" variant="ghost" style={{ flex: 1 }} onPress={() => healthConnect.openSettings()} />
          </View>
          <Button title="Type steps in myself instead" size="md" variant="ghost" onPress={() => update({ stepsFrom: 'manual' })} />
        </Card>
      ) : health && health !== 'unsupported' ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <MyPango pose="think" size={72} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Text variant="bodyStrong">Count steps automatically</Text>
            <Text variant="small" tone="muted">
              {health === 'not-installed'
                ? 'Install Health Connect from Google Play. Samsung Health, Google Fit and most watches save your steps there.'
                : health === 'needs-update'
                  ? 'Health Connect needs an update from Google Play first.'
                  : 'Pango can read your steps from Health Connect, where Samsung Health, Google Fit and most watches save them. Read only.'}
            </Text>
            {health === 'not-installed' || health === 'needs-update' ? (
              <Button title={health === 'not-installed' ? 'Get Health Connect' : 'Update Health Connect'} size="md" onPress={() => healthConnect.openStore()} />
            ) : (
              <Button title="Connect Health Connect" size="md" loading={busy} onPress={connect} />
            )}
          </View>
        </Card>
      ) : null}

      {!connected ? (
        <Card style={{ gap: spacing.sm }}>
          <Field
            label={`Steps ${day === today ? 'today' : `on ${dateAt(day).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}`}`}
            value={typed}
            onChangeText={(t) => {
              setTyped(t);
              setTypedError(undefined);
            }}
            placeholder={history?.get(day) ? fmt(history.get(day)!) : 'From your watch or phone'}
            keyboardType="number-pad"
            suffix="steps"
            error={typedError}
          />
          <Button title="Save steps" icon="check" size="md" onPress={saveTyped} />
          <Text variant="caption" tone="muted">
            Tap a day in the chart to fill in another day.
          </Text>
        </Card>
      ) : null}

      <Text variant="h3">Goals</Text>
      <Card style={{ gap: spacing.lg }}>
        <Stepper label="Steps a day" value={`${fmt(settings.stepGoal)} steps`} onLess={() => stepGoal(-1)} onMore={() => stepGoal(1)} />
        <Text variant="caption" tone="muted">
          Most of walking&apos;s health benefit comes by 7,000 to 10,000 steps a day. Start where you are and add 1,000 at a time.
        </Text>
        <Stepper label="Calories burned a day" value={`${fmt(settings.burnGoal)} kcal`} onLess={() => burnGoal(-1)} onMore={() => burnGoal(1)} />
        <Text variant="caption" tone="muted">
          Walking and workouts together. Pango cheers when you reach either goal, when you beat your best day, and on streaks of 3, 7, 14 and 30 days.
        </Text>
      </Card>

      <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.raised }}>
        <Text variant="bodyStrong">Steps and your food</Text>
        <Text variant="small" tone="muted">
          Your calorie goal already counts a usual day for your activity level, about {fmt(USUAL_STEPS[profile?.activityLevel ?? 'light'])} steps. Walking beyond that adds to what you can eat, at {EAT_BACK_TEXT[settings.eatBack]}.
          {walkingAdded ? ` Today that is +${fmt(walkingAdded)} kcal.` : ''}
        </Text>
        <Text variant="caption" tone="muted">
          Distance and calories are estimates from your height and weight: walking burns about half a calorie per kilogram for every kilometre.
        </Text>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="caption">{value}</Text>
    </View>
  );
}

function Stepper({ label, value, onLess, onMore }: { label: string; value: string; onLess: () => void; onMore: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Text variant="h3">{value}</Text>
      </View>
      <IconButton icon="minus" label={`Lower: ${label}`} onPress={onLess} />
      <IconButton icon="plus" label={`Raise: ${label}`} onPress={onMore} />
    </View>
  );
}
