import { createApi } from '../src/api/client';
import { memorySecretStore } from '../src/auth/secretStore';
import { SessionManager } from '../src/auth/session';
import { Repo } from '../src/data/repo';
import { scanTask } from '../src/data/scanTask';
import { migrate } from '../src/db/migrations';
import { entryFromScan, portionLabel, scanRecord, shownFor, stepPortion, typicalErrorKcal } from '../src/scan/scanMath';
import { FakeServer } from './helpers/fakeServer';
import { memoryDb } from './helpers/sqljsDb';

const plate = { calories: 643.7, mass: 312.4, fat: 21.4, carb: 70.6, protein: 38.2 };

describe('scan maths', () => {
  it('labels and steps portions between half and two plates', () => {
    expect([0.5, 0.75, 1, 1.25, 1.5, 2].map(portionLabel)).toEqual(['½ plate', '¾ plate', '1 plate', '1¼ plates', '1½ plates', '2 plates']);
    expect(stepPortion(1, 1)).toBe(1.25);
    expect(stepPortion(0.5, -1)).toBe(0.5);
    expect(stepPortion(2, 1)).toBe(2);
  });

  it('rounds no finer than the model can tell, and scales with the portion', () => {
    expect(shownFor(plate, 1)).toEqual({ calories: 640, massG: 310, proteinG: 38, carbG: 71, fatG: 21 });
    expect(shownFor(plate, 1.5)).toEqual({ calories: 970, massG: 470, proteinG: 57, carbG: 106, fatG: 32 });
    expect(typicalErrorKcal(1)).toBe(80);
  });

  it('makes a diary entry from what is shown', () => {
    expect(entryFromScan(shownFor(plate, 1), { scanId: 's1', name: '  ', mealType: 'lunch' })).toEqual({
      name: 'Scanned meal', calories: 640, proteinG: 38, carbG: 71, fatG: 21, quantityG: 310, mealType: 'lunch', source: 'scan', scanId: 's1',
    });
  });

  it('records the raw prediction and what was saved, never negative', () => {
    const r = scanRecord({ nutrition: { ...plate, fat: -0.4 }, food: 0.97, outcome: 'edited', saved: shownFor(plate, 1.25), portion: 1.25, at: 5 });
    expect(r).toEqual({
      modelVersion: 'nutrition_v1', foodProbability: 0.97, outcome: 'edited', portion: 1.25, contributeConsent: false, clientCreatedAt: 5,
      predicted: { calories: 643.7, massG: 312.4, fatG: 0, carbG: 70.6, proteinG: 38.2 },
      final: shownFor(plate, 1.25),
    });
    expect(scanRecord({ nutrition: plate, food: 0.1, outcome: 'not_food', at: 5 })).toMatchObject({ predicted: null, final: null, portion: null });
  });
});

describe('scan records', () => {
  async function setup(server = new FakeServer()) {
    const db = await memoryDb();
    await migrate(db);
    const repo = new Repo(db, () => 'id');
    const fetchImpl = (req: Request) => server.fetch(req);
    const session = new SessionManager(memorySecretStore(), createApi({ baseUrl: 'http://api.test', fetchImpl }));
    await session.ensure('test');
    const api = createApi({ baseUrl: 'http://api.test', fetchImpl, tokens: { accessToken: () => session.accessToken(), refreshAfterUnauthorized: () => session.refresh() } });
    return { repo, server, task: scanTask(repo, api) };
  }
  const rec = (at: number) => scanRecord({ nutrition: plate, food: 0.9, outcome: 'saved', saved: shownFor(plate, 1), portion: 1, at });

  it('sends each record once', async () => {
    const { repo, server, task } = await setup();
    await repo.recordScan('a', rec(1));
    await repo.recordScan('b', rec(2));
    await task();
    expect([...server.scans.keys()]).toEqual(['a', 'b']);
    expect(await repo.unsentScans()).toEqual([]);
    server.scans.clear();
    await task();
    expect(server.scans.size).toBe(0);
  });

  it('drops a record the server refuses, but keeps one it could not take right now', async () => {
    const { repo, server, task } = await setup();
    await repo.recordScan('a', rec(1));
    server.scanStatus = 503;
    await expect(task()).rejects.toMatchObject({ status: 503 });
    expect(await repo.unsentScans()).toHaveLength(1);
    server.scanStatus = 422;
    await task();
    expect(await repo.unsentScans()).toEqual([]);
  });

  it('sends more than one batch', async () => {
    const { repo, server, task } = await setup();
    for (let i = 0; i < 45; i++) await repo.recordScan(`s${i}`, rec(i));
    await task();
    expect(server.scans.size).toBe(45);
  });
});
