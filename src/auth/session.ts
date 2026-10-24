import { unwrap, type Api } from '../api/client';
import { ApiError } from '../api/errors';
import type { SecretStore } from './secretStore';

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Milliseconds since 1970 when the access token stops working. */
  expiresAt: number;
  userId: string;
  isAnonymous: boolean;
};

const KEY = 'pango.session.v1';
/** Refresh this long before the access token expires. */
const EARLY_MS = 60_000;

type SessionBody = { accessToken: string; refreshToken: string; expiresIn: number; userId: string; isAnonymous: boolean };

/** Device checks (Play Integrity) are switched on for this server, and this build cannot pass them yet. */
export class IntegrityRequiredError extends Error {
  /** Trying again will not help until the app can do the check. */
  readonly retryable = false;
  constructor() {
    super('This server requires a device check that this build does not do yet.');
    this.name = 'IntegrityRequiredError';
  }
}

/**
 * Holds the signed-in session. New installs get an anonymous account (link Google or email later to keep the data).
 * Refresh tokens are single use, so refreshes are serialised and the new pair is saved before anyone uses it.
 */
export class SessionManager {
  private session: Session | null = null;
  private loaded = false;
  private refreshing: Promise<boolean> | null = null;
  private listeners = new Set<(s: Session | null) => void>();

  constructor(
    private store: SecretStore,
    /** A client without the token source, for the auth endpoints themselves. */
    private plain: Api,
    private now: () => number = Date.now,
  ) {}

  get current(): Session | null {
    return this.session;
  }

  onChange(fn: (s: Session | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async load(): Promise<Session | null> {
    if (!this.loaded) {
      const raw = await this.store.get(KEY);
      try {
        this.session = raw ? (JSON.parse(raw) as Session) : null;
      } catch {
        this.session = null;
      }
      this.loaded = true;
    }
    return this.session;
  }

  /** The saved session, or a new anonymous account. Needs the network only the first time. */
  async ensure(deviceLabel?: string): Promise<Session> {
    const existing = await this.load();
    if (existing) return existing;
    const challenge = await unwrap(this.plain.GET('/v1/auth/challenge'));
    if (challenge.required) throw new IntegrityRequiredError();
    const body = await unwrap(this.plain.POST('/v1/auth/anonymous', { body: deviceLabel ? { deviceLabel } : {} }));
    return this.save(body);
  }

  /** A usable access token, refreshing first if it is about to expire. Null when signed out. */
  async accessToken(): Promise<string | null> {
    const s = await this.load();
    if (!s) return null;
    if (s.expiresAt - EARLY_MS <= this.now()) {
      const ok = await this.refresh();
      if (!ok) return null;
    }
    return this.session?.accessToken ?? null;
  }

  /** Swaps the refresh token for a new pair. Resolves false when the session is gone (it is then cleared). */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const s = await this.load();
    if (!s) return false;
    try {
      const body = await unwrap(this.plain.POST('/v1/auth/refresh', { body: { refreshToken: s.refreshToken } }));
      await this.save(body);
      return true;
    } catch (e) {
      // A rejected refresh token will never work again; anything else (offline, server down) might.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await this.clear();
        return false;
      }
      throw e;
    }
  }

  async signOut(): Promise<void> {
    const s = await this.load();
    if (s) {
      await unwrap(this.plain.POST('/v1/auth/logout', { body: { refreshToken: s.refreshToken } })).catch(() => {});
    }
    await this.clear();
  }

  private async save(body: SessionBody): Promise<Session> {
    const session: Session = {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt: this.now() + body.expiresIn * 1000,
      userId: body.userId,
      isAnonymous: body.isAnonymous,
    };
    await this.store.set(KEY, JSON.stringify(session));
    this.session = session;
    this.loaded = true;
    this.listeners.forEach((fn) => fn(session));
    return session;
  }

  private async clear(): Promise<void> {
    await this.store.remove(KEY);
    this.session = null;
    this.listeners.forEach((fn) => fn(null));
  }
}
