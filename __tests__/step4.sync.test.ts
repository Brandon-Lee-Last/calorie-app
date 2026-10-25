import { ENTITLEMENT_KEY, entitlementTask, isPlus, type CachedEntitlement } from '../src/data/entitlement';
import { PENDING_GOALS_KEY, saveGoals } from '../src/data/profile';
import { PROFILE_KEY, type CachedProfile } from '../src/data/settings';
import { localDate } from '../src/data/dates';
import { FakeServer } from './helpers/fakeServer';
import { testStack } from './helpers/screen';

const session = {
  workoutId: null,
  programId: null,
  title: 'Bodyweight full body',
  startedAt: Date.now() - 20 * 60_000,
  finishedAt: Date.now(),
  sets: [
    { exercise: 'bodyweight-squat', setNo: 1, reps: 12, weightKg: null, durationS: null },
    { exercise: 'plank', setNo: 1, reps: null, weightKg: null, durationS: 30 },
  ],
  notes: null,
  rating: null,
  caloriesBurned: 120,
};

describe('workouts sync', () => {
  it('backs up a finished workout and brings it to another phone', async () => {
    const server = new FakeServer();
    const a = await testStack(server);
    const saved = await a.repo.addWorkout(session);
    await a.sync.syncNow();
    expect([...server.records.values()].find((r) => r.id === saved.id)).toMatchObject({ title: 'Bodyweight full body', sets: session.sets, caloriesBurned: 120 });

    const b = await testStack(server);
    await b.sync.syncNow();
    expect(await b.repo.workouts(localDate())).toEqual([expect.objectContaining({ id: saved.id, sets: session.sets, rev: expect.any(Number) })]);
    a.sync.stop();
    b.sync.stop();
  });
});

describe('goals', () => {
  it('sets goals by hand on the phone at once, sends them, and can go back to the recommended plan', async () => {
    const server = new FakeServer();
    const a = await testStack(server);
    const mine = { calories: 1900, proteinG: 150, carbG: 180, fatG: 60 };
    await saveGoals(a.repo, mine);
    expect((await a.repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.goals).toEqual({ ...mine, custom: true });
    await a.sync.syncNow();
    expect(server.goalChanges).toEqual([mine]);
    expect(await a.repo.getMeta(PENDING_GOALS_KEY)).toBeNull();
    expect((await a.repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.goals).toMatchObject({ calories: 1900, custom: true });

    await saveGoals(a.repo, 'recommended');
    expect((await a.repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.goals.custom).toBe(false);
    await a.sync.syncNow();
    expect(server.goalChanges).toEqual([mine, 'recommended']);
    a.sync.stop();
  });
});

describe('entitlement', () => {
  it('keeps the server answer on the phone and refreshes it when old', async () => {
    const server = new FakeServer();
    const a = await testStack(server);
    let t = 1_000_000;
    const task = entitlementTask(a.repo, a.api, () => t);
    await task();
    expect(isPlus((await a.repo.getMeta<CachedEntitlement>(ENTITLEMENT_KEY))?.entitlement)).toBe(false);
    server.plan = 'pro';
    await task(); // still fresh
    expect(isPlus((await a.repo.getMeta<CachedEntitlement>(ENTITLEMENT_KEY))?.entitlement)).toBe(false);
    t += 31 * 60_000;
    await task();
    expect(isPlus((await a.repo.getMeta<CachedEntitlement>(ENTITLEMENT_KEY))?.entitlement)).toBe(true);
    a.sync.stop();
  });
});
