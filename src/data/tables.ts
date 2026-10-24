import type { components } from '../api/schema';
import type { SqlValue, Statements } from '../db/types';

export type SyncType = components['schemas']['SyncOp']['type'];
export type DiaryRecord = components['schemas']['DiaryEntry'];
export type WaterRecord = components['schemas']['WaterRecord'];
export type WeightRecord = components['schemas']['WeightRecord'];

type Column = { key: string; col: string; bool?: boolean };

/** A synced type kept in its own local table, and how its records map to rows and to push bodies. */
export type TableSpec = {
  type: SyncType;
  table: string;
  columns: Column[];
  /** Record fields sent in a push (the matching PUT body). */
  input: string[];
};

const col = (key: string, bool = false): Column => ({ key, col: key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()), bool });

export const DIARY: TableSpec = {
  type: 'diary_entry',
  table: 'diary_entries',
  columns: [
    'id', 'loggedAt', 'localDate', 'mealType', 'name', 'foodId', 'quantityG', 'servings', 'calories', 'proteinG', 'carbG',
    'fatG', 'fiberG', 'sugarG', 'sodiumMg', 'source', 'scanId', 'note', 'clientUpdatedAt', 'updatedAt', 'rev',
  ].map((k) => col(k)).concat([col('hasPhoto', true)]),
  input: [
    'loggedAt', 'localDate', 'mealType', 'name', 'foodId', 'quantityG', 'servings', 'calories', 'proteinG', 'carbG', 'fatG',
    'fiberG', 'sugarG', 'sodiumMg', 'source', 'scanId', 'note', 'clientUpdatedAt',
  ],
};

export const WATER: TableSpec = {
  type: 'water',
  table: 'water',
  columns: ['id', 'loggedAt', 'localDate', 'ml', 'clientUpdatedAt', 'updatedAt', 'rev'].map((k) => col(k)),
  input: ['loggedAt', 'localDate', 'ml', 'clientUpdatedAt'],
};

export const WEIGHT: TableSpec = {
  type: 'weight',
  table: 'weights',
  columns: ['id', 'loggedAt', 'localDate', 'weightKg', 'note', 'clientUpdatedAt', 'updatedAt', 'rev'].map((k) => col(k)),
  input: ['loggedAt', 'localDate', 'weightKg', 'note', 'clientUpdatedAt'],
};

export const TABLES: Partial<Record<SyncType, TableSpec>> = { diary_entry: DIARY, water: WATER, weight: WEIGHT };

export function fromRow<T>(spec: TableSpec, row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const c of spec.columns) out[c.key] = c.bool ? row[c.col] === 1 : (row[c.col] ?? null);
  return out as T;
}

/** The push body for a record: its input fields, leaving out empty ones (the server treats missing as empty). */
export function pushData(spec: TableSpec, record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of spec.input) if (record[key] !== null && record[key] !== undefined) out[key] = record[key];
  return out;
}

/** Inserts or replaces a record's row. */
export async function writeRecord(db: Statements, spec: TableSpec, record: Record<string, unknown>): Promise<void> {
  const cols = spec.columns.map((c) => c.col);
  const values = spec.columns.map((c): SqlValue => {
    const v = record[c.key];
    if (c.bool) return v ? 1 : 0;
    return v === undefined ? null : (v as SqlValue);
  });
  await db.run(
    `INSERT OR REPLACE INTO ${spec.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values,
  );
}

export async function readRecord<T>(db: Statements, spec: TableSpec, id: string): Promise<T | null> {
  const row = await db.get<Record<string, unknown>>(`SELECT * FROM ${spec.table} WHERE id = ?`, [id]);
  return row ? fromRow<T>(spec, row) : null;
}
