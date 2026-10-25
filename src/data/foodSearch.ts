import type { Food } from './foodMath';
import type { Usual } from './history';

/** The server answers from two characters on. */
export const MIN_QUERY = 2;

/** Lowercase words without accents, like the backend's search ("droewors" finds "Droëwors"). */
export function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

/** Does every word of the query appear in the text (accents and case ignored), as the backend's search requires? */
export function matchesQuery(text: string, query: string): boolean {
  const have = words(text).join(' ');
  return words(query).every((w) => have.includes(w));
}

/** One row per product: the food list can hold the same thing twice ("Weet-Bix" and "Weet bix" from one brand). */
export function dedupeFoods(items: Food[]): Food[] {
  const seen = new Set<string>();
  return items.filter((f) => {
    const key = `${words(f.name).join(' ')}|${words(f.brand ?? '').join(' ')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const fold = (c: string) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** The text cut into pieces, with the first place each query word appears marked, to show it in bold. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const chars = [...text];
  const folded = chars.map(fold);
  // Only when every character folds to one, so positions line up with the original text.
  if (folded.some((c) => c.length !== 1)) return [{ text, hit: false }];
  const flat = folded.join('');
  const marked = new Array<boolean>(chars.length).fill(false);
  for (const w of words(query)) {
    const at = flat.indexOf(w);
    if (at >= 0) for (let i = at; i < at + w.length; i++) marked[i] = true;
  }
  const parts: { text: string; hit: boolean }[] = [];
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === marked[i]) last.text += c;
    else parts.push({ text: c, hit: marked[i] });
  });
  return parts.length ? parts : [{ text, hit: false }];
}
