import { createApi } from '../src/api/client';
import { memorySecretStore } from '../src/auth/secretStore';
import { IntegrityRequiredError, SessionManager } from '../src/auth/session';
import { Repo } from '../src/data/repo';
import { SyncEngine } from '../src/data/sync';
import { migrate } from '../src/db/migrations';
import { FakeServer } from './helpers/fakeServer';
import { memoryDb } from './helpers/sqljsDb';

let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const engines: SyncEngine[] = [];

/** One phone: its own database and engine, signed in to the shared fake server. */
async function device(server: FakeServer, clock: { t: number }, store = memorySecretStore()) {
  const db = await memoryDb();
  await migrate(db);
  const now = () => clock.t;
  const repo = new Repo(db, ids, now);
  // Looked up per request, so a test can swap server.fetch to intercept calls.
  const fetchImpl = (req: Request) => server.fetch(req);
  const plain = createApi({ baseUrl: 'http://api.test', fetchImpl });
  const session = new SessionManager(store, plain, now);
  const api = createApi({
    baseUrl: 'http://api.test',
    fetchImpl,
    tokens: { accessToken: () => session.accessToken(), refreshAfterUnauthorized: () => session.refresh() },
  });
  const sync = new SyncEngine(repo, api, () => session.current?.userId ?? null, now);
  engines.push(sync);
  await session.ensure('test phone');
  return { db, repo, session, sync, store };
}

