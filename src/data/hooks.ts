import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { unwrap } from '../api/client';
import type { Session } from '../auth/session';
import { useData } from './DataProvider';
import { localDate, shiftDate, streak, weekOf, type MealType } from './dates';
import { learnUsuals, mealsFrom, type Usual } from './history';
import { computeStats, type Stats } from './achievements';
import { ENTITLEMENT_KEY, isPlus, type CachedEntitlement, type Entitlement } from './entitlement';
import { PLAN_DIET_KEY, PLAN_OWN_KEY, PLAN_SWAPS_KEY, type OwnMeals, type Swaps } from './mealPlan';
import { CLASSIC_LOOK, type WornLook } from '../pango/wardrobe';
import { ONBOARDED_KEY } from './profile';
import type { Area, DayTotals, DiaryEntry, Repo } from './repo';
import { DEFAULT_GOALS, DEFAULT_SETTINGS, EAT_BACK_FACTOR, PROFILE_KEY, SETTINGS_KEY, type CachedProfile, type Goals, type Profile, type Settings } from './settings';
import type { Api } from '../api/client';
import type { SyncStatus } from './sync';
import { extraSteps, kcalForSteps, kmForSteps } from './steps';

/**
 * Reads from the phone's database now and again whenever one of `areas` changes. `read` may only depend on `deps`.
 * Undefined until the first read finishes.
 */
export function useRepoQuery<T>(areas: readonly Area[], read: (repo: Repo) => Promise<T>, deps: readonly unknown[]): T | undefined {
  const { repo } = useData();
  const [value, setValue] = useState<T>();
  const areaKey = areas.join();
  useEffect(() => {
    let alive = true;
    let latest = 0;
    const run = () => {
      const mine = ++latest;
      read(repo).then(
        (v) => {
          if (alive && mine === latest) setValue(v);
        },
        (e) => console.warn('read failed', e),
      );
    };
    run();
    const watched = areaKey.split(',') as Area[];
    const off = repo.onChange((changed) => {
      if (watched.some((a) => changed.has(a))) run();
    });
    return () => {
      alive = false;
      off();
    };
  }, [repo, areaKey, ...deps]);
  return value;
}

/** Today's date (YYYY-MM-DD), moving on at midnight and when the app comes back to the front. */
export function useToday(): string {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const check = () => setToday(localDate());
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}

export type Day = { entries: DiaryEntry[]; totals: DayTotals };

export function useDay(date: string): Day | undefined {
  return useRepoQuery(['diary'], async (repo) => ({ entries: await repo.entriesFor(date), totals: await repo.totalsFor(date) }), [date]);
}

/** Millilitres of water logged on `date`. */
export function useWater(date: string): number | undefined {
  return useRepoQuery(['water'], (repo) => repo.waterFor(date), [date]);
}

/** Days in a row with a meal logged (see `streak`). */
export function useStreak(today: string): number | undefined {
  return useRepoQuery(['diary'], async (repo) => streak(await repo.loggedDates(shiftDate(today, -400)), today), [today]);
}

/** Calories per day for the Monday-to-Sunday week holding `date`. */
export function useWeek(date: string): { days: string[]; calories: Map<string, number> } | undefined {
  return useRepoQuery(
    ['diary'],
    async (repo) => {
      const days = weekOf(date);
      return { days, calories: await repo.caloriesByDay(days[0], days[6]) };
    },
    [date],
  );
}

/** Meals logged at least twice in the last 30 days. */
export function useUsuals(today: string): Usual[] | undefined {
  return useRepoQuery(['diary'], async (repo) => learnUsuals(await repo.entriesSince(shiftDate(today, -30))), [today]);
}

/** Every distinct meal of the last 60 days (for What fits). */
export function useMealHistory(today: string): Usual[] | undefined {
  return useRepoQuery(['diary'], async (repo) => mealsFrom(await repo.entriesSince(shiftDate(today, -60))), [today]);
}

