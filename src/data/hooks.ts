import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { unwrap } from '../api/client';
import type { Session } from '../auth/session';
import { useData } from './DataProvider';
import { localDate, shiftDate, streak } from './dates';
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

const PROFILE_MAX_AGE_MS = 15 * 60_000;

/** The server profile, cached on the phone. Refreshed after a sync when the copy is over 15 minutes old. */
export function useProfile(): Profile | null {
  const { api, repo } = useData();
  const cached = useRepoQuery(['meta'], (r) => r.getMeta<CachedProfile>(PROFILE_KEY), []);
  const { lastSyncedAt } = useSyncStatus();
  useEffect(() => {
    // Wait for the cache read and for a sync that reached the server (so there is an account).
    if (cached === undefined || lastSyncedAt === null) return;
    if (cached && Date.now() - cached.fetchedAt < PROFILE_MAX_AGE_MS) return;
    unwrap(api.GET('/v1/me/profile'))
      .then((profile) => repo.setMeta(PROFILE_KEY, { fetchedAt: Date.now(), profile } satisfies CachedProfile))
      .catch(() => {});
  }, [api, repo, cached, lastSyncedAt]);
  return cached?.profile ?? null;
}

export function useGoals(): Goals {
  return useProfile()?.goals ?? DEFAULT_GOALS;
}