describe('SyncEngine', () => {
  let server: FakeServer;
  const clock = { t: new Date(2026, 9, 22, 12).getTime() };
  beforeEach(() => {
    server = new FakeServer();
    clock.t = new Date(2026, 9, 22, 12).getTime();
  });
  afterEach(() => {
    engines.splice(0).forEach((e) => e.stop());
    jest.useRealTimers();
  });

  it('pushes queued changes and records the server revision', async () => {
    const a = await device(server, clock);
    const e = await a.repo.addEntry({ name: 'Chicken and rice', calories: 540 });
    await a.sync.syncNow();
    expect(await a.repo.pendingCount()).toBe(0);
    expect((await a.repo.entriesFor('2026-10-22'))[0]).toMatchObject({ id: e.id, rev: 1 });
    expect(a.sync.current).toMatchObject({ state: 'idle', pending: 0, lastError: null });
  });

  it('brings a second phone up to date, edits and deletes included', async () => {
    const a = await device(server, clock);
    const b = await device(server, clock, a.store);
    const e = await a.repo.addEntry({ name: 'Rusks', calories: 380 });
    await a.repo.addWater(250);
    await a.sync.syncNow();
    await b.sync.syncNow();
    expect(await b.repo.entriesFor('2026-10-22')).toEqual([expect.objectContaining({ id: e.id, name: 'Rusks' })]);
    expect(await b.repo.waterFor('2026-10-22')).toBe(250);

    clock.t += 60_000;
    await b.repo.updateEntry(e.id, { calories: 400 });
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect((await a.repo.entriesFor('2026-10-22'))[0].calories).toBe(400);

    clock.t += 60_000;
    await a.repo.deleteEntry(e.id);
    await a.sync.syncNow();
    await b.sync.syncNow();
    expect(await b.repo.entriesFor('2026-10-22')).toEqual([]);
  });

  it('lets the later edit win when two phones change the same entry', async () => {
    const a = await device(server, clock);
    const b = await device(server, clock, a.store);
    const e = await a.repo.addEntry({ name: 'Pap', calories: 300 });
    await a.sync.syncNow();
    await b.sync.syncNow();
    clock.t += 1000;
    await a.repo.updateEntry(e.id, { calories: 350 });
    clock.t += 1000;
    await b.repo.updateEntry(e.id, { calories: 420 });
    await b.sync.syncNow();
    await a.sync.syncNow(); // a's older edit comes back stale; the server copy replaces it
    expect((await a.repo.entriesFor('2026-10-22'))[0].calories).toBe(420);
    expect(await a.repo.pendingCount()).toBe(0);
  });

  it('keeps an edit made while a push was in flight', async () => {
    const a = await device(server, clock);
    const e = await a.repo.addEntry({ name: 'Bobotie', calories: 610 });
    const realFetch = server.fetch;
    let edited = false;
    server.fetch = async (req) => {
      if (req.url.endsWith('/v1/sync/push') && !edited) {
        edited = true;
        clock.t += 500;
        await a.repo.updateEntry(e.id, { calories: 650 });
      }
      return realFetch(req);
    };
    await a.sync.syncNow();
    server.fetch = realFetch;
    // The round pushes again after pulling, so the newer edit is already on the server.
    expect(await a.repo.pendingCount()).toBe(0);
    expect([...server.records.values()][0].calories).toBe(650);
    expect((await a.repo.entriesFor('2026-10-22'))[0].calories).toBe(650);
  });

  it('drops a change the server rejects as invalid, and keeps going', async () => {
    const a = await device(server, clock);
    await a.repo.addEntry({ name: 'Bad', calories: -5 });
    await a.repo.addEntry({ name: 'Good', calories: 100 });
    await a.sync.syncNow();
    expect(await a.repo.pendingCount()).toBe(0);
    expect([...server.records.values()].map((r) => r.name)).toEqual(['Good']);
  });

  it('keeps records of types the app does not show yet', async () => {
    const a = await device(server, clock);
    server.remoteWrite('recipe', { id: 'r1', name: 'Bobotie', clientUpdatedAt: 1 });
    await a.sync.syncNow();
    expect(await a.db.all('SELECT type, id FROM remote_records')).toEqual([{ type: 'recipe', id: 'r1' }]);
  });

  it('pulls page by page', async () => {
    const a = await device(server, clock);
    for (let i = 0; i < 7; i++) server.remoteWrite('water', { id: `w${i}`, loggedAt: clock.t, localDate: '2026-10-22', ml: 100, clientUpdatedAt: 1 });
    server.pullPageSize = 3;
    await a.sync.syncNow();
    expect(await a.repo.waterFor('2026-10-22')).toBe(700);
    expect(server.calls.filter((c) => c.endsWith('/sync/pull'))).toHaveLength(3);
  });

  it('starts over when the server says too much time has passed', async () => {
    const a = await device(server, clock);
    server.remoteWrite('water', { id: 'w1', loggedAt: clock.t, localDate: '2026-10-22', ml: 250, clientUpdatedAt: 1 });
    await a.sync.syncNow();
    const keep = await a.repo.addEntry({ name: 'Unsent', calories: 90 });
    server.records.delete('water:w1'); // purged on the server long ago
    server.remoteWrite('water', { id: 'w2', loggedAt: clock.t, localDate: '2026-10-22', ml: 300, clientUpdatedAt: 1 });
    server.purgedRev = server.rev + 1;
    server.online = false;
    await a.sync.syncNow().catch(() => {});
    server.online = true;
    await a.sync.syncNow();
    expect(await a.repo.waterFor('2026-10-22')).toBe(300);
    expect((await a.repo.entriesFor('2026-10-22')).map((e) => e.id)).toEqual([keep.id]);
  });

  it('reports offline and retries with backoff', async () => {
    jest.useFakeTimers();
    const a = await device(server, clock);
    await a.repo.addEntry({ name: 'Snack', calories: 120 });
    server.online = false;
    await expect(a.sync.syncNow()).rejects.toMatchObject({ code: 'network' });
    expect(a.sync.current).toMatchObject({ state: 'offline', pending: 1 });
    server.online = true;
    await jest.advanceTimersByTimeAsync(2100);
    expect(a.sync.current).toMatchObject({ state: 'idle', pending: 0 });
  });

  it('syncs shortly after a local change once watching', async () => {
    jest.useFakeTimers();
    const a = await device(server, clock);
    const stop = a.sync.watch();
    await a.repo.addWater(250);
    await jest.advanceTimersByTimeAsync(10);
    expect(a.sync.current).toMatchObject({ state: 'idle', pending: 1 });
    await jest.advanceTimersByTimeAsync(1600);
    expect(a.sync.current).toMatchObject({ state: 'idle', pending: 0 });
    expect(server.records.size).toBe(1);
    stop();
  });

  it('creates the account on the first round that reaches the server', async () => {
    jest.useFakeTimers();
    const db = await memoryDb();
    await migrate(db);
    const repo = new Repo(db, ids, () => clock.t);
    const fetchImpl = (req: Request) => server.fetch(req);
    const session = new SessionManager(memorySecretStore(), createApi({ baseUrl: 'http://api.test', fetchImpl }), () => clock.t);
    const api = createApi({ baseUrl: 'http://api.test', fetchImpl, tokens: { accessToken: () => session.accessToken(), refreshAfterUnauthorized: () => session.refresh() } });
    const sync = new SyncEngine(repo, api, async () => (await session.ensure('test phone')).userId, () => clock.t);
    engines.push(sync);
    await repo.addEntry({ name: 'Offline breakfast', calories: 300 });
    server.online = false;
    await expect(sync.syncNow()).rejects.toMatchObject({ code: 'network' });
    expect(session.current).toBeNull();
    server.online = true;
    await jest.advanceTimersByTimeAsync(2100);
    expect(session.current).not.toBeNull();
    expect(sync.current).toMatchObject({ state: 'idle', pending: 0 });
  });

  it('uploads everything again when the phone ends up on a new account', async () => {
    const a = await device(server, clock);
    const kept = await a.repo.addEntry({ name: 'Restored lunch', calories: 450 });
    await a.repo.addWater(500);
    server.remoteWrite('recipe', { id: 'r1', name: 'Old recipe', clientUpdatedAt: 1 });
    await a.sync.syncNow();
    expect(await a.repo.pendingCount()).toBe(0);

    // The database survives (an Android backup) but the session does not: a new anonymous account on a new server.
    const other = new FakeServer();
    other.userId = 'user-2';
    const fetchImpl = (req: Request) => other.fetch(req);
    const session = new SessionManager(memorySecretStore(), createApi({ baseUrl: 'http://api.test', fetchImpl }), () => clock.t);
    const api = createApi({ baseUrl: 'http://api.test', fetchImpl, tokens: { accessToken: () => session.accessToken(), refreshAfterUnauthorized: () => session.refresh() } });
    const sync = new SyncEngine(a.repo, api, async () => (await session.ensure('test phone')).userId, () => clock.t);
    engines.push(sync);
    await sync.syncNow();

    expect([...other.records.values()].map((r) => r.id).sort()).toEqual([kept.id, expect.any(String)].sort());
    expect(await a.repo.entry(kept.id)).toMatchObject({ name: 'Restored lunch', rev: expect.any(Number) });
    expect(await a.db.all('SELECT * FROM remote_records')).toEqual([]);
    expect(await a.repo.pendingCount()).toBe(0);

    // Same account again: nothing is re-sent.
    const pushes = other.calls.filter((c) => c.endsWith('/sync/push')).length;
    await a.repo.addWater(250);
    await sync.syncNow();
    expect(other.calls.filter((c) => c.endsWith('/sync/push')).length).toBe(pushes + 1);
    expect(other.records.size).toBe(3);
  });

  it('does not retry when the server needs a device check this build cannot do', async () => {
    jest.useFakeTimers();
    const a = await device(server, clock);
    const sync = new SyncEngine(a.repo, createApi({ baseUrl: 'http://api.test' }), async () => {
      throw new IntegrityRequiredError();
    });
    engines.push(sync);
    await expect(sync.syncNow()).rejects.toBeInstanceOf(IntegrityRequiredError);
    expect(sync.current.state).toBe('error');
    expect(jest.getTimerCount()).toBe(0);
  });
});
