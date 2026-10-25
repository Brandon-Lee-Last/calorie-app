import type { Food } from './foodMath';
import type { Usual } from './history';

/** The server answers from two characters on. */
export const MIN_QUERY = 2;

/** Lowercase words without accents, like the backend's search ("droewors" finds "Droëwors"). */
export function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The person's own meals whose name holds every word of the query (as the start of a word). */
export function matchMeals(meals: Usual[], query: string, limit = 5): Usual[] {
  const wanted = words(query);
  if (wanted.length === 0) return [];
  return meals
    .filter((m) => {
      const have = words(m.name);
      return wanted.every((w) => have.some((h) => h.startsWith(w)));
    })
    .slice(0, limit);
}

type Describable = Pick<Food, 'brand' | 'servingG' | 'servingLabel' | 'calories100g'>;

/** What a result row shows: the energy for one serving when the pack gives one, else for 100 g. */
export function describeFood(f: Describable): { kcal: number; per: string; detail: string } {
  const per = f.servingG ? f.servingLabel || `${f.servingG} g` : '100 g';
  const kcal = Math.round(f.servingG ? (f.calories100g * f.servingG) / 100 : f.calories100g);
  return { kcal, per, detail: [f.brand, per].filter(Boolean).join(' · ') };
}

export const SOURCE_LABEL: Record<Food['source'], string> = {
  custom: 'Your food',
  openfoodfacts: 'Open Food Facts',
  usda: 'USDA FoodData Central',
  curated: "Pango's food list",
};

/** Server results without the foods already shown as the person's own meals. */
export function withoutShown(items: Food[], shown: Usual[]): Food[] {
  const ids = new Set(shown.map((m) => m.foodId).filter(Boolean));
  return items.filter((f) => !ids.has(f.id));
}
