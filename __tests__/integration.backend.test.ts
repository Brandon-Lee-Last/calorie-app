/**
 * @jest-environment node
 *
 * Runs the app's data layer against a real backend. Skipped unless API_URL is set, for example:
 *   (in calorie-api) npx wrangler dev --local --port 8787
 *   API_URL=http://127.0.0.1:8787 npx jest __tests__/integration.backend.test.ts
 */
import { memorySecretStore, type SecretStore } from '../src/auth/secretStore';
import { localDate } from '../src/data/dates';
import { saveProfile } from '../src/data/profile';
import { PROFILE_KEY, type CachedProfile } from '../src/data/settings';
import { scanRecord, shownFor } from '../src/scan/scanMath';
import { openStack, type DataStack } from '../src/data/stack';
import { nodeFetch } from './helpers/nodeFetch';
import { memoryDb } from './helpers/sqljsDb';

const API_URL = process.env.API_URL;
const ids = () => globalThis.crypto.randomUUID();

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

  it('reads the profile and its goals', async () => {
    const a = await phone(account);
    stacks.push(a);
    await a.sync.syncNow();
    const { data, error } = await a.api.GET('/v1/me/profile');
    expect(error).toBeUndefined();
    expect(data?.goals.calories).toBeGreaterThanOrEqual(800);
  });
});
