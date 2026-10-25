import { createApi } from '../src/api/client';
import { memorySecretStore } from '../src/auth/secretStore';
import { SessionManager } from '../src/auth/session';
import { recommendGoals, type GoalInputs } from '../src/data/goals';
import { paceText, parseAbout } from '../src/data/onboarding';
import { PENDING_PROFILE_KEY, applyPatch, blankProfile, profileTask, saveProfile } from '../src/data/profile';
import { Repo } from '../src/data/repo';
import { PROFILE_KEY, type CachedProfile } from '../src/data/settings';
import { migrate } from '../src/db/migrations';
import { FakeServer } from './helpers/fakeServer';
import { memoryDb } from './helpers/sqljsDb';

// The same cases as the backend's src/lib/nutrition.test.ts, so the two copies of the formula cannot drift apart.
describe('recommendGoals (copy of the backend)', () => {
  const NOW = Date.UTC(2026, 5, 1);
  const base: GoalInputs = { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activityLevel: 'moderate', goal: 'maintain', rateKgPerWeek: 0 };

  it('matches the backend numbers', () => {
    expect(recommendGoals(base, NOW)).toEqual({ calories: 2760, proteinG: 173, carbG: 311, fatG: 92, bmr: 1780, tdee: 2759, floorApplied: false });
    expect(recommendGoals({ ...base, goal: 'lose', rateKgPerWeek: 0.5 }, NOW).calories).toBe(2210);
    expect(recommendGoals({ ...base, goal: 'lose', rateKgPerWeek: -0.5 }, NOW).calories).toBe(2210);
  });

  it('never goes below the floor', () => {
    const r = recommendGoals({ ...base, sex: 'female', weightKg: 45, heightCm: 150, activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 1 }, NOW);
    expect(r).toMatchObject({ calories: 1200, floorApplied: true });
  });
});

describe('onboarding answers', () => {
  const now = new Date(2026, 9, 25).getTime();

  it('reads the facts, decimal commas included', () => {
    expect(parseAbout({ sex: 'unsaid', birthYear: '1995', heightCm: '172,5', weightKg: '81.26' }, now)).toEqual({
      ok: true,
      value: { sex: null, birthYear: 1995, heightCm: 172.5, weightKg: 81.3 },
    });
  });

  it('explains what is missing or out of range', () => {
    expect(parseAbout({ sex: 'female', birthYear: '', heightCm: '17', weightKg: '500' }, now)).toEqual({
      ok: false,
      errors: { birthYear: 'Enter the year you were born.', heightCm: expect.stringContaining('centimetres'), weightKg: expect.stringContaining('kilograms') },
    });
    expect(parseAbout({ sex: 'female', birthYear: '2020', heightCm: '160', weightKg: '50' }, now)).toMatchObject({ ok: false, errors: { birthYear: expect.stringContaining('13') } });
  });

  it('describes the pace', () => {
    expect(paceText('lose', 0.5)).toMatch(/^lose about 0[.,]5 kg a week$/);
    expect(paceText('maintain', 0)).toBe('stay about where you are');
  });
});

describe('profile on the phone', () => {
  const now = Date.UTC(2026, 9, 25);

  async function setup(server = new FakeServer()) {
    const db = await memoryDb();
    await migrate(db);
    const repo = new Repo(db, () => 'id', () => now);
    const fetchImpl = (req: Request) => server.fetch(req);
    const session = new SessionManager(memorySecretStore(), createApi({ baseUrl: 'http://api.test', fetchImpl }), () => now);
    await session.ensure('test');
    const api = createApi({ baseUrl: 'http://api.test', fetchImpl, tokens: { accessToken: () => session.accessToken(), refreshAfterUnauthorized: () => session.refresh() } });
    return { repo, server, task: profileTask(repo, api, () => now) };
  }

  it('recalculates goals locally like the server, unless they were set by hand', () => {
    const facts = { sex: 'male' as const, birthYear: 1996, heightCm: 180, weightKg: 80, activityLevel: 'moderate' as const, goal: 'maintain' as const };
    const p = applyPatch(blankProfile(), { ...facts, onboarded: true }, Date.UTC(2026, 5, 1));
    expect(p.goals).toEqual({ calories: 2760, proteinG: 173, carbG: 311, fatG: 92, custom: false });
    expect(p.onboardedAt).toBe(Date.UTC(2026, 5, 1));
    const custom = { ...blankProfile(), goals: { calories: 1900, proteinG: 150, carbG: 180, fatG: 60, custom: true } };
    expect(applyPatch(custom, facts, now).goals.calories).toBe(1900);
  });

  it('saves at once, then sends the change and takes the server copy', async () => {
    const { repo, server, task } = await setup();
    await saveProfile(repo, { goal: 'lose', timezone: undefined, onboarded: true }, now);
    expect((await repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile).toMatchObject({ goal: 'lose', timezone: expect.any(String), onboardedAt: now });
    expect(await repo.getMeta(PENDING_PROFILE_KEY)).toEqual({ goal: 'lose', onboarded: true });

    await task();
    expect(server.profilePatches).toEqual([{ goal: 'lose', onboarded: true }]);
    expect(await repo.getMeta(PENDING_PROFILE_KEY)).toBeNull();
    expect((await repo.getMeta<CachedProfile>(PROFILE_KEY))).toMatchObject({ fetchedAt: now, profile: { goal: 'lose', onboardedAt: expect.any(Number) } });
  });

  it('merges changes made before a sync into one request', async () => {
    const { repo, server, task } = await setup();
    await saveProfile(repo, { goal: 'gain' });
    await saveProfile(repo, { weightKg: 70 });
    await task();
    expect(server.profilePatches).toEqual([{ goal: 'gain', weightKg: 70 }]);
  });

  it('drops a change the server rejects, rather than retrying it forever', async () => {
    const { repo, server, task } = await setup();
    server.rejectProfile = true;
    await saveProfile(repo, { weightKg: 70 });
    await task();
    expect(await repo.getMeta(PENDING_PROFILE_KEY)).toBeNull();
  });

  it('fetches the profile when the copy on the phone is missing or old', async () => {
    const { repo, server, task } = await setup();
    server.profile = { ...server.profile, onboardedAt: 123 };
    await task();
    expect((await repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.onboardedAt).toBe(123);
    server.profile = { ...server.profile, onboardedAt: 456 };
    await task(); // fresh copy: not fetched again
    expect((await repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.onboardedAt).toBe(123);
  });
});
