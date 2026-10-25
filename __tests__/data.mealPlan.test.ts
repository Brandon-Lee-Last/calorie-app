import type { DiaryEntry } from '../src/data/repo';
import {
  dayName,
  entryFor,
  gramsText,
  isLogged,
  itemFor,
  keepRecentSwaps,
  nextPlanned,
  optionsFor,
  planDates,
  planDay,
  portionFor,
  portionLabel,
  scaledIngredients,
  shoppingList,
  slotsFor,
  suitsGoal,
  swapKey,
} from '../src/data/mealPlan'; // fmt: skip
import { sampleMealPlans } from './helpers/mealPlans';

const plans = sampleMealPlans('free');
const balanced = plans.diets.find((d) => d.slug === 'balanced')!;
const entry = (over: Partial<DiaryEntry>) => ({ name: 'x', mealType: 'lunch', deletedAt: null, ...over }) as DiaryEntry;

describe('the day plan', () => {
  it('has breakfast, lunch, dinner and a snack, and a second snack from 2400 kcal', () => {
    expect(slotsFor(balanced, 2000).map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    const big = slotsFor(balanced, 2600);
    expect(big.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'snack2']);
    expect(big.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it('sizes portions to the nearest quarter, between half and double', () => {
    expect(portionFor(400, 500)).toBe(1.25);
    expect(portionFor(400, 410)).toBe(1);
    expect(portionFor(400, 100)).toBe(0.5);
    expect(portionFor(400, 2000)).toBe(2);
    expect(portionLabel(1)).toBe('1 portion');
    expect(portionLabel(1.5)).toBe('1½ portions');
    expect(portionLabel(0.75)).toBe('¾ portion');
    expect(portionLabel(2)).toBe('2 portions');
  });

  it('is the same every time for a day, fits the goal, and never repeats a meal in a day', () => {
    const a = planDay(plans, balanced, '2026-10-26', 2000);
    expect(planDay(plans, balanced, '2026-10-26', 2000)).toEqual(a);
    expect(a.items.map((i) => i.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(new Set(a.items.map((i) => i.meal.slug)).size).toBe(a.items.length);
    expect(Math.abs(a.calories - 2000)).toBeLessThan(250);
    for (const i of a.items) expect(i.meal.diets).toContain('balanced');
  });

  it('changes from day to day, and a swap moves one slot on', () => {
    const days = Array.from({ length: 3 }, (_, i) => planDay(plans, balanced, `2026-10-2${6 + i}`, 2000).items[0].meal.slug);
    expect(new Set(days).size).toBe(3);
    const before = planDay(plans, balanced, '2026-10-26', 2000);
    const after = planDay(plans, balanced, '2026-10-26', 2000, {
      [swapKey('2026-10-26', 'lunch')]: 1,
    });
    expect(after.items[1].meal.slug).not.toBe(before.items[1].meal.slug);
    expect(after.items[0].meal.slug).toBe(before.items[0].meal.slug);
  });

  it('leaves out meals the account cannot open', () => {
    const lowCarb = plans.diets.find((d) => d.slug === 'low-carb')!;
    expect(optionsFor(plans, lowCarb, 'breakfast')).toEqual([]);
    const pro = sampleMealPlans('pro');
    expect(optionsFor(pro, pro.diets.find((d) => d.slug === 'low-carb')!, 'breakfast').map((m) => m.slug)).toEqual(['omelette']);
  });

  it('plans today and tomorrow on the free plan, the week on Plus', () => {
    expect(planDates('2026-10-26', false)).toEqual(['2026-10-26', '2026-10-27']);
    expect(planDates('2026-10-26', true)).toHaveLength(7);
    expect(dayName('2026-10-26', '2026-10-26')).toBe('Today');
    expect(dayName('2026-10-27', '2026-10-26')).toBe('Tomorrow');
  });

  it('says which styles suit a goal', () => {
    expect(suitsGoal(balanced, 'lose')).toBe(true);
    expect(suitsGoal({ ...balanced, goals: ['gain'] }, 'lose')).toBe(false);
    expect(suitsGoal(balanced, null)).toBe(false);
  });
});

describe('logging a planned meal', () => {
  const meal = plans.meals.find((m) => m.slug === 'tuna-sandwich')!;
  const item = itemFor(meal, 1.5, 'lunch', 'lunch');

  it('logs it with the portion scaled', () => {
    expect(entryFor(item)).toEqual({
      name: 'Tuna sandwich',
      calories: 600,
      proteinG: 30,
      carbG: 75,
      fatG: 16.5,
      fiberG: 4.5,
      quantityG: 225,
      servings: 1.5,
      mealType: 'lunch',
      source: 'food',
    });
  });

  it('knows a meal is logged by its name and meal, ignoring deleted entries', () => {
    expect(isLogged(item, [entry({ name: 'Tuna sandwich', mealType: 'lunch' })])).toBe(true);
    expect(isLogged(item, [entry({ name: 'Tuna sandwich', mealType: 'dinner' })])).toBe(false);
    expect(isLogged(item, [entry({ name: 'Tuna sandwich', mealType: 'lunch', deletedAt: 5 })])).toBe(false);
  });

  it('suggests the meal for now, then later ones, then a snack, never a missed one', () => {
    const day = planDay(plans, balanced, '2026-10-26', 2000);
    const [b, l, d, s] = day.items;
    expect(nextPlanned(day, [], 'breakfast')).toBe(b);
    expect(nextPlanned(day, [], 'lunch')).toBe(l);
    expect(nextPlanned(day, [entry({ name: l.meal.title, mealType: 'lunch' })], 'lunch')).toBe(d);
    const allMeals = [b, l, d].map((i) => entry({ name: i.meal.title, mealType: i.mealType }));
    expect(nextPlanned(day, allMeals, 'dinner')).toBe(s);
    expect(nextPlanned(day, [...allMeals, entry({ name: s.meal.title, mealType: 'snack' })], 'snack')).toBeNull();
  });
});

describe('recipes and shopping', () => {
  it('scales ingredients to weighable amounts and drops the kitchen measure off one portion', () => {
    const meal = plans.meals.find((m) => m.slug === 'oats')!;
    expect(scaledIngredients(meal, 1)[0]).toMatchObject({
      grams: 50,
      measure: '½ cup',
    });
    expect(scaledIngredients(meal, 1.25)[0]).toMatchObject({
      grams: 65,
      measure: null,
    });
    expect(
      scaledIngredients(
        {
          ...meal,
          ingredients: [{ name: 'Oil', grams: 5, measure: '1 tsp', aisle: 'pantry' }],
        },
        0.75,
      )[0].grams,
    ).toBe(4);
  });

  it('adds up what the planned days need by aisle', () => {
    const days = ['2026-10-26', '2026-10-27'].map((d) => planDay(plans, balanced, d, 2000));
    const list = shoppingList(days);
    expect(list.map((g) => g.label)).toEqual(['Fruit and veg', 'Bread, grains and cereals']);
    const oats = list[1].items.find((i) => i.name === 'Rolled oats')!;
    const expected = days.flatMap((d) => d.items).reduce((s, i) => s + 50 * i.portion, 0);
    expect(oats.grams).toBeGreaterThanOrEqual(expected);
    expect(oats.grams - expected).toBeLessThan(10);
    expect(gramsText(350)).toBe('350 g');
    expect(gramsText(1250)).toMatch(/^1[.,]3 kg$/); // en-ZA writes a decimal comma
  });

  it('forgets swaps for days gone by', () => {
    expect(keepRecentSwaps({ '2026-10-24:lunch': 1, '2026-10-26:dinner': 2 }, '2026-10-25')).toEqual({ '2026-10-26:dinner': 2 });
  });
});
