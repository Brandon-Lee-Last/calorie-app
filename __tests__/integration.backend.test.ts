/**
 * @jest-environment node
 *
 * Runs the app's data layer against a real backend. Skipped unless API_URL is set, for example:
 *   (in calorie-api) npx wrangler dev --local --port 8787
 *   API_URL=http://127.0.0.1:8787 npx jest __tests__/integration.backend.test.ts
 */
import { memorySecretStore, type SecretStore } from '../src/auth/secretStore';
import { localDate } from '../src/data/dates';
import { openStack, type DataStack } from '../src/data/stack';
import { nodeFetch } from './helpers/nodeFetch';
import { memoryDb } from './helpers/sqljsDb';

const API_URL = process.env.API_URL;
const ids = () => globalThis.crypto.randomUUID();

const phone = async (store: SecretStore) =>
  openStack({ db: await memoryDb(), store, baseUrl: API_URL!, appVersion: '1.0.0', deviceLabel: 'integration test', ids, fetchImpl: nodeFetch });

(API_URL ? describe : describe.skip)(`data layer against ${API_URL}`, () => {
  const stacks: DataStack[] = [];
  afterAll(() => stacks.forEach((s) => s.sync.stop()));

  it('backs up from one phone and restores on another signed in to the same account', async () => {
    const store = memorySecretStore();
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

  it('reads the profile and its goals', async () => {
    const a = await phone(memorySecretStore());
    stacks.push(a);
    await a.sync.syncNow();
    const { data, error } = await a.api.GET('/v1/me/profile');
    expect(error).toBeUndefined();
    expect(data?.goals.calories).toBeGreaterThanOrEqual(800);
  });
});
