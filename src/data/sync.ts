import { unwrap, type Api } from '../api/client';
import { ApiError } from '../api/errors';
import type { Db, Statements } from '../db/types';
import { areaOf, enqueue, type Area, type Repo } from './repo';
import { TABLES, fromRow, pushData, writeRecord, type SyncType } from './tables';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'signed-out' | 'error';
export type SyncStatus = { state: SyncState; pending: number; lastSyncedAt: number | null; lastError: string | null };

type OutboxRow = { seq: number; type: SyncType; record_id: string; op: 'upsert' | 'delete'; data: string | null; client_updated_at: number; attempts: number };
type Change = { type: SyncType; record: { id: string; rev: number; deletedAt: number | null; clientUpdatedAt?: number } & Record<string, unknown> };

const BATCH = 50;
const PULL_LIMIT = 200;
const REV_KEY = 'sync.rev';
const LAST_KEY = 'sync.lastSyncedAt';
const USER_KEY = 'sync.userId';
/** Errors the server will give again for the same op, so retrying is pointless. */
const PERMANENT = new Set(['validation_failed', 'bad_request', 'payload_too_large']);
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Sends queued changes and pulls changes from other devices.
 * - Push first, so local edits reach the server before its copy comes back.
 * - The server keeps the edit with the latest `clientUpdatedAt`; a `stale` result means another device won.
 * - A pulled record that still has a local change queued is skipped; the queued change settles it.
 * - Offline or server errors back off (2 s doubling to 5 min) and retry. Errors marked `retryable: false` do not.
 * - When the account changes (say the database came back from an Android backup, but the session could not), the
 *   phone's data is uploaded again to the new account. Signing out on purpose must therefore clear the database.
 */
export class SyncEngine {
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private status: SyncStatus = { state: 'idle', pending: 0, lastSyncedAt: null, lastError: null };
  private listeners = new Set<(s: SyncStatus) => void>();
  private tasks: (() => Promise<void>)[] = [];

  constructor(
    private repo: Repo,
    private api: Api,
    /** The account to sync as (creating one if need be), or null when there is none. */
    private account: () => string | null | Promise<string | null>,
    private now: () => number = Date.now,
  ) {}

  private get db(): Db {
    return this.repo.db;
  }

  get current(): SyncStatus {
    return this.status;
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((fn) => fn(this.status));
  }

