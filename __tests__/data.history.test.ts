import { localDate, shiftDate, weekOf, weekStart } from '../src/data/dates';
import { LOCAL_IDEAS, fitIdea, ideasFromHistory, portionNote, suggest, type Idea } from '../src/data/fits';
import { atDate, learnUsuals, mealTimeOn, mealsFrom } from '../src/data/history';
import { Repo, type DiaryEntry } from '../src/data/repo';
import { migrate } from '../src/db/migrations';
import { memoryDb } from './helpers/sqljsDb';

const at = (date: string, h: number) => atDate(date, new Date(2026, 0, 1, h).getTime());
let n = 0;
const entry = (name: string, date: string, h: number, calories: number, mealType: DiaryEntry['mealType'] = 'lunch'): DiaryEntry =>
  ({ id: `e${++n}`, name, localDate: date, loggedAt: at(date, h), calories, proteinG: 10, carbG: 20, fatG: 5, quantityG: null, mealType, source: 'manual' }) as DiaryEntry;

describe('dates for the week strip', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // a Sunday
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekOf('2026-10-22')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  });

  it('moves a time of day to another date', () => {
    expect(localDate(atDate('2026-10-20', new Date(2026, 9, 25, 7, 40).getTime()))).toBe('2026-10-20');
    expect(new Date(mealTimeOn('2026-10-20', 'dinner')).getHours()).toBe(19);
  });
});

describe('usuals', () => {
  const entries = [
    entry('Rooibos with milk', '2026-10-20', 7, 25, 'breakfast'),
    entry('rooibos with milk ', '2026-10-21', 7, 30, 'breakfast'),
    entry('Rooibos with milk', '2026-10-22', 15, 30, 'snack'),
    entry('Eggs on toast', '2026-10-21', 8, 310, 'breakfast'),
    entry('Eggs on toast', '2026-10-23', 8, 320, 'breakfast'),
    entry('Bobotie', '2026-10-22', 19, 610, 'dinner'),
    entry('Quick add', '2026-10-22', 12, 200),
    entry('Quick add', '2026-10-23', 12, 200),
  ];

  it('groups by name, keeps the latest numbers and the usual meal, and leaves quick adds out', () => {
    expect(mealsFrom(entries).map((m) => [m.name, m.times, m.calories, m.mealType])).toEqual([
      ['Rooibos with milk', 3, 30, 'breakfast'],
      ['Eggs on toast', 2, 320, 'breakfast'],
      ['Bobotie', 1, 610, 'dinner'],
    ]);
    expect(learnUsuals(entries).map((m) => m.name)).toEqual(['Rooibos with milk', 'Eggs on toast']);
  });
});

describe('what fits', () => {
  const idea = (calories: number, proteinG = 30): Idea => ({ key: `i${calories}`, name: `Idea ${calories}`, meta: '', calories, proteinG, carbG: 50, fatG: 10, quantityG: 400, colours: ['#000', '#000', '#000'] });
  const left = { calories: 500, proteinG: 60, carbG: 50, fatG: 20 };

  it('keeps a full portion when it fits, otherwise the biggest quarter step from half up', () => {
    expect(fitIdea(idea(450), left)).toMatchObject({ portion: 1, kcal: 450, leaves: 50 });
    expect(fitIdea(idea(640), left)).toMatchObject({ portion: 0.75, kcal: 480, protein: 22.5, leaves: 20 });
    expect(fitIdea(idea(1100), left)).toBeNull();
    expect(fitIdea(idea(300), { ...left, calories: 0 })).toBeNull();
    expect(portionNote(0.75)).toBe('¾ portion');
  });

  it('orders by how well it uses what is left, or by protein', () => {
    expect(suggest([idea(200), idea(480), idea(640)], left, 'fit').map((f) => f.key)).toEqual(['i480', 'i640', 'i200']);
    expect(suggest([idea(400, 20), idea(300, 40)], left, 'protein').map((f) => f.key)).toEqual(['i300', 'i400']);
  });

  it('turns your meals into ideas with when you last had them', () => {
    const today = '2026-10-25';
    const meals = mealsFrom([entry('Bobotie', shiftDate(today, -1), 19, 610, 'dinner')]);
    expect(ideasFromHistory(meals, today)[0]).toMatchObject({ name: 'Bobotie', meta: 'You had this yesterday', calories: 610 });
  });

  it('has local ideas whose energy matches their macros', () => {
    for (const i of LOCAL_IDEAS) {
      const fromMacros = 4 * i.proteinG + 4 * i.carbG + 9 * i.fatG;
      expect(Math.abs(fromMacros - i.calories) / i.calories).toBeLessThan(0.06);
    }
  });
});

describe('diary queries', () => {
  async function seeded() {
    const db = await memoryDb();
    await migrate(db);
    const repo = new Repo(db, () => `id${++n}`, () => at('2026-10-25', 12));
    await repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast', loggedAt: at('2026-10-20', 8) });
    await repo.addEntry({ name: 'Pap', calories: 300, mealType: 'dinner', loggedAt: at('2026-10-20', 19) });
    await repo.addEntry({ name: 'Bobotie', calories: 610, mealType: 'dinner', loggedAt: at('2026-10-23', 19) });
    await repo.addEntry({ name: 'Salad', calories: 90, mealType: 'dinner', loggedAt: at('2026-10-23', 19.5) });
    return repo;
  }

  it('totals calories per day', async () => {
    const repo = await seeded();
    expect([...(await repo.caloriesByDay('2026-10-19', '2026-10-25'))]).toEqual([
      ['2026-10-20', 620],
      ['2026-10-23', 700],
    ]);
  });

  it('finds the latest earlier day with a meal, all of its entries', async () => {
    const repo = await seeded();
    expect(await repo.lastMeal('2026-10-25', 'dinner')).toEqual({ date: '2026-10-23', entries: [expect.objectContaining({ name: 'Bobotie' }), expect.objectContaining({ name: 'Salad' })] });
    expect((await repo.lastMeal('2026-10-23', 'dinner'))?.date).toBe('2026-10-20');
    expect(await repo.lastMeal('2026-10-25', 'snack')).toBeNull();
  });
});
