import { unwrap, type Api } from '../api/client';
import type { components } from '../api/schema';
import { ApiError } from '../api/errors';
import { recommendGoals, type ActivityLevel, type GoalType, type Sex } from './goals';
import type { Repo } from './repo';
import { DEFAULT_GOALS, PROFILE_KEY, type CachedProfile, type Goals, type Profile } from './settings';

export type ProfilePatch = components['schemas']['ProfilePatch'];

/** Profile changes made on the phone and not yet accepted by the server, merged. */
export const PENDING_PROFILE_KEY = 'profile.pending';
/** Goals set by hand (or 'recommended' to go back to the worked-out ones), not yet sent. */
export const PENDING_GOALS_KEY = 'goals.pending';
/** Set when onboarding is finished or skipped on this phone. */
export const ONBOARDED_KEY = 'onboarding.done';

const PROFILE_MAX_AGE_MS = 15 * 60_000;

/** What a new account's profile looks like before the server has said anything. */
export function blankProfile(): Profile {
  return {
    timezone: deviceTimezone() ?? 'UTC',
    locale: deviceLocale() ?? 'en-ZA',
    units: 'metric',
    sex: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    activityLevel: null,
    goal: 'maintain',
    goalRateKgPerWeek: 0,
    targetWeightKg: null,
    onboardedAt: null,
    goals: { ...DEFAULT_GOALS, custom: false },
  };
}

export function deviceTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length <= 64 ? tz : undefined;
  } catch {
    return undefined;
  }
}

export function deviceLocale(): string | undefined {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale) && locale.length <= 16 ? locale : undefined;
  } catch {
    return undefined;
  }
}

/** The profile with a patch applied, goals recalculated the way the server does it (unless they were set by hand). */
export function applyPatch(profile: Profile, patch: ProfilePatch, now: number): Profile {
  const { onboarded, ...fields } = patch;
  const next: Profile = { ...profile, ...fields, goals: { ...profile.goals } };
  if (onboarded !== undefined) next.onboardedAt = onboarded ? (profile.onboardedAt ?? now) : null;
  if (!next.goals.custom && next.birthYear && next.heightCm && next.weightKg && next.activityLevel) {
    const rec = recommendGoals(
      {
        sex: next.sex as Sex | null,
        birthYear: next.birthYear,
        heightCm: next.heightCm,
        weightKg: next.weightKg,
        activityLevel: next.activityLevel as ActivityLevel,
        goal: next.goal as GoalType,
        rateKgPerWeek: next.goalRateKgPerWeek,
      },
      now,
    );
    next.goals = { calories: rec.calories, proteinG: rec.proteinG, carbG: rec.carbG, fatG: rec.fatG, custom: false };
  }
  return next;
}

/** Changes the profile on the phone at once and queues the change for the server (sent by `profileTask`). */
export async function saveProfile(repo: Repo, changes: ProfilePatch, now: number = Date.now()): Promise<Profile> {
  const patch = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) as ProfilePatch;
  const cached = await repo.getMeta<CachedProfile>(PROFILE_KEY);
  const profile = applyPatch(cached?.profile ?? blankProfile(), patch, now);
  const pending = (await repo.getMeta<ProfilePatch>(PENDING_PROFILE_KEY)) ?? {};
  await repo.setMeta(PENDING_PROFILE_KEY, { ...pending, ...patch });
  await repo.setMeta(PROFILE_KEY, { fetchedAt: cached?.fetchedAt ?? 0, profile } satisfies CachedProfile);
  repo.emit('outbox'); // a change is waiting for the server: sync soon
  return profile;
}

/** Sets the calorie and macro goals by hand, or goes back to the recommended ones. Saved at once, sent with the next sync. */
export async function saveGoals(repo: Repo, goals: Goals | 'recommended', now: number = Date.now()): Promise<Profile> {
  const cached = await repo.getMeta<CachedProfile>(PROFILE_KEY);
  const base = cached?.profile ?? blankProfile();
  const profile =
    goals === 'recommended'
      ? applyPatch({ ...base, goals: { ...base.goals, custom: false } }, {}, now)
      : { ...base, goals: { ...goals, custom: true } };
  await repo.setMeta(PENDING_GOALS_KEY, goals);
  await repo.setMeta(PROFILE_KEY, { fetchedAt: cached?.fetchedAt ?? 0, profile } satisfies CachedProfile);
  repo.emit('outbox');
  return profile;
}

/**
 * Runs in each sync round: sends queued goal and profile changes, or refreshes the copy on the phone when it is over 15 minutes
 * old. A change the server rejects as invalid is dropped (it would be rejected forever).
 */
export function profileTask(repo: Repo, api: Api, now: () => number = Date.now): () => Promise<void> {
  return async () => {
    const goals = await repo.getMeta<Goals | 'recommended'>(PENDING_GOALS_KEY);
    if (goals) {
      try {
        if (goals === 'recommended') await unwrap(api.POST('/v1/me/goals/apply-recommendation'));
        else await unwrap(api.PUT('/v1/me/goals', { body: goals }));
      } catch (e) {
        if (!(e instanceof ApiError && e.permanent)) throw e;
      }
      if (JSON.stringify(await repo.getMeta(PENDING_GOALS_KEY)) === JSON.stringify(goals)) {
        await repo.deleteMeta(PENDING_GOALS_KEY);
        await repo.setMeta(PROFILE_KEY, { ...((await repo.getMeta<CachedProfile>(PROFILE_KEY)) ?? { profile: blankProfile() }), fetchedAt: 0 }); // fetch the server's copy next
      }
    }
    const pending = await repo.getMeta<ProfilePatch>(PENDING_PROFILE_KEY);
    if (pending) {
      let profile: Profile;
      try {
        profile = await unwrap(api.PATCH('/v1/me/profile', { body: pending }));
      } catch (e) {
        if (e instanceof ApiError && e.permanent) {
          await repo.deleteMeta(PENDING_PROFILE_KEY);
          return;
        }
        throw e;
      }
      // If more changes were queued while this one was in flight, keep them (and the phone's copy) for the next round.
      const still = await repo.getMeta<ProfilePatch>(PENDING_PROFILE_KEY);
      if (JSON.stringify(still) !== JSON.stringify(pending)) return;
      await repo.deleteMeta(PENDING_PROFILE_KEY);
      await repo.setMeta(PROFILE_KEY, { fetchedAt: now(), profile } satisfies CachedProfile);
      return;
    }
    const cached = await repo.getMeta<CachedProfile>(PROFILE_KEY);
    if (cached && now() - cached.fetchedAt < PROFILE_MAX_AGE_MS) return;
    const profile = await unwrap(api.GET('/v1/me/profile'));
    // A change made on the phone meanwhile is newer than this copy; it goes out on the next round.
    if (await repo.getMeta(PENDING_PROFILE_KEY)) return;
    await repo.setMeta(PROFILE_KEY, { fetchedAt: now(), profile } satisfies CachedProfile);
  };
}
