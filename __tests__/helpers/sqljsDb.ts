import initSqlJs from 'sql.js';

import { serialDb } from '../../src/db/serial';
import type { Db, SqlValue } from '../../src/db/types';

/** The app's Db interface on an in-memory SQLite (sql.js), so tests run the real SQL. */
export async function memoryDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const rows = <T,>(sql: string, params: SqlValue[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  };
  return serialDb({
    exec: async (sql) => void db.exec(sql),
    run: async (sql, params = []) => {
      db.run(sql, params);
      return { changes: db.getRowsModified() };
    },
    all: async (sql, params) => rows(sql, params),
    get: async <T,>(sql: string, params?: SqlValue[]) => rows<T>(sql, params)[0] ?? null,
  });
}