  /** Syncs soon, coalescing bursts of edits into one round. */
  schedule(delayMs = 1500): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.syncNow().catch(() => {});
    }, delayMs);
  }

  /** Adds work to every round, after the diary is in step (profile changes, scan records). Errors fail the round. */
  addTask(task: () => Promise<void>): void {
    this.tasks.push(task);
  }

  /** Syncs a moment after each local change. Returns a function that stops listening. */
  watch(): () => void {
    return this.repo.onChange((areas) => {
      if (!areas.has('outbox')) return;
      this.repo.pendingCount().then((pending) => this.set({ pending }), () => {});
      this.schedule();
    });
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** One full round (push, pull, push anything new). Calls during a round queue one more round. */
  syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.round().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        this.schedule(0);
      }
    });
    return this.running;
  }

  private async round(): Promise<void> {
    this.set({ state: 'syncing' });
    try {
      const userId = await this.account();
      if (!userId) {
        this.set({ state: 'signed-out', pending: await this.repo.pendingCount() });
        return;
      }
      await this.adopt(userId);
      const pushedBefore = await this.push();
      await this.pull();
      if (pushedBefore) await this.push();
      for (const task of this.tasks) await task();
      const lastSyncedAt = this.now();
      await this.repo.setMeta(LAST_KEY, lastSyncedAt);
      this.failures = 0;
      this.set({ state: 'idle', lastSyncedAt, lastError: null, pending: await this.repo.pendingCount() });
    } catch (e) {
      const offline = e instanceof ApiError && e.status === 0;
      const retryable = (e as { retryable?: boolean }).retryable ?? true;
      this.failures++;
      this.set({ state: offline ? 'offline' : 'error', lastError: e instanceof Error ? e.message : String(e), pending: await this.repo.pendingCount() });
      if (retryable) this.schedule(Math.min(MAX_BACKOFF_MS, 2000 * 2 ** (this.failures - 1)));
      throw e;
    }
  }

  /** Sends the outbox in batches. Resolves true when anything was sent. */
  private async push(): Promise<boolean> {
    let sent = false;
    for (;;) {
      const ops = await this.db.all<OutboxRow>('SELECT * FROM outbox WHERE attempts < 20 ORDER BY seq LIMIT ?', [BATCH]);
      if (!ops.length) return sent;
      const { results } = await unwrap(
        this.api.POST('/v1/sync/push', {
          body: {
            ops: ops.map((o) =>
              o.op === 'upsert'
                ? { type: o.type, id: o.record_id, op: 'upsert' as const, data: JSON.parse(o.data ?? '{}') }
                : { type: o.type, id: o.record_id, op: 'delete' as const, clientUpdatedAt: o.client_updated_at },
            ),
          },
        }),
      );
      sent = true;
      let settled = 0;
      const touched = new Set<Area>();
      await this.db.transaction(async (tx) => {
        for (const result of results) {
          const op = ops.find((o) => o.type === result.type && o.record_id === result.id);
          if (!op) continue;
          const now = await tx.get<{ client_updated_at: number }>('SELECT client_updated_at FROM outbox WHERE type = ? AND record_id = ?', [op.type, op.record_id]);
          // A newer edit queued while this one was in flight stays queued and wins on the next push.
          const unchanged = now?.client_updated_at === op.client_updated_at;
          const record = result.record as Change['record'] | undefined;
          if (result.status === 'error') {
            if (PERMANENT.has(result.error?.code ?? '')) {
              await tx.run('DELETE FROM outbox WHERE seq = ?', [op.seq]);
              settled++;
            } else {
              await tx.run('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE seq = ?', [result.error?.message ?? 'error', op.seq]);
            }
            continue;
          }
          if (unchanged) {
            if (record) await applyRecord(tx, result.type, record, touched);
            else if (op.op === 'delete') await removeLocal(tx, result.type, result.id, touched);
            await tx.run('DELETE FROM outbox WHERE seq = ?', [op.seq]);
          }
          settled++;
        }
      });
      if (touched.size) this.repo.emit(...touched);
      // Stop when the queue is drained, or when a batch made no progress (its ops failed and will retry next round;
      // after 20 tries an op stops blocking the queue).
      if (ops.length < BATCH || settled === 0) return sent;
    }
  }

  private async pull(): Promise<void> {
    let since = (await this.repo.getMeta<number>(REV_KEY)) ?? 0;
    for (;;) {
      let page;
      try {
        page = await unwrap(this.api.GET('/v1/sync/pull', { params: { query: { since, limit: PULL_LIMIT } } }));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'resync_required') {
          await this.resetForResync();
          since = 0;
          continue;
        }
        throw e;
      }
      const touched = new Set<Area>();
      await this.db.transaction(async (tx) => {
        for (const change of page.changes as Change[]) {
          const pending = await tx.get<{ seq: number }>('SELECT seq FROM outbox WHERE type = ? AND record_id = ?', [change.type, change.record.id]);
          if (pending) continue;
          await applyRecord(tx, change.type, change.record, touched);
        }
        await tx.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [REV_KEY, JSON.stringify(page.rev)]);
      });
      if (touched.size) this.repo.emit(...touched);
      since = page.rev;
      if (!page.hasMore) return;
    }
  }

  /** Remembers which account this phone's data belongs to; on a change, queues all of it for the new account. */
  private async adopt(userId: string): Promise<void> {
    const last = await this.repo.getMeta<string>(USER_KEY);
    if (last === userId) return;
    if (last) {
      await this.db.transaction(async (tx) => {
        for (const spec of Object.values(TABLES)) {
          if (!spec) continue;
          for (const row of await tx.all<Record<string, unknown>>(`SELECT * FROM ${spec.table}`)) {
            const record = fromRow<Record<string, unknown>>(spec, row);
            await enqueue(tx, spec.type, record.id as string, 'upsert', pushData(spec, record), record.clientUpdatedAt as number);
          }
          await tx.run(`UPDATE ${spec.table} SET rev = 0`);
        }
        // Types this app does not show yet cannot be re-sent faithfully; they stay with the old account.
        await tx.run('DELETE FROM remote_records');
        await tx.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [REV_KEY, '0']);
      });
    }
    await this.repo.setMeta(USER_KEY, userId);
  }

  /** The server forgot old deletions: drop everything it has confirmed and pull from scratch. Queued edits stay. */
  private async resetForResync(): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const spec of Object.values(TABLES)) {
        if (!spec) continue;
        await tx.run(`DELETE FROM ${spec.table} WHERE rev > 0 AND id NOT IN (SELECT record_id FROM outbox WHERE type = ?)`, [spec.type]);
      }
      await tx.run('DELETE FROM remote_records');
      await tx.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [REV_KEY, '0']);
    });
    this.repo.emit('diary', 'water', 'weight', 'workout');
  }
}

async function applyRecord(tx: Statements, type: SyncType, record: Change['record'], touched: Set<Area>): Promise<void> {
  if (record.deletedAt) return removeLocal(tx, type, record.id, touched);
  const spec = TABLES[type];
  if (spec) {
    await writeRecord(tx, spec, record);
    touched.add(areaOf(type) ?? 'meta');
  } else {
    await tx.run('INSERT OR REPLACE INTO remote_records (type, id, json, rev) VALUES (?, ?, ?, ?)', [type, record.id, JSON.stringify(record), record.rev]);
  }
}

async function removeLocal(tx: Statements, type: SyncType, id: string, touched: Set<Area>): Promise<void> {
  const spec = TABLES[type];
  if (spec) {
    await tx.run(`DELETE FROM ${spec.table} WHERE id = ?`, [id]);
    touched.add(areaOf(type) ?? 'meta');
  } else {
    await tx.run('DELETE FROM remote_records WHERE type = ? AND id = ?', [type, id]);
  }
}
