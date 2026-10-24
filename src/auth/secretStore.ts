import * as SecureStore from 'expo-secure-store';

/** Small secrets (the session) kept in the phone's keystore. */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const deviceSecretStore: SecretStore = {
  // A value the keystore can no longer decrypt (say, restored onto another phone) reads as missing, not as a crash.
  get: (key) => SecureStore.getItemAsync(key).catch(() => null),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

/** For tests. */
export function memorySecretStore(initial: Record<string, string> = {}): SecretStore {
  const m = new Map(Object.entries(initial));
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
  };
}
