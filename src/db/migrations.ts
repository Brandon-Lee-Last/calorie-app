import type { Db } from './types';

/**
 * Schema versions, applied in order and tracked with PRAGMA user_version. Never edit a shipped step: add a new one.
 * Synced tables mirror the server records; `rev` is the server revision (0 until the server has it).
 */
const STEPS: string[] = [
  `
  CREATE TABLE diary_entries (
    id TEXT PRIMARY KEY,
    logged_at INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    name TEXT NOT NULL,
    food_id TEXT,
    quantity_g REAL,
    servings REAL,
    calories REAL NOT NULL,
    protein_g REAL NOT NULL DEFAULT 0,
    carb_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    fiber_g REAL,
    sugar_g REAL,
    sodium_mg REAL,
    source TEXT NOT NULL,
    scan_id TEXT,
    has_photo INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    client_updated_at INTEGER NOT NULL,
    updated_at INTEGER,
    rev INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX diary_by_date ON diary_entries (local_date, logged_at);

  CREATE TABLE water (
    id TEXT PRIMARY KEY,
    logged_at INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    ml INTEGER NOT NULL,
    client_updated_at INTEGER NOT NULL,
    updated_at INTEGER,
    rev INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX water_by_date ON water (local_date, logged_at);

  CREATE TABLE weights (
    id TEXT PRIMARY KEY,
    logged_at INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    note TEXT,
    client_updated_at INTEGER NOT NULL,
    updated_at INTEGER,
    rev INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX weights_by_date ON weights (local_date, logged_at);

  -- Records of types the app does not show yet (foods, workouts, recipes...), kept so a pull never loses them.
  CREATE TABLE remote_records (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    json TEXT NOT NULL,
    rev INTEGER NOT NULL,
    PRIMARY KEY (type, id)
  );

  -- Changes made on this phone that the server has not confirmed yet. One row per record: a newer edit replaces an
  -- older pending one.
  CREATE TABLE outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    op TEXT NOT NULL,
    data TEXT,
    client_updated_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    UNIQUE (type, record_id)
  );

  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  // v2: what the model said for each photo and what was saved, queued for the server's accuracy tracking.
  `
  CREATE TABLE scans (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    body TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX scans_unsent ON scans (sent, created_at);
  `,
  // v3: workout sessions get their own table (they were kept as JSON in remote_records before).
  `
  CREATE TABLE workout_sessions (
    id TEXT PRIMARY KEY,
    workout_id TEXT,
    program_id TEXT,
    title TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    local_date TEXT NOT NULL,
    sets TEXT,
    notes TEXT,
    rating INTEGER,
    calories_burned REAL,
    client_updated_at INTEGER NOT NULL,
    updated_at INTEGER,
    rev INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX workout_sessions_date ON workout_sessions (local_date);
  DELETE FROM remote_records WHERE type = 'workout_session';
  UPDATE meta SET value = '0' WHERE key = 'sync.rev';
  `,
];

export const SCHEMA_VERSION = STEPS.length;

export async function migrate(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > STEPS.length) throw new Error(`Database is newer (v${current}) than this app knows (v${STEPS.length})`);
  for (let v = current; v < STEPS.length; v++) {
    await db.transaction(async (tx) => {
      await tx.exec(STEPS[v]);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return STEPS.length;
}
