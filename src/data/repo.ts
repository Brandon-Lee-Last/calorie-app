import type { Db, Statements } from '../db/types';
import { localDate, mealForTime, type MealType } from './dates';
import { DIARY, WATER, WEIGHT, fromRow, pushData, readRecord, writeRecord, type DiaryRecord, type SyncType, type TableSpec, type WaterRecord, type WeightRecord } from './tables';

/** 'outbox' means a local change was queued for the server. */
export type Area = 'diary' | 'water' | 'weight' | 'meta' | 'outbox';
export type DiaryEntry = DiaryRecord;
export type DayTotals = { entries: number; calories: number; proteinG: number; carbG: number; fatG: number };

export type NewEntry = {
  name: string;
  calories: number;
  proteinG?: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  mealType?: MealType;
  loggedAt?: number;
  source?: DiaryRecord['source'];
  quantityG?: number | null;
  servings?: number | null;
  foodId?: string | null;
  scanId?: string | null;
  note?: string | null;
};

const AREA_OF: Record<string, Area> = { diary_entry: 'diary', water: 'water', weight: 'weight' };
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Everything the screens read and write. Writes land in the phone's database at once and are queued for the server,
 * so the app works the same offline. Listeners hear which areas changed.
 */
export class Repo {
  private listeners = new Set<(areas: Set<Area>) => void>();

  constructor(
    readonly db: Db,
    private ids: () => string,
    private now: () => number = Date.now,
  ) {}

