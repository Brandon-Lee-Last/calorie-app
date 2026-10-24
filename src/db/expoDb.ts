import * as SQLite from 'expo-sqlite';

import { serialDb } from './serial';
import type { Db, SqlValue } from './types';

/** Opens the app database on the phone. */
export async function openExpoDb(name = 'pango.db'): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return serialDb({
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T,>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    get: async <T,>(sql: string, params: SqlValue[] = []) => (await db.getFirstAsync<T>(sql, params)) ?? null,
  });
}
