import { unwrap, type Api } from '../api/client';
import type { components } from '../api/schema';
import type { Repo } from './repo';

export type Entitlement = components['schemas']['Entitlement'];
export type CachedEntitlement = { fetchedAt: number; entitlement: Entitlement };

export const ENTITLEMENT_KEY = 'entitlement';
const MAX_AGE_MS = 30 * 60_000;

/** Plus or not. The server decides (it checks Google Play); the phone keeps the last answer for offline use. */
export const isPlus = (e: Entitlement | null | undefined) => e?.plan === 'pro';

export async function refreshEntitlement(repo: Repo, api: Api, now: number = Date.now()): Promise<Entitlement> {
  const entitlement = await unwrap(api.GET('/v1/entitlements'));
  await repo.setMeta(ENTITLEMENT_KEY, { fetchedAt: now, entitlement } satisfies CachedEntitlement);
  return entitlement;
}

/** Runs with each sync round: refreshes the entitlement when the copy on the phone is over 30 minutes old. */
export function entitlementTask(repo: Repo, api: Api, now: () => number = Date.now): () => Promise<void> {
  return async () => {
    const cached = await repo.getMeta<CachedEntitlement>(ENTITLEMENT_KEY);
    if (cached && now() - cached.fetchedAt < MAX_AGE_MS) return;
    await refreshEntitlement(repo, api, now());
  };
}
