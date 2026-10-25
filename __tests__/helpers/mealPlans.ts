import type { Meal, MealPlans } from '../../src/data/mealPlan';

const split = { breakfast: 0.25, lunch: 0.3, dinner: 0.3, snack: 0.15 };
const diet = (slug: string, title: string, tier: 'free' | 'pro', caution: string | null = null) => ({
  slug,
  title,
  tier,
  caution,
  summary: `${title} summary.`,
  description: '',
  goals: ['lose', 'maintain', 'gain'] as ('lose' | 'maintain' | 'gain')[],
  highlights: [`${title} highlight`],
  split,
  macros: { proteinPct: 20, carbPct: 50, fatPct: 30 },
  mealCount: 0,
  locked: false,
}); // fmt: skip

const meal = (slug: string, title: string, slot: Meal['slots'][number], diets: string[], calories: number, extra: Partial<Meal> = {}): Meal => ({
  slug,
  title,
  summary: '',
  slots: [slot],
  diets,
  minutes: 10,
  tags: [],
  source: 'Worked out from the ingredients with USDA FoodData Central figures',
  nutrition: {
    calories,
    proteinG: Math.round(calories / 20),
    carbG: Math.round(calories / 8),
    fatG: Math.round(calories / 36),
    fibreG: 3,
  },
  ingredients: [
    {
      name: 'Rolled oats',
      grams: 50,
      measure: '½ cup',
      aisle: 'bakery-grains',
    },
    { name: `${title} veg`, grams: 100, measure: null, aisle: 'produce' },
  ],
  steps: ['Cook it.', 'Eat it.'],
  locked: false,
  ...extra,
}); // fmt: skip

/** A small library like the server's: two free styles and one Pro style, a few meals for each part of the day. */
export function sampleMealPlans(plan: 'free' | 'pro' = 'free'): MealPlans {
  const diets = [diet('balanced', 'Balanced', 'free'), diet('budget', 'Budget', 'free'), diet('low-carb', 'Low carb', 'pro', 'On diabetes medicine? Talk to your doctor first.')];
  const meals = [
    meal('oats', 'Oats with banana', 'breakfast', ['balanced', 'budget'], 400),
    meal('eggs-toast', 'Eggs on toast', 'breakfast', ['balanced'], 420),
    meal('pap-porridge', 'Soft maize porridge', 'breakfast', ['balanced', 'budget'], 360),
    meal('omelette', 'Veggie omelette', 'breakfast', ['low-carb'], 360),
    meal('tuna-sandwich', 'Tuna sandwich', 'lunch', ['balanced', 'budget'], 400),
    meal('lentil-soup', 'Lentil soup', 'lunch', ['balanced', 'budget'], 430),
    meal('chicken-salad', 'Chicken salad', 'lunch', ['balanced', 'low-carb'], 400),
    meal('pap-chicken', 'Pap, chicken and cabbage', 'dinner', ['balanced', 'budget'], 560),
    meal('bolognese', 'Lean bolognese', 'dinner', ['balanced'], 500),
    meal('steak', 'Steak and greens', 'dinner', ['low-carb'], 440),
    meal('apple-pb', 'Apple with peanut butter', 'snack', ['balanced', 'budget'], 170),
    meal('popcorn', 'Popcorn', 'snack', ['balanced', 'budget'], 100),
    meal('biltong', 'Lean biltong', 'snack', ['balanced', 'low-carb'], 80),
  ];
  const free = new Set(diets.filter((d) => d.tier === 'free').map((d) => d.slug));
  return {
    diets: diets.map((d) => ({
      ...d,
      locked: d.tier === 'pro' && plan !== 'pro',
      mealCount: meals.filter((m) => m.diets.includes(d.slug)).length,
    })),
    meals: meals.map((m) => {
      const locked = plan !== 'pro' && !m.diets.some((s) => free.has(s));
      return locked ? { ...m, locked, ingredients: [], steps: [] } : m;
    }),
    updatedAt: 1,
  };
}
