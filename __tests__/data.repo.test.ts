import { shiftDate, localDate, mealForTime, streak } from '../src/data/dates';
import { Repo } from '../src/data/repo';
import { migrate, SCHEMA_VERSION } from '../src/db/migrations';
import { memoryDb } from './helpers/sqljsDb';

let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

async function setup(now = () => new Date(2026, 9, 22, 12, 30).getTime()) {
  const db = await memoryDb();
  await migrate(db);
  return { db, repo: new Repo(db, ids, now) };
}

describe('migrations', () => {
  it('builds the schema once and records the version', async () => {
    const db = await memoryDb();
    expect(await migrate(db)).toBe(SCHEMA_VERSION);
    expect(await migrate(db)).toBe(SCHEMA_VERSION);
    expect((await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(SCHEMA_VERSION);
  });
});

describe('database queue', () => {
  it('runs overlapping transactions one after the other, and rolls back a failed one', async () => {
    const db = await memoryDb();
    await db.exec('CREATE TABLE t (n INTEGER)');
    const order: string[] = [];
    const slow = (name: string, fail = false) =>
      db.transaction(async (tx) => {
        order.push(`${name} start`);
        await tx.run('INSERT INTO t (n) VALUES (?)', [order.length]);
        await new Promise((r) => setTimeout(r, 5));
        order.push(`${name} end`);
        if (fail) throw new Error('boom');
      });
    const results = await Promise.allSettled([slow('a'), slow('b', true), db.run('INSERT INTO t (n) VALUES (99)'), slow('c')]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
    expect(order).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
    expect((await db.all<{ n: number }>('SELECT n FROM t ORDER BY rowid')).map((r) => r.n)).toEqual([1, 99, 5]);
  });
});

describe('Repo diary', () => {
  it('saves an entry locally and queues it for the server', async () => {
    const { db, repo } = await setup();
    const heard: string[][] = [];
    repo.onChange((areas) => heard.push([...areas]));
    const e = await repo.addEntry({ name: ' Oats with banana ', calories: 320.4, proteinG: 11.26, carbG: 54, fatG: 7 });
    expect(e).toMatchObject({ name: 'Oats with banana', calories: 320, proteinG: 11.3, localDate: '2026-10-22', mealType: 'lunch', source: 'manual', rev: 0 });
    expect(await repo.entriesFor('2026-10-22')).toEqual([expect.objectContaining({ id: e.id, hasPhoto: false })]);
    const ops = await db.all<{ op: string; data: string }>('SELECT op, data FROM outbox');
    expect(ops).toHaveLength(1);
    expect(JSON.parse(ops[0].data)).toEqual({
      loggedAt: e.loggedAt, localDate: '2026-10-22', mealType: 'lunch', name: 'Oats with banana', calories: 320,
      proteinG: 11.3, carbG: 54, fatG: 7, source: 'manual', clientUpdatedAt: e.clientUpdatedAt,
    });
    expect(heard).toEqual([['diary', 'outbox']]);
  });

  it('keeps one queued change per record, the newest', async () => {
    let t = 1000;
    const { db, repo } = await setup(() => t);
    const e = await repo.addEntry({ name: 'Toast', calories: 200 });
    t = 2000;
    await repo.updateEntry(e.id, { calories: 250 });
    const ops = await db.all<{ op: string; data: string; client_updated_at: number }>('SELECT * FROM outbox');
    expect(ops).toHaveLength(1);
    expect(JSON.parse(ops[0].data).calories).toBe(250);
    t = 3000;
    await repo.deleteEntry(e.id);
    const after = await db.all<{ op: string }>('SELECT op FROM outbox');
    expect(after).toEqual([expect.objectContaining({ op: 'delete' })]);
    expect(await repo.entriesFor(localDate(1000))).toEqual([]);
  });

  it('adds up a day', async () => {
    const { repo } = await setup();
    await repo.addEntry({ name: 'A', calories: 320, proteinG: 10, carbG: 50, fatG: 8 });
    await repo.addEntry({ name: 'B', calories: 540, proteinG: 40, carbG: 60, fatG: 12.25 });
    expect(await repo.totalsFor('2026-10-22')).toEqual({ entries: 2, calories: 860, proteinG: 50, carbG: 110, fatG: 20.3 });
    expect(await repo.totalsFor('2026-10-21')).toEqual({ entries: 0, calories: 0, proteinG: 0, carbG: 0, fatG: 0 });
  });
});

describe('Repo water and meta', () => {
  it('adds and takes back glasses', async () => {
    let t = new Date(2026, 9, 22, 8).getTime();
    const { repo } = await setup(() => t);
    await repo.addWater(250);
    t += 60_000;
    await repo.addWater(250);
    expect(await repo.waterFor('2026-10-22')).toBe(500);
    expect(await repo.removeLastWater('2026-10-22')).toBe(true);
    expect(await repo.waterFor('2026-10-22')).toBe(250);
    expect(await repo.pendingCount()).toBe(2);
  });

  it('stores small values', async () => {
    const { repo } = await setup();
    expect(await repo.getMeta('x')).toBeNull();
    await repo.setMeta('x', { a: 1 });
    expect(await repo.getMeta('x')).toEqual({ a: 1 });
  });
});

describe('dates', () => {
  it('writes local dates and moves them', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('picks a meal by the time of day', () => {
    expect(mealForTime(new Date(2026, 0, 1, 7))).toBe('breakfast');
    expect(mealForTime(new Date(2026, 0, 1, 12))).toBe('lunch');
    expect(mealForTime(new Date(2026, 0, 1, 16))).toBe('snack');
    expect(mealForTime(new Date(2026, 0, 1, 19))).toBe('dinner');
    expect(mealForTime(new Date(2026, 0, 1, 1))).toBe('snack');
  });

  it('counts a streak back from today, or yesterday while today is still empty', () => {
    const days = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'];
    expect(streak(days, '2026-10-22')).toBe(5);
    expect(streak([...days, '2026-10-22'], '2026-10-22')).toBe(6);
    expect(streak(['2026-10-19', '2026-10-21'], '2026-10-22')).toBe(1);
    expect(streak([], '2026-10-22')).toBe(0);
  });
});
