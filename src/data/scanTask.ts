import { unwrap, type Api } from '../api/client';
import { ApiError } from '../api/errors';
import type { Repo, ScanRecord } from './repo';

/**
 * Runs in each sync round: sends scan records (what the model said, what was saved) so the server can measure how
 * accurate the model is on real phone photos. Only numbers go; the photo stays on the phone.
 */
export function scanTask(repo: Repo, api: Api): () => Promise<void> {
  return async () => {
    for (;;) {
      const batch = await repo.unsentScans();
      for (const { id, body } of batch) {
        try {
          await unwrap(api.PUT('/v1/scans/{id}', { params: { path: { id } }, body: JSON.parse(body) as ScanRecord }));
        } catch (e) {
          // One the server refuses outright would be refused forever; let it go.
          if (!(e instanceof ApiError && e.permanent)) throw e;
        }
        await repo.markScanSent(id, body);
      }
      if (batch.length < 20) return;
    }
  };
}
