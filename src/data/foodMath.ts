import type { components } from '../api/schema';
import type { MealType } from './dates';
import type { NewEntry } from './repo';

export type Food = components['schemas']['Food'];
export type Amount = { unit: 'serving'; servings: number } | { unit: 'g'; grams: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Grams eaten for an amount (servings need the food's serving size). */
export function gramsFor(food: Food, amount: Amount): number {
  return amount.unit === 'g' ? amount.grams : amount.servings * (food.servingG ?? 100);
}

/** One serving if the pack says how big that is, else 100 g. */
export function defaultAmount(food: Food): Amount {
  return food.servingG ? { unit: 'serving', servings: 1 } : { unit: 'g', grams: 100 };
}

export function nutritionFor(food: Food, grams: number) {
  const f = grams / 100;
  const opt = (v: number | null) => (v === null ? null : round1(v * f));
  return {
    calories: Math.round(food.calories100g * f),
    proteinG: round1(food.protein100g * f),
    carbG: round1(food.carb100g * f),
    fatG: round1(food.fat100g * f),
    fiberG: opt(food.fiber100g),
    sugarG: opt(food.sugar100g),
    sodiumMg: food.sodiumMg100g === null ? null : Math.round(food.sodiumMg100g * f),
  };
}

export function entryFromFood(food: Food, amount: Amount, mealType: MealType, source: NewEntry['source'] = 'barcode'): NewEntry {
  const grams = gramsFor(food, amount);
  return {
    ...nutritionFor(food, grams),
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    foodId: food.id,
    quantityG: Math.round(grams * 10) / 10,
    servings: amount.unit === 'serving' ? amount.servings : null,
    mealType,
    source,
  };
}

/** "1 serving (30 g)", "1½ servings (45 g)", "150 g". */
export function amountLabel(food: Food, amount: Amount): string {
  if (amount.unit === 'g') return `${Math.round(amount.grams)} g`;
  const n = amount.servings;
  const text = Number.isInteger(n) ? String(n) : n % 1 === 0.5 ? `${Math.floor(n) || ''}½` : String(n);
  return `${text} serving${n === 1 ? '' : 's'} (${Math.round(gramsFor(food, amount))} g)`;
}
