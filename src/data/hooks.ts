import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { Session } from '../auth/session';
import { useData } from './DataProvider';
import { localDate, shiftDate, streak, weekOf, type MealType } from './dates';
import { learnUsuals, mealsFrom, type Usual } from './history';
import { ONBOARDED_KEY } from './profile';
import type { Area, DayTotals, DiaryEntry, Repo } from './repo';
import { DEFAULT_GOALS, DEFAULT_SETTINGS, PROFILE_KEY, SETTINGS_KEY, type CachedProfile, type Goals, type Profile, type Settings } from './settings';
import type { SyncStatus } from './sync';

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