  onChange(fn: (areas: Set<Area>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(...areas: Area[]): void {
    const set = new Set(areas);
    this.listeners.forEach((fn) => fn(set));
  }

  // ---- diary

  async addEntry(input: NewEntry): Promise<DiaryEntry> {
    const at = input.loggedAt ?? this.now();
    const record: DiaryEntry = {
      id: this.ids(),
      loggedAt: at,
      localDate: localDate(at),
      mealType: input.mealType ?? mealForTime(at),
      name: input.name.trim(),
      foodId: input.foodId ?? null,
      quantityG: input.quantityG ?? null,
      servings: input.servings ?? null,
      calories: Math.round(input.calories),
      proteinG: round1(input.proteinG ?? 0),
      carbG: round1(input.carbG ?? 0),
      fatG: round1(input.fatG ?? 0),
      fiberG: input.fiberG ?? null,
      sugarG: input.sugarG ?? null,
      sodiumMg: input.sodiumMg ?? null,
      source: input.source ?? 'manual',
      scanId: input.scanId ?? null,
      hasPhoto: false,
      note: input.note ?? null,
      clientUpdatedAt: this.now(),
      updatedAt: 0,
      deletedAt: null,
      rev: 0,
    };
    await this.saveLocal(DIARY, record as unknown as Record<string, unknown>);
    this.emit('diary', 'outbox');
    return record;
  }

  async updateEntry(id: string, patch: Partial<NewEntry>): Promise<DiaryEntry | null> {
    const current = await readRecord<DiaryEntry>(this.db, DIARY, id);
    if (!current) return null;
    const loggedAt = patch.loggedAt ?? current.loggedAt;
    const next: DiaryEntry = {
      ...current,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      loggedAt,
      localDate: localDate(loggedAt),
      clientUpdatedAt: Math.max(this.now(), current.clientUpdatedAt + 1),
    } as DiaryEntry;
    await this.saveLocal(DIARY, next as unknown as Record<string, unknown>);
    this.emit('diary', 'outbox');
    return next;
  }

  async deleteEntry(id: string): Promise<void> {
    await this.deleteLocal(DIARY, id);
    this.emit('diary', 'outbox');
  }

  async entry(id: string): Promise<DiaryEntry | null> {
    return readRecord<DiaryEntry>(this.db, DIARY, id);
  }

  async entriesFor(date: string): Promise<DiaryEntry[]> {
    const rows = await this.db.all<Record<string, unknown>>('SELECT * FROM diary_entries WHERE local_date = ? ORDER BY logged_at', [date]);
    return rows.map((r) => fromRow<DiaryEntry>(DIARY, r));
  }

  async totalsFor(date: string): Promise<DayTotals> {
    const row = await this.db.get<{ n: number; kcal: number | null; p: number | null; c: number | null; f: number | null }>(
      'SELECT COUNT(*) AS n, SUM(calories) AS kcal, SUM(protein_g) AS p, SUM(carb_g) AS c, SUM(fat_g) AS f FROM diary_entries WHERE local_date = ?',
      [date],
    );
    return { entries: row?.n ?? 0, calories: Math.round(row?.kcal ?? 0), proteinG: round1(row?.p ?? 0), carbG: round1(row?.c ?? 0), fatG: round1(row?.f ?? 0) };
  }

  /** Dates with at least one entry, from `since` onwards. */
  async loggedDates(since: string): Promise<string[]> {
    const rows = await this.db.all<{ d: string }>('SELECT DISTINCT local_date AS d FROM diary_entries WHERE local_date >= ? ORDER BY d', [since]);
    return rows.map((r) => r.d);
  }

  // ---- water

  async addWater(ml: number, at: number = this.now()): Promise<WaterRecord> {
    const record: WaterRecord = { id: this.ids(), loggedAt: at, localDate: localDate(at), ml: Math.round(ml), clientUpdatedAt: this.now(), updatedAt: 0, deletedAt: null, rev: 0 };
    await this.saveLocal(WATER, record as unknown as Record<string, unknown>);
    this.emit('water', 'outbox');
    return record;
  }

  /** Takes back the latest glass of the day. */
  async removeLastWater(date: string): Promise<boolean> {
    const row = await this.db.get<{ id: string }>('SELECT id FROM water WHERE local_date = ? ORDER BY logged_at DESC LIMIT 1', [date]);
    if (!row) return false;
    await this.deleteLocal(WATER, row.id);
    this.emit('water', 'outbox');
    return true;
  }

  async waterFor(date: string): Promise<number> {
    const row = await this.db.get<{ ml: number | null }>('SELECT SUM(ml) AS ml FROM water WHERE local_date = ?', [date]);
    return row?.ml ?? 0;
  }

  // ---- weight

  async addWeight(weightKg: number, at: number = this.now()): Promise<WeightRecord> {
    const record: WeightRecord = { id: this.ids(), loggedAt: at, localDate: localDate(at), weightKg: round1(weightKg), note: null, clientUpdatedAt: this.now(), updatedAt: 0, deletedAt: null, rev: 0 };
    await this.saveLocal(WEIGHT, record as unknown as Record<string, unknown>);
    this.emit('weight', 'outbox');
    return record;
  }

  async weights(since: string): Promise<WeightRecord[]> {
    const rows = await this.db.all<Record<string, unknown>>('SELECT * FROM weights WHERE local_date >= ? ORDER BY logged_at', [since]);
    return rows.map((r) => fromRow<WeightRecord>(WEIGHT, r));
  }

  // ---- meta (small app state: sync cursor, cached profile, settings)

  async getMeta<T>(key: string): Promise<T | null> {
    const row = await this.db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
    this.emit('meta');
  }

  async pendingCount(): Promise<number> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
    return row?.n ?? 0;
  }

  // ---- internals

  /** Writes the row and queues it for the server, in one transaction. */
  private async saveLocal(spec: TableSpec, record: Record<string, unknown>): Promise<void> {
    await this.db.transaction(async (tx) => {
      await writeRecord(tx, spec, record);
      await enqueue(tx, spec.type, record.id as string, 'upsert', pushData(spec, record), record.clientUpdatedAt as number);
    });
  }

  private async deleteLocal(spec: TableSpec, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(`DELETE FROM ${spec.table} WHERE id = ?`, [id]);
      await enqueue(tx, spec.type, id, 'delete', null, this.now());
    });
  }
}

/** Queues a change. A newer change to the same record replaces an older one that has not been sent yet. */
export async function enqueue(db: Statements, type: SyncType, id: string, op: 'upsert' | 'delete', data: Record<string, unknown> | null, clientUpdatedAt: number): Promise<void> {
  await db.run(
    `INSERT INTO outbox (type, record_id, op, data, client_updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (type, record_id) DO UPDATE SET op = excluded.op, data = excluded.data,
       client_updated_at = excluded.client_updated_at, attempts = 0, last_error = NULL`,
    [type, id, op, data ? JSON.stringify(data) : null, clientUpdatedAt],
  );
}

export const areaOf = (type: string): Area | null => AREA_OF[type] ?? null;
