/** The little of SQLite the app needs. expo-sqlite implements it on the phone; tests use sql.js. */
export type SqlValue = string | number | null;

/** Plain statements. Inside a transaction, use the `tx` it hands you: the database itself waits for the transaction. */
export interface Statements {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

export interface Db extends Statements {
  /** Runs `fn` in one transaction, alone; rolls back if it throws. Statements in `fn` must go through `tx`. */
  transaction<T>(fn: (tx: Statements) => Promise<T>): Promise<T>;
}
