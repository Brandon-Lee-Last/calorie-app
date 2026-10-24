import type { Db, Statements } from './types';

/**
 * Puts every statement and transaction on one queue. Without it a sync round and a save could interleave on the
 * single connection: a second BEGIN fails, or one caller's write lands in (and rolls back with) another's transaction.
 */
export function serialDb(raw: Statements): Db {
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn);
    tail = result.catch(() => {});
    return result;
  };
  return {
    exec: (sql) => exclusive(() => raw.exec(sql)),
    run: (sql, params) => exclusive(() => raw.run(sql, params)),
    all: <T,>(sql: string, params?: Parameters<Statements['all']>[1]) => exclusive(() => raw.all<T>(sql, params)),
    get: <T,>(sql: string, params?: Parameters<Statements['get']>[1]) => exclusive(() => raw.get<T>(sql, params)),
    transaction: (fn) =>
      exclusive(async () => {
        await raw.exec('BEGIN');
        try {
          const out = await fn(raw);
          await raw.exec('COMMIT');
          return out;
        } catch (e) {
          await raw.exec('ROLLBACK').catch(() => {});
          throw e;
        }
      }),
  };
}
