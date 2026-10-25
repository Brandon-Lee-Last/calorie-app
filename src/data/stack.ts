import { AppState } from 'react-native';

import { createApi, type Api, type ApiOptions } from '../api/client';
import type { SecretStore } from '../auth/secretStore';
import { SessionManager } from '../auth/session';
import { migrate } from '../db/migrations';
import type { Db } from '../db/types';
import { entitlementTask } from './entitlement';
import { profileTask } from './profile';
import { Repo } from './repo';
import { scanTask } from './scanTask';
import { SyncEngine } from './sync';

/** Everything behind the screens: the phone's database, the account and the sync engine. */
export type DataStack = { db: Db; repo: Repo; session: SessionManager; api: Api; sync: SyncEngine };

export type StackOptions = {
  db: Db;
  store: SecretStore;
  baseUrl: string;
  appVersion?: string;
  deviceLabel?: string;
  ids: () => string;
  now?: () => number;
  fetchImpl?: ApiOptions['fetchImpl'];
};

/** Prepares the database and the clients. Works offline: the account is created on the first sync that reaches the server. */
export async function openStack({ db, store, baseUrl, appVersion, deviceLabel, ids, now = Date.now, fetchImpl }: StackOptions): Promise<DataStack> {
  await migrate(db);
  const repo = new Repo(db, ids, now);
  const plain = createApi({ baseUrl, appVersion, fetchImpl });
  const session = new SessionManager(store, plain, now);
  await session.load();
  const api = createApi({
    baseUrl,
    appVersion,
    fetchImpl,
    tokens: {
      // A call made before the first sync (say, a barcode lookup straight after install) makes the account first.
      accessToken: async () => (await session.accessToken()) ?? (await session.ensure(deviceLabel)).accessToken,
      refreshAfterUnauthorized: () => session.refresh(),
    },
  });
  const sync = new SyncEngine(repo, api, async () => (await session.ensure(deviceLabel)).userId, now);
  sync.addTask(profileTask(repo, api, now));
  sync.addTask(scanTask(repo, api));
  sync.addTask(entitlementTask(repo, api, now));
  return { db, repo, session, api, sync };
}

const EVERY_MS = 5 * 60_000;

/** Syncs now, shortly after each local change, whenever the app comes to the front, and every 5 minutes while it is open. */
export function startSync(sync: SyncEngine): () => void {
  const unwatch = sync.watch();
  sync.schedule(0);
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') sync.schedule(0);
  });
  const timer = setInterval(() => {
    if (AppState.currentState === 'active') sync.schedule(0);
  }, EVERY_MS);
  return () => {
    unwatch();
    sub.remove();
    clearInterval(timer);
    sync.stop();
  };
}