/** The latest earlier day's entries for a meal, to copy. Null when there is none. */
export function useLastMeal(date: string, mealType: MealType) {
  return useRepoQuery(['diary'], (repo) => repo.lastMeal(date, mealType), [date, mealType]);
}

/** The last entitlement the server gave (free until it says otherwise). */
export function useEntitlement(): Entitlement | null {
  const cached = useRepoQuery(['meta'], (r) => r.getMeta<CachedEntitlement>(ENTITLEMENT_KEY), []);
  return cached?.entitlement ?? null;
}

/** Weights from `since`, oldest first. */
export function useWeights(since: string) {
  return useRepoQuery(['weight'], (repo) => repo.weights(since), [since]);
}

/** Calories per day between two dates. */
export function useCaloriesByDay(from: string, to: string) {
  return useRepoQuery(['diary'], (repo) => repo.caloriesByDay(from, to), [from, to]);
}

/**
 * A server answer kept on the phone: shows the last copy at once (offline too) and refreshes it in the background.
 * `load` may only depend on `deps`.
 */
export function useCachedApi<T>(key: string, load: (api: Api) => Promise<T>, deps: readonly unknown[]) {
  const { api, repo } = useData();
  const cached = useRepoQuery(['meta'], (r) => r.getMeta<{ at: number; data: T }>(`cache:${key}`), [key]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    load(api)
      .then((data) => repo.setMeta(`cache:${key}`, { at: Date.now(), data }))
      .then(
        () => alive && setError(null),
        (e) => alive && setError(e),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [api, repo, key, attempt, ...deps]);
  return { data: cached?.data, error, loading, reload: () => setAttempt((n) => n + 1) };
}

/** What the server says about this app version, maintenance and links; the last answer is kept for offline starts. */
export function useServerConfig() {
  return useCachedApi('config', (api) => unwrap(api.GET('/v1/config')), []).data;
}

/** Diet styles and meals for meal plans, kept on the phone; fetched again when the account goes Plus or back. */
export function useMealPlans() {
  const plus = isPlus(useEntitlement());
  return useCachedApi('meal-plans', (api) => unwrap(api.GET('/v1/meal-plans')), [plus]);
}

/** The diet style picked for meal plans (a slug), null before one is picked, undefined while reading. */
export function usePlanDiet(): [string | null | undefined, (slug: string | null) => Promise<void>] {
  const { repo } = useData();
  const slug = useRepoQuery(['meta'], (r) => r.getMeta<string>(PLAN_DIET_KEY), []);
  const set = useCallback((next: string | null) => repo.setMeta(PLAN_DIET_KEY, next), [repo]);
  return [slug, set];
}

/** How many times each planned meal was swapped, by day and slot. */
/** Planned meals replaced by one made from the groceries. */
export function usePlanOwn(): OwnMeals {
  return useRepoQuery(['meta'], (r) => r.getMeta<OwnMeals>(PLAN_OWN_KEY), []) ?? {};
}

export function usePlanSwaps(): Swaps {
  return useRepoQuery(['meta'], (r) => r.getMeta<Swaps>(PLAN_SWAPS_KEY), []) ?? {};
}

/** Finished workouts from `since`. */
export function useWorkouts(since: string) {
  return useRepoQuery(['workout'], (repo) => repo.workouts(since), [since]);
}

/** The day's steps (0 when none are known), with the distance and energy they mean for this person. */
export function useSteps(date: string): { steps: number; km: number; kcal: number; from: string | null } | undefined {
  const profile = useProfile();
  const record = useRepoQuery(['activity'], (repo) => repo.stepsFor(date), [date]);
  if (record === undefined) return undefined;
  const steps = record?.steps ?? 0;
  const body = { heightCm: profile?.heightCm, weightKg: profile?.weightKg };
  return { steps, km: kmForSteps(steps, body), kcal: kcalForSteps(steps, body), from: record?.note ?? null };
}

/**
 * Energy burned on `date`: `burned` training and `walking` from the day's steps. `added` is what goes back into the
 * day's food budget at the eat-back setting: training, and walking only for steps beyond a usual day at the person's
 * activity level, which the calorie goal already counts.
 */
export function useBurned(date: string): { burned: number; walking: number; total: number; added: number; trainingAdded: number; walkingAdded: number } {
  const workouts = useWorkouts(date);
  const record = useRepoQuery(['activity'], (repo) => repo.stepsFor(date), [date]);
  const profile = useProfile();
  const [{ eatBack }] = useSettings();
  const burned = Math.round((workouts ?? []).filter((w) => w.localDate === date).reduce((s, w) => s + (w.caloriesBurned ?? 0), 0));
  const steps = record?.steps ?? 0;
  const body = { heightCm: profile?.heightCm, weightKg: profile?.weightKg };
  const walking = kcalForSteps(steps, body);
  const trainingAdded = Math.round(burned * EAT_BACK_FACTOR[eatBack]);
  const walkingAdded = Math.round(kcalForSteps(extraSteps(steps, profile?.activityLevel), body) * EAT_BACK_FACTOR[eatBack]);
  return { burned, walking, total: burned + walking, added: trainingAdded + walkingAdded, trainingAdded, walkingAdded };
}

export const LOOK_KEY = 'pango.look';
export const RECAP_SHARED_KEY = 'recap.shared';

/** Everything the wardrobe's unlocks are based on. Undefined while reading. */
export function useStats(today: string): Stats | undefined {
  const goals = useGoals();
  const [{ waterGoalMl }] = useSettings();
  return useRepoQuery(
    ['diary', 'water', 'workout', 'meta'],
    async (repo) =>
      computeStats({
        entries: await repo.entriesSince('0000-01-01'),
        waterByDay: await repo.waterByDay(),
        workouts: (await repo.workouts('0000-01-01')).length,
        goals,
        waterGoalMl,
        today,
        sharedRecap: (await repo.getMeta<boolean>(RECAP_SHARED_KEY)) === true,
      }),
    [today, goals.calories, goals.proteinG, waterGoalMl],
  );
}

/** The look Pango wears around the app (kept on this phone). */
export function useWornLook(): WornLook {
  const saved = useRepoQuery(['meta'], (r) => r.getMeta<WornLook>(LOOK_KEY), []);
  return saved ?? CLASSIC_LOOK;
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>] {
  const { repo } = useData();
  const saved = useRepoQuery(['meta'], (r) => r.getMeta<Partial<Settings>>(SETTINGS_KEY), []);
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const current = (await repo.getMeta<Partial<Settings>>(SETTINGS_KEY)) ?? {};
      await repo.setMeta(SETTINGS_KEY, { ...current, ...patch });
    },
    [repo],
  );
  return [settings, update];
}

export function useSyncStatus(): SyncStatus {
  const { sync } = useData();
  return useSyncExternalStore(
    useCallback((fn: () => void) => sync.subscribe(fn), [sync]),
    () => sync.current,
  );
}

export function useSession(): Session | null {
  const { session } = useData();
  return useSyncExternalStore(
    useCallback((fn: () => void) => session.onChange(fn), [session]),
    () => session.current,
  );
}

/** The profile on the phone: the server's copy with any changes not yet sent (see `profileTask`). */
export function useProfile(): Profile | null {
  const cached = useRepoQuery(['meta'], (r) => r.getMeta<CachedProfile>(PROFILE_KEY), []);
  return cached?.profile ?? null;
}

/** Whether onboarding is done, on this phone or (for a returning account) on the server. Undefined while reading. */
export function useOnboarded(): boolean | undefined {
  return useRepoQuery(
    ['meta'],
    async (r) => (await r.getMeta<boolean>(ONBOARDED_KEY)) === true || (await r.getMeta<CachedProfile>(PROFILE_KEY))?.profile.onboardedAt != null,
    [],
  );
}

export function useGoals(): Goals {
  return useProfile()?.goals ?? DEFAULT_GOALS;
}
