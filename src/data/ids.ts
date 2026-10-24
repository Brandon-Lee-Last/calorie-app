import * as Crypto from 'expo-crypto';

/** A new record id. The server accepts ULIDs or UUIDs; the phone makes UUID v4s. */
export const newId = (): string => Crypto.randomUUID();
