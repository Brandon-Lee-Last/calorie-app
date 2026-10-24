import { createApi, unwrap } from '../src/api/client';
import { memorySecretStore } from '../src/auth/secretStore';
import { IntegrityRequiredError, SessionManager } from '../src/auth/session';
import { FakeServer } from './helpers/fakeServer';

function setup(server = new FakeServer(), clock = { t: 1_000_000 }) {
  const store = memorySecretStore();
  const plain = createApi({ baseUrl: 'http://api.test', fetchImpl: server.fetch, appVersion: '1.2.3' });
  const session = new SessionManager(store, plain, () => clock.t);
  const api = createApi({
    baseUrl: 'http://api.test',
    fetchImpl: server.fetch,
    tokens: { accessToken: () => session.accessToken(), refreshAfterUnauthorized: () => session.refresh() },
  });
  return { server, clock, store, session, api };
}

describe('SessionManager', () => {
  it('creates an anonymous account once and remembers it', async () => {
    const { server, store, session } = setup();
    const s = await session.ensure('Pixel');
    expect(s).toMatchObject({ userId: 'user-1', isAnonymous: true, expiresAt: 1_000_000 + 900_000 });
    expect(JSON.parse((await store.get('pango.session.v1'))!).refreshToken).toBe(s.refreshToken);
    await session.ensure();
    expect(server.calls.filter((c) => c.endsWith('/auth/anonymous'))).toHaveLength(1);
  });

  it('refuses to sign up when the server wants a device check this build cannot do', async () => {
    const server = new FakeServer();
    server.integrityRequired = true;
    await expect(setup(server).session.ensure()).rejects.toBeInstanceOf(IntegrityRequiredError);
  });

  it('refreshes ahead of expiry, once for many callers, and saves the new pair', async () => {
    const { server, clock, store, session } = setup();
    const first = await session.ensure();
    clock.t += 899_000;
    const tokens = await Promise.all([session.accessToken(), session.accessToken(), session.accessToken()]);
    expect(new Set(tokens).size).toBe(1);
    expect(tokens[0]).not.toBe(first.accessToken);
    expect(server.calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(JSON.parse((await store.get('pango.session.v1'))!).refreshToken).not.toBe(first.refreshToken);
  });

  it('signs out locally when the refresh token is refused', async () => {
    const { server, session, store } = setup();
    await session.ensure();
    server.refreshTokens.clear();
    expect(await session.refresh()).toBe(false);
    expect(session.current).toBeNull();
    expect(await store.get('pango.session.v1')).toBeNull();
  });

  it('keeps the session when refreshing fails for lack of a connection', async () => {
    const { server, session } = setup();
    await session.ensure();
    server.online = false;
    await expect(session.refresh()).rejects.toMatchObject({ code: 'network' });
    expect(session.current).not.toBeNull();
  });
});

describe('createApi', () => {
  it('retries once with a fresh token after a 401', async () => {
    const { server, session, api } = setup();
    await session.ensure();
    server.accessTokens.clear(); // the server forgot the token early
    const res = await unwrap(api.GET('/v1/sync/pull', { params: { query: { since: 0, limit: 10 } } }));
    expect(res).toMatchObject({ changes: [], hasMore: false });
    expect(server.calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('turns failures into ApiErrors', async () => {
    const { server, session, api } = setup();
    await session.ensure();
    await expect(unwrap(api.GET('/v1/me'))).rejects.toMatchObject({ status: 404, code: 'not_found' });
    server.online = false;
    await expect(unwrap(api.GET('/v1/me'))).rejects.toMatchObject({ status: 0, code: 'network', retryable: true });
  });
});
