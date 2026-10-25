import { unwrap } from '../api/client';
import type { DataStack } from './stack';

/** What the server needs to hear before it deletes an account. */
export const DELETE_CONFIRM = 'DELETE MY ACCOUNT' as const;

/**
 * Deletes the account on the server, then empties the phone, with syncing held so no round in between can upload the
 * data again. A phone that never reached the server has nothing there to delete. If the server cannot be reached,
 * this throws and the phone keeps everything.
 */
export async function deleteAccount({ api, repo, session, sync }: Pick<DataStack, 'api' | 'repo' | 'session' | 'sync'>): Promise<{ subscriptionNote: string | null }> {
  return sync.hold(async () => {
    let subscriptionNote: string | null = null;
    if (await session.accessToken()) {
      const done = await unwrap(api.DELETE('/v1/account', { body: { confirm: DELETE_CONFIRM } }));
      subscriptionNote = done.subscriptionNote;
    }
    await session.forget();
    await repo.wipeAll();
    return { subscriptionNote };
  });
}

/** Everything the server holds about the account, after sending what is still waiting on the phone. */
export async function exportData({ api, sync }: Pick<DataStack, 'api' | 'sync'>): Promise<unknown> {
  await sync.syncNow();
  if (sync.current.state === 'offline' || sync.current.state === 'error') throw new Error(sync.current.lastError ?? 'The server could not be reached');
  return unwrap(api.GET('/v1/account/export'));
}

/** "pango-data-2026-10-25.json" */
export const exportFileName = (date: string) => `pango-data-${date}.json`;
