import { OFF_USER_AGENT } from '../config';

/**
 * Searching Open Food Facts straight from the phone, for products the food list does not have yet. Their search allows
 * 10 requests a minute per user (more gets the address blocked), so it runs only when the person asks, never while
 * they type. Picking a result fetches it through the backend's barcode lookup, which adds it to the food list.
 */
export type OffHit = {
  barcode: string;
  name: string;
  brand: string | null;
  calories100g: number;
  servingG: number | null;
  servingLabel: string | null;
  /** Sold in South Africa, according to Open Food Facts. */
  local: boolean;
};

export class OffSearchError extends Error {
  constructor(readonly reason: 'busy' | 'offline' | 'failed') {
    super(reason);
  }
}

export const OFF_SEARCHES_PER_MINUTE = 10;
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments,countries_tags';

export function offSearchUrl(query: string, pageSize = 24): string {
  const params = new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    sort_by: 'unique_scans_n',
    fields: FIELDS,
  });
  return `https://world.openfoodfacts.org/cgi/search.pl?${params}`;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Products with a barcode, a name and an energy figure; ones sold in South Africa first. */
export function mapOffHits(json: unknown): OffHit[] {
  const products = (json as { products?: unknown })?.products;
  if (!Array.isArray(products)) return [];
  const hits: OffHit[] = [];
  const seen = new Set<string>();
  for (const p of products as Record<string, unknown>[]) {
    const code = typeof p.code === 'string' ? p.code.trim() : '';
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || seen.has(code)) continue;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;
    const kj = num(n['energy_100g']);
    const kcal = num(n['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null);
    const name = [p.product_name, p.product_name_en, p.generic_name].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
    if (kcal === null || kcal > 900 || !name) continue;
    seen.add(code);
    const serving = num(p.serving_quantity);
    const brand = typeof p.brands === 'string' && p.brands.trim() ? p.brands.split(',')[0].trim() : null;
    hits.push({
      barcode: code,
      name: name.trim(),
      brand,
      calories100g: Math.round(kcal * 10) / 10,
      servingG: serving !== null && serving > 0 && serving <= 5000 ? serving : null,
      servingLabel: typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim() : null,
      local: Array.isArray(p.countries_tags) && p.countries_tags.includes('en:south-africa'),
    });
  }
  return [...hits.filter((h) => h.local), ...hits.filter((h) => !h.local)];
}

export class OffSearch {
  private recent: number[] = [];

  constructor(
    private fetcher: typeof fetch = (...args) => fetch(...args),
    private now: () => number = Date.now,
    private timeoutMs = 15_000,
  ) {}

  async search(query: string): Promise<OffHit[]> {
    const t = this.now();
    this.recent = this.recent.filter((at) => t - at < 60_000);
    if (this.recent.length >= OFF_SEARCHES_PER_MINUTE) throw new OffSearchError('busy');
    this.recent.push(t);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetcher(offSearchUrl(query), { headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' }, signal: abort.signal });
    } catch {
      throw new OffSearchError('offline');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429) throw new OffSearchError('busy');
    if (!res.ok) throw new OffSearchError('failed');
    try {
      return mapOffHits(await res.json());
    } catch {
      throw new OffSearchError('failed');
    }
  }
}

/** One per app run, so the per-minute count holds across visits to the search screen. */
export const offSearch = new OffSearch();
