import type { components } from '../api/schema';
import { dateAt, shiftDate, type MealType } from './dates';
import type { DiaryEntry, NewEntry } from './repo';

export type MealPlans = components['schemas']['MealPlans'];
export type Diet = components['schemas']['Diet'];
export type Meal = components['schemas']['Meal'];
export type Aisle = NonNullable<components['schemas']['MealIngredient']['aisle']>;

/** Meta keys: the diet style picked (a slug), swaps per planned meal, ticked shopping items. */
export const PLAN_DIET_KEY = 'plan.diet';
export const PLAN_SWAPS_KEY = 'plan.swaps';
export const SHOPPING_TICKS_KEY = 'plan.shopping';
/** Meta key: the person closed the "Want a meal plan?" card on Today. */
export const PLAN_INVITE_KEY = 'plan.invite.dismissed';

/** Free accounts plan today and tomorrow; Plus plans the week ahead. */
export const FREE_DAYS = 2;
export const PLUS_DAYS = 7;
/** At this many calories a day there is room for a second snack. */
export const SECOND_SNACK_FROM = 2400;
const MIN_PORTION = 0.5;
const MAX_PORTION = 2;

export type SlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'snack2';
export type PlanItem = {
  slot: SlotKey;
  mealType: MealType;
  /** Calories this slot aims for. */
  target: number;
  meal: Meal;
  /** How many portions of the meal, in quarters from ½ to 2. */
  portion: number;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  /** How many meals this slot could be (for "Swap"). */
  options: number;
};
export type DayPlan = {
  date: string;
  items: PlanItem[];
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
};
export type Swaps = Record<string, number>;

const round1 = (n: number) => Math.round(n * 10) / 10;
const dayNumber = (date: string) => Math.round(dateAt(date).getTime() / 86_400_000);
export const swapKey = (date: string, slot: SlotKey) => `${date}:${slot}`;
export const SLOT_LABEL: Record<SlotKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  snack2: 'Second snack',
};
export const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** A small fixed-seed shuffle, so a day's plan is the same every time it is drawn (and on every phone). */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function shuffled<T>(items: T[], seed: string): T[] {
  const out = [...items];
  const rand = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The meals of the day, with each one's share of the calories. A second snack splits the snack share. */
export function slotsFor(diet: Diet, calories: number): { slot: SlotKey; mealType: MealType; share: number }[] {
  const two = calories >= SECOND_SNACK_FROM;
  const s = diet.split;
  return [
    { slot: 'breakfast', mealType: 'breakfast', share: s.breakfast },
    { slot: 'lunch', mealType: 'lunch', share: s.lunch },
    { slot: 'dinner', mealType: 'dinner', share: s.dinner },
    { slot: 'snack', mealType: 'snack', share: two ? s.snack / 2 : s.snack },
    ...(two
      ? [
          {
            slot: 'snack2' as const,
            mealType: 'snack' as const,
            share: s.snack / 2,
          },
        ]
      : []),
  ];
}

/** The nearest quarter portion to `target` calories, kept between ½ and 2. */
export function portionFor(mealCalories: number, target: number): number {
  if (mealCalories <= 0) return 1;
  return Math.min(MAX_PORTION, Math.max(MIN_PORTION, Math.round((target / mealCalories) * 4) / 4));
}

/** The meals a slot can be: in the diet, that meal of the day, and open to this account. */
export function optionsFor(plans: MealPlans, diet: Diet, mealType: MealType): Meal[] {
  return plans.meals.filter((m) => !m.locked && m.diets.includes(diet.slug) && m.slots.includes(mealType));
}

/**
 * One day's plan. Each slot steps through its meals in an order shuffled once a week, a different one each day, so
 * a week rarely repeats; "Swap" moves a slot on to the next. The same meal is never in two slots of one day.
 */
export function planDay(plans: MealPlans, diet: Diet, date: string, calories: number, swaps: Swaps = {}): DayPlan {
  const n = dayNumber(date);
  const week = Math.floor(n / 7);
  const used = new Set<string>();
  const items: PlanItem[] = [];
  for (const { slot, mealType, share } of slotsFor(diet, calories)) {
    const options = shuffled(optionsFor(plans, diet, mealType), `${diet.slug}:${slot}:${week}`);
    if (options.length === 0) continue;
    let i = (n - week * 7 + (swaps[swapKey(date, slot)] ?? 0)) % options.length;
    for (let tries = 0; used.has(options[i].slug) && tries < options.length; tries++) i = (i + 1) % options.length;
    const meal = options[i];
    used.add(meal.slug);
    const target = Math.round(calories * share);
    items.push({
      ...itemFor(meal, portionFor(meal.nutrition.calories, target), slot, mealType),
      target,
      options: options.length,
    });
  }
  const sum = (k: 'calories' | 'proteinG' | 'carbG' | 'fatG') => items.reduce((s, x) => s + x[k], 0);
  return {
    date,
    items,
    calories: sum('calories'),
    proteinG: round1(sum('proteinG')),
    carbG: round1(sum('carbG')),
    fatG: round1(sum('fatG')),
  };
}

