import { deviceSecretStore } from '../auth/secretStore';
import { API_URL, APP_VERSION, DEVICE_LABEL } from '../config';
import { openExpoDb } from '../db/expoDb';
import { newId } from './ids';
import { openStack, type DataStack } from './stack';

let opening: Promise<DataStack> | null = null;

/** The app's real data stack (SQLite on the phone, the secure store, the configured backend). Opened once. */
export function openAppData(): Promise<DataStack> {
  opening ??= (async () =>
    openStack({ db: await openExpoDb(), store: deviceSecretStore, baseUrl: API_URL, appVersion: APP_VERSION, deviceLabel: DEVICE_LABEL, ids: newId }))();
  // A failed open can be tried again.
  opening.catch(() => {
    opening = null;
  });
  return opening;
}
