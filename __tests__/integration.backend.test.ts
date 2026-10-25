/**
 * @jest-environment node
 *
 * Runs the app's data layer against a real backend. Skipped unless API_URL is set, for example:
 *   (in calorie-api) npx wrangler dev --local --port 8787
 *   API_URL=http://127.0.0.1:8787 npx jest __tests__/integration.backend.test.ts
 */
import { memorySecretStore, type SecretStore } from '../src/auth/secretStore';
import { deleteAccount, exportData } from '../src/data/account';
import { localDate } from '../src/data/dates';
import { saveGoals, saveProfile } from '../src/data/profile';
import { PROFILE_KEY, type CachedProfile } from '../src/data/settings';
import { scanRecord, shownFor } from '../src/scan/scanMath';
import { fromServer } from '../src/train/library';
import { openStack, type DataStack } from '../src/data/stack';
import { nodeFetch } from './helpers/nodeFetch';
import { memoryDb } from './helpers/sqljsDb';

const API_URL = process.env.API_URL;
const ids = () => globalThis.crypto.randomUUID();
// A deployed server is a round trip across the internet away, and the first call may wake it up.
jest.setTimeout(30_000);

const phone = async (store: SecretStore) =>
  openStack({ db: await memoryDb(), store, baseUrl: API_URL!, appVersion: '1.0.0', deviceLabel: 'integration test', ids, fetchImpl: nodeFetch });