/** A meal at a number of portions, with its numbers scaled. */
export function itemFor(meal: Meal, portion: number, slot: SlotKey, mealType: MealType): PlanItem {
  return {
    slot,
    mealType,
    target: Math.round(meal.nutrition.calories * portion),
    meal,
    portion,
    calories: Math.round(meal.nutrition.calories * portion),
    proteinG: round1(meal.nutrition.proteinG * portion),
    carbG: round1(meal.nutrition.carbG * portion),
    fatG: round1(meal.nutrition.fatG * portion),
    options: 1,
  };
}

/** The days a person can plan, from `today`. */
export const planDates = (today: string, plus: boolean) => Array.from({ length: plus ? PLUS_DAYS : FREE_DAYS }, (_, i) => shiftDate(today, i));

/** "Today", "Tomorrow", then "Wed 29". */
export function dayName(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === shiftDate(today, 1)) return 'Tomorrow';
  return dateAt(date).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
  });
}

/** "1 portion", "1½ portions", "¾ portion". */
export function portionLabel(p: number): string {
  const whole = Math.floor(p);
  const part = ({ 0.25: '¼', 0.5: '½', 0.75: '¾' } as Record<number, string>)[p - whole] ?? '';
  return `${whole || ''}${part} ${p > 1 ? 'portions' : 'portion'}`.trim();
}

/** Ingredients for a number of portions, in grams people can weigh (to 5 g, or 1 g under 20 g). */
export function scaledIngredients(meal: Meal, portion: number) {
  return meal.ingredients.map((i) => {
    const g = i.grams * portion;
    return {
      ...i,
      grams: g < 20 ? Math.max(1, Math.round(g)) : Math.round(g / 5) * 5,
      measure: portion === 1 ? i.measure : null,
    };
  });
}

/** A planned meal as a diary entry. */
export function entryFor(item: PlanItem, loggedAt?: number): NewEntry {
  return {
    name: item.meal.title,
    calories: item.calories,
    proteinG: item.proteinG,
    carbG: item.carbG,
    fatG: item.fatG,
    fiberG: item.meal.nutrition.fibreG == null ? null : round1(item.meal.nutrition.fibreG * item.portion),
    quantityG: Math.round(item.meal.ingredients.reduce((s, i) => s + i.grams, 0) * item.portion),
    servings: item.portion,
    mealType: item.mealType,
    source: 'food',
    ...(loggedAt ? { loggedAt } : {}),
  };
}

const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * What to suggest logging now: the planned meal for this time of day if it is not logged, else the next one later
 * in the day, else a snack. Meals whose time has passed are not suggested.
 */
export function nextPlanned(plan: DayPlan, entries: DiaryEntry[], now: MealType): PlanItem | null {
  const open = plan.items.filter((i) => !isLogged(i, entries));
  const at = ORDER.indexOf(now);
  return open.find((i) => i.mealType === now) ?? open.find((i) => i.mealType !== 'snack' && ORDER.indexOf(i.mealType) > at) ?? open.find((i) => i.mealType === 'snack') ?? null;
}

/** Whether a planned meal is already in the diary for its day and meal. */
export const isLogged = (item: PlanItem, entries: DiaryEntry[]) => entries.some((e) => e.name === item.meal.title && e.mealType === item.mealType && !e.deletedAt);

export const AISLE_LABEL: Record<Aisle | 'other', string> = {
  produce: 'Fruit and veg',
  'meat-fish': 'Meat and fish',
  'dairy-eggs': 'Dairy, eggs and fridge',
  'bakery-grains': 'Bread, grains and cereals',
  pantry: 'Tins, jars and dry goods',
  frozen: 'Frozen',
  other: 'Other',
};
const AISLE_ORDER: (Aisle | 'other')[] = ['produce', 'meat-fish', 'dairy-eggs', 'bakery-grains', 'pantry', 'frozen', 'other'];

/** Everything the planned days need, added up per ingredient and grouped by shop aisle. */
export function shoppingList(days: DayPlan[]): {
  aisle: Aisle | 'other';
  label: string;
  items: { name: string; grams: number }[];
}[] {
  const totals = new Map<string, { name: string; grams: number; aisle: Aisle | 'other' }>();
  for (const d of days)
    for (const item of d.items)
      for (const i of item.meal.ingredients) {
        const t = totals.get(i.name) ?? {
          name: i.name,
          grams: 0,
          aisle: i.aisle ?? 'other',
        };
        t.grams += i.grams * item.portion;
        totals.set(i.name, t);
      }
  return AISLE_ORDER.map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: [...totals.values()]
      .filter((t) => t.aisle === aisle)
      .map((t) => ({
        name: t.name,
        grams: t.grams < 50 ? Math.ceil(t.grams / 5) * 5 : Math.ceil(t.grams / 10) * 10,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/** "1.2 kg" or "350 g". */
export const gramsText = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString('en-ZA', { maximumFractionDigits: 1 })} kg` : `${g} g`);

/** Swaps for days gone by are dropped, so the stored list stays small. */
export function keepRecentSwaps(swaps: Swaps, today: string): Swaps {
  return Object.fromEntries(Object.entries(swaps).filter(([k]) => k.slice(0, 10) >= today));
}

/** Whether a style suits the person's goal (lose, maintain or gain). */
export const suitsGoal = (diet: Diet, goal: string | null | undefined) => goal != null && (diet.goals as string[]).includes(goal);
