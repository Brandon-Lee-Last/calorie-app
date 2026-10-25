import { DELETE_CONFIRM, deleteAccount, exportData, exportFileName } from '../src/data/account';
import { localDate } from '../src/data/dates';
import { PROFILE_KEY } from '../src/data/settings';
import { noticeFor, storeUrl, type ServerConfig } from '../src/data/serverConfig';
import { momentOutfit } from '../src/pango/moments';
import { FakeServer } from './helpers/fakeServer';
import { testStack } from './helpers/screen';

describe('dress for the moment', () => {
  const day = new Date(2026, 9, 25);
  it('borrows the outfit for the occasion while it is on', () => {
    expect(momentOutfit('train', true, day)).toBe('gym');
    expect(momentOutfit('cooking', true, day)).toBe('chef');
    expect(momentOutfit('celebrate', true, day)).toBe('party');
    expect(momentOutfit(undefined, true, day)).toBeNull();
    expect(momentOutfit('train', false, day)).toBeNull();
  });

  it('wears the protea everywhere on Heritage Day', () => {
    const heritage = new Date(2026, 8, 24, 9);
    expect(momentOutfit(undefined, true, heritage)).toBe('protea');
    expect(momentOutfit('train', true, heritage)).toBe('protea');
    expect(momentOutfit(undefined, false, heritage)).toBeNull();
  });
});

describe('server notices', () => {
  const config = (over: Partial<ServerConfig> = {}) =>
    ({ update: 'none', latestAppVersion: '1.0.0', maintenance: { enabled: false, message: '' }, urls: { store: null, privacy: null, terms: null, supportEmail: null }, ...over }) as ServerConfig;

  it('blocks an app too old to sync, then notes maintenance, then a newer version until closed', () => {
    expect(noticeFor(undefined, null)).toBeNull();
    expect(noticeFor(config(), null)).toBeNull();
    expect(noticeFor(config({ update: 'required', maintenance: { enabled: true, message: 'Back soon.' } }), null)).toEqual({ kind: 'required' });
    expect(noticeFor(config({ update: 'available', latestAppVersion: '1.2.0', maintenance: { enabled: true, message: 'Back soon.' } }), null)).toEqual({ kind: 'maintenance', message: 'Back soon.' });
    expect(noticeFor(config({ update: 'available', latestAppVersion: '1.2.0' }), null)).toEqual({ kind: 'update', version: '1.2.0' });
    expect(noticeFor(config({ update: 'available', latestAppVersion: '1.2.0' }), '1.2.0')).toBeNull();
    expect(noticeFor(config({ update: 'available', latestAppVersion: '1.3.0' }), '1.2.0')).toEqual({ kind: 'update', version: '1.3.0' });
  });

  it("sends people to the server's store link, or the app's Play Store page", () => {
    expect(storeUrl(config())).toBe('https://play.google.com/store/apps/details?id=io.lightarch.pango');
    expect(storeUrl(config({ urls: { store: 'https://example.org/app', privacy: null, terms: null, supportEmail: null } }))).toBe('https://example.org/app');
  });
});

describe('deleting the account', () => {
  it('deletes it on the server, then empties the phone, with no sync in between', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    await stack.sync.syncNow();
    expect(server.records.size).toBe(1);

    const calls = server.calls.length;
    const done = deleteAccount(stack);
    // A round asked for meanwhile does not start: it would make a new account and upload the diary to it.
    stack.sync.schedule(0);
    await stack.sync.syncNow();
    expect(await done).toEqual({ subscriptionNote: null });
    expect(server.calls.slice(calls)).toEqual(['DELETE /v1/account']);
    expect(server.deletedAccounts).toEqual(['user-1']);
    expect(await stack.repo.entriesFor(localDate())).toEqual([]);
    expect(await stack.repo.getMeta(PROFILE_KEY)).toBeNull();
    expect(await stack.repo.pendingCount()).toBe(0);
    expect(await stack.session.accessToken()).toBeNull();
    stack.sync.stop();
  });

  it('only empties the phone when it never reached the server', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    await deleteAccount(stack);
    expect(server.calls).not.toContain('DELETE /v1/account');
    expect(await stack.repo.entriesFor(localDate())).toEqual([]);
    stack.sync.stop();
  });

  it('keeps everything when the server cannot be reached', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    await stack.sync.syncNow();
    server.online = false;
    await expect(deleteAccount(stack)).rejects.toBeTruthy();
    expect(await stack.repo.entriesFor(localDate())).toHaveLength(1);
    expect(await stack.session.accessToken()).not.toBeNull();
    stack.sync.stop();
  });

  it('asks the server with the exact words it expects', () => {
    expect(DELETE_CONFIRM).toBe('DELETE MY ACCOUNT');
  });
});

describe('downloading your data', () => {
  it('backs up what is waiting first, then fetches everything', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    const data = (await exportData(stack)) as { records: { name?: string }[] };
    expect(data.records.map((r) => r.name)).toEqual(['Oats']);
    expect(exportFileName('2026-10-25')).toBe('pango-data-2026-10-25.json');
    stack.sync.stop();
  });

  it('says so when it cannot back up first', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    server.online = false;
    await expect(exportData(stack)).rejects.toBeTruthy();
    stack.sync.stop();
  });
});