(API_URL ? describe : describe.skip)(`data layer against ${API_URL}`, () => {
  const stacks: DataStack[] = [];
  // One account for the whole run: the server limits new anonymous accounts to 10 an hour per address.
  const account = memorySecretStore();
  afterAll(() => stacks.forEach((s) => s.sync.stop()));

  it('backs up from one phone and restores on another signed in to the same account', async () => {
    const store = account;
    const a = await phone(store);
    stacks.push(a);
    const today = localDate();
    const entry = await a.repo.addEntry({ name: 'Integration bobotie', calories: 610, proteinG: 32 });
    await a.repo.addWater(250);
    await a.sync.syncNow();
    expect(a.sync.current).toMatchObject({ state: 'idle', pending: 0 });
    expect(a.session.current?.isAnonymous).toBe(true);
    expect((await a.repo.entry(entry.id))?.rev).toBeGreaterThan(0);

    const b = await phone(store);
    stacks.push(b);
    await b.sync.syncNow();
    expect(await b.repo.entriesFor(today)).toEqual([expect.objectContaining({ id: entry.id, name: 'Integration bobotie', calories: 610 })]);
    expect(await b.repo.waterFor(today)).toBe(250);

    await b.repo.updateEntry(entry.id, { calories: 650 });
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect((await a.repo.entry(entry.id))?.calories).toBe(650);

    await a.repo.deleteEntry(entry.id);
    await a.sync.syncNow();
    await b.sync.syncNow();
    expect(await b.repo.entriesFor(today)).toEqual([]);
  });

  it('stores the onboarding answers, with the same goals the phone worked out', async () => {
    const a = await phone(account);
    stacks.push(a);
    const local = await saveProfile(a.repo, { sex: 'female', birthYear: 1990, heightCm: 165, weightKg: 70, activityLevel: 'light', goal: 'lose', goalRateKgPerWeek: -0.5, onboarded: true });
    await a.sync.syncNow();
    const stored = (await a.repo.getMeta<CachedProfile>(PROFILE_KEY))!;
    expect(stored.fetchedAt).toBeGreaterThan(0);
    expect(stored.profile.onboardedAt).not.toBeNull();
    expect(stored.profile.goals).toEqual(local.goals);
  });

  it('sends scan records the server accepts', async () => {
    const a = await phone(account);
    stacks.push(a);
    const plate = { calories: 643.7, mass: 312.4, fat: -0.2, carb: 70.6, protein: 38.2 };
    const saved = a.repo.newId();
    const rejected = a.repo.newId();
    await a.repo.recordScan(saved, scanRecord({ nutrition: plate, food: 0.97, outcome: 'edited', saved: shownFor(plate, 1.25), portion: 1.25, at: Date.now() }));
    await a.repo.recordScan(rejected, scanRecord({ nutrition: plate, food: 0.04, outcome: 'not_food', at: Date.now() }));
    await a.sync.syncNow();
    expect(await a.repo.unsentScans()).toEqual([]);
    const { data, error } = await a.api.GET('/v1/scans/{id}', { params: { path: { id: saved } } });
    expect(error).toBeUndefined();
    expect(data).toMatchObject({ outcome: 'edited', portion: 1.25, modelVersion: 'nutrition_v1' });
    expect((await a.api.GET('/v1/scans/{id}', { params: { path: { id: rejected } } })).data).toMatchObject({ outcome: 'not_food' });
  });

  it('backs up a workout and goals set by hand, and reads Plus status', async () => {
    const a = await phone(account);
    stacks.push(a);
    const w = await a.repo.addWorkout({
      workoutId: null, programId: null, title: 'Bodyweight full body', startedAt: Date.now() - 20 * 60_000, finishedAt: Date.now(), notes: null, rating: null, caloriesBurned: 120,
      sets: [{ exercise: 'bodyweight-squat', setNo: 1, reps: 12, weightKg: null, durationS: null }, { exercise: 'plank', setNo: 1, reps: null, weightKg: null, durationS: 30 }],
    });
    await saveGoals(a.repo, { calories: 1900, proteinG: 150, carbG: 180, fatG: 60 });
    await a.sync.syncNow();
    expect(a.sync.current).toMatchObject({ state: 'idle', pending: 0 });
    expect((await a.repo.workouts(localDate()))[0]).toMatchObject({ id: w.id, rev: expect.any(Number) });
    const sessions = await a.api.GET('/v1/training/sessions', { params: { query: { from: localDate(), to: localDate() } } });
    expect(sessions.error).toBeUndefined();
    expect(sessions.data?.items.map((s) => s.id)).toContain(w.id);
    expect((await a.api.GET('/v1/me/profile')).data?.goals).toMatchObject({ calories: 1900, custom: true });
    expect((await a.api.GET('/v1/entitlements')).data?.plan).toBe('free');
    await saveGoals(a.repo, 'recommended');
    await a.sync.syncNow();
    expect((await a.api.GET('/v1/me/profile')).data?.goals.custom).toBe(false);
  });

  // Needs workout content on the server: (in calorie-api) node scripts/import-content.mjs content/sample --publish
  it('lists programs, joins one and reads its next workout in the app\'s shape', async () => {
    const a = await phone(account);
    stacks.push(a);
    const programs = (await a.api.GET('/v1/programs')).data?.items ?? [];
    if (!programs.length) return console.warn('No programs on this server; import content/sample to test them.');
    const p = programs[0];
    await a.api.POST('/v1/programs/{slug}/enroll', { params: { path: { slug: p.slug } } });
    const enrollment = (await a.api.GET('/v1/programs/current')).data?.enrollment;
    expect(enrollment?.program.slug).toBe(p.slug);
    const next = enrollment!.progress.nextWorkout!;
    const detail = (await a.api.GET('/v1/workouts/{id}', { params: { path: { id: next.id } } })).data!;
    const plan = fromServer(detail, p.id);
    expect(plan.exercises.length).toBe(next.exerciseCount);
    expect(plan.exercises.every((e) => e.sets > 0 && (e.durationS || e.repsMin))).toBe(true);
    await a.api.DELETE('/v1/programs/{slug}/enroll', { params: { path: { slug: p.slug } } });
  });

  it('reads the profile and its goals', async () => {
    const a = await phone(account);
    stacks.push(a);
    await a.sync.syncNow();
    const { data, error } = await a.api.GET('/v1/me/profile');
    expect(error).toBeUndefined();
    expect(data?.goals.calories).toBeGreaterThanOrEqual(800);
  });

  // Last, because it ends the run's account.
  it('downloads the data, then deletes the account and empties the phone', async () => {
    const a = await phone(account);
    stacks.push(a);
    const exported = (await exportData(a)) as Record<string, unknown>;
    expect(JSON.stringify(exported)).toContain('Integration bobotie');
    const config = (await a.api.GET('/v1/config')).data;
    expect(config?.update).toBeDefined();
    await deleteAccount(a);
    expect(await a.repo.entriesFor(localDate())).toEqual([]);
    expect(await a.session.accessToken()).toBeNull();
  });
});
