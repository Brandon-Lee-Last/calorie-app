/**
 * A tiny stand-in for the backend's auth and sync endpoints, with the same rules: last writer by `clientUpdatedAt`
 * wins (`stale` otherwise), every write bumps the account revision, pulls return changes after `since`.
 */
type Rec = Record<string, unknown> & { id: string; rev: number; clientUpdatedAt: number; deletedAt: number | null };

export class FakeServer {
  rev = 0;
  records = new Map<string, Rec>();
  purgedRev = 0;
  online = true;
  pullPageSize: number | null = null;
  calls: string[] = [];
  refreshTokens = new Set<string>();
  accessTokens = new Set<string>();
  integrityRequired = false;
  /** The account every new session belongs to. */
  userId = 'user-1';
  profile: Record<string, unknown> = {
    timezone: 'UTC', locale: 'en-ZA', units: 'metric', sex: null, birthYear: null, heightCm: null, weightKg: null,
    activityLevel: null, goal: 'maintain', goalRateKgPerWeek: 0, targetWeightKg: null, onboardedAt: null,
    goals: { calories: 2000, proteinG: 125, carbG: 225, fatG: 67, custom: false },
  };
  /** Profile PATCH bodies received, in order. */
  profilePatches: Record<string, unknown>[] = [];
  /** Answer profile PATCHes with 400, as for a value the server rejects. */
  rejectProfile = false;
  /** Scan records received by id (PUT /v1/scans/{id}). */
  scans = new Map<string, Record<string, unknown>>();
  /** Answer scan PUTs with this status instead of storing them. */
  scanStatus: number | null = null;
  /** What GET /v1/entitlements answers; POST /v1/subscription/simulate switches it to pro. */
  plan: 'free' | 'pro' = 'free';
  /** Goal changes received (PUT /v1/me/goals bodies, or 'recommended'). */
  goalChanges: unknown[] = [];
  /** Programs for GET /v1/programs. */
  programs: Record<string, unknown>[] = [];
  /** Foods by barcode for GET /v1/foods/barcode/{code}; also what search and GET /v1/foods/{id} find. */
  foods = new Map<string, Record<string, unknown>>();
  /** Queries sent to GET /v1/foods/search, in order. */
  searches: string[] = [];
  /** What GET /v1/config says. */
  maintenance = { enabled: false, message: '' };
  update: 'unknown' | 'none' | 'available' | 'required' = 'none';
  latestAppVersion = '1.0.0';
  /** What GET /v1/config says about simulated purchases. */
  testPurchases = false;
  /** What GET /v1/meal-plans answers, for the current plan (null: 404, as before the server had meal plans). */
  mealPlans: ((plan: 'free' | 'pro') => unknown) | null = null;
  /** The conversation with Pango (GET /v1/coach/messages), and how many more messages today's allowance has. */
  coachMessages: Record<string, unknown>[] = [];
  coachLeft = 10;
  /** What POST /v1/coach/pantry-meals answers with, and the bodies it was sent. */
  pantryRecipes: Record<string, unknown>[] = [];
  pantryAsks: Record<string, unknown>[] = [];
  /** Accounts deleted through DELETE /v1/account. */
  deletedAccounts: string[] = [];
  private n = 0;

  private session() {
    const id = ++this.n;
    const accessToken = `access-${id}-xxxxxxxxxxxxxxxxxxxx`;
    const refreshToken = `refresh-${id}-xxxxxxxxxxxxxxxxxxxx`;
    this.accessTokens.add(accessToken);
    this.refreshTokens.add(refreshToken);
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900, userId: this.userId, isAnonymous: true };
  }

  /** Writes a record as if another device had pushed it. */
  remoteWrite(type: string, record: Omit<Rec, 'rev' | 'deletedAt'> & { deletedAt?: number | null }) {
    const stored: Rec = { deletedAt: null, ...record, rev: ++this.rev, updatedAt: Date.now() } as unknown as Rec;
    this.records.set(`${type}:${record.id}`, { ...stored, __type: type } as Rec);
  }

  fetch = async (req: Request): Promise<Response> => {
    if (!this.online) throw new TypeError('Network request failed');
    const url = new URL(req.url);
    this.calls.push(`${req.method} ${url.pathname}`);
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const authed = () => this.accessTokens.has((req.headers.get('authorization') ?? '').replace('Bearer ', ''));

    if (url.pathname === '/v1/auth/challenge') return json(200, { challenge: 'c', expiresAt: 0, required: this.integrityRequired });
    if (url.pathname === '/v1/auth/anonymous') return json(201, this.session());
    if (url.pathname === '/v1/auth/refresh') {
      const { refreshToken } = (await req.json()) as { refreshToken: string };
      if (!this.refreshTokens.delete(refreshToken)) return json(401, { error: { code: 'unauthorized', message: 'no' } });
      return json(200, this.session());
    }
    if (!authed()) return json(401, { error: { code: 'token_expired', message: 'expired' } });

    if (url.pathname === '/v1/sync/push') {
      const { ops } = (await req.json()) as { ops: { type: string; id: string; op: string; data?: Record<string, unknown>; clientUpdatedAt?: number }[] };
      const results = ops.map((op) => {
        const key = `${op.type}:${op.id}`;
        const existing = this.records.get(key);
        if (op.op === 'upsert' && typeof op.data?.calories === 'number' && op.data.calories < 0)
          return { type: op.type, id: op.id, status: 'error', error: { code: 'validation_failed', message: 'bad' } };
        const at = op.op === 'upsert' ? (op.data!.clientUpdatedAt as number) : (op.clientUpdatedAt ?? Date.now());
        if (existing && existing.clientUpdatedAt > at) return { type: op.type, id: op.id, status: 'stale', record: strip(existing) };
        if (op.op === 'delete' && !existing) return { type: op.type, id: op.id, status: 'noop' };
        const next: Rec = op.op === 'upsert'
          ? ({ ...op.data, id: op.id, rev: ++this.rev, updatedAt: Date.now(), deletedAt: null, hasPhoto: false, __type: op.type } as unknown as Rec)
          : ({ ...existing!, deletedAt: at, clientUpdatedAt: at, rev: ++this.rev } as Rec);
        this.records.set(key, next);
        return { type: op.type, id: op.id, status: 'applied', record: strip(next) };
      });
      return json(200, { results });
    }
    if (url.pathname === '/v1/me/goals' && req.method === 'PUT') {
      const goals = (await req.json()) as Record<string, unknown>;
      this.goalChanges.push(goals);
      this.profile = { ...this.profile, goals: { ...goals, custom: true } };
      return json(200, this.profile);
    }
    if (url.pathname === '/v1/me/goals/apply-recommendation') {
      this.goalChanges.push('recommended');
      this.profile = { ...this.profile, goals: { ...(this.profile.goals as object), custom: false } };
      return json(200, this.profile);
    }
    if (url.pathname === '/v1/subscription/simulate') {
      this.plan = ((await req.json()) as { scenario?: string }).scenario === 'expire' ? 'free' : 'pro';
      return json(200, {});
    }
    if (url.pathname === '/v1/subscription') {
      return json(200, { subscription: null, entitlement: null, products: [{ id: 'pro_monthly', plan: 'pro', period: 'P1M', trialDays: 0 }, { id: 'pro_yearly', plan: 'pro', period: 'P1Y', trialDays: 7 }] });
    }
    if (url.pathname === '/v1/coach/messages' && req.method === 'GET') return json(200, { items: this.coachMessages });
    if (url.pathname === '/v1/coach/messages' && req.method === 'DELETE') {
      this.coachMessages = [];
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/v1/coach/messages' && req.method === 'POST') {
      const { message } = (await req.json()) as { message: string };
      const crisis = /kill myself/i.test(message);
      if (!crisis && this.coachLeft <= 0) return json(429, { error: { code: 'quota_exceeded', message: 'Daily limit reached' } });
      if (!crisis) this.coachLeft--;
      const at = Date.now();
      const asked = { id: `c${this.coachMessages.length + 1}`, role: 'user', content: message, kind: 'chat', createdAt: at };
      const reply = crisis
        ? { id: `c${this.coachMessages.length + 2}`, role: 'assistant', kind: 'crisis', createdAt: at + 1, content: "I'm really sorry. Please call SADAG's Suicide Crisis Helpline on 0800 567 567, or 112." }
        : { id: `c${this.coachMessages.length + 2}`, role: 'assistant', kind: 'chat', createdAt: at + 1, content: 'Try eggs on toast with spinach: about 30 g of protein.' };
      this.coachMessages.push(asked, reply);
      return json(200, { message: asked, reply, usage: crisis ? null : { used: 10 - this.coachLeft, limit: 10 } });
    }
    if (url.pathname === '/v1/coach/pantry-meals') {
      this.pantryAsks.push((await req.json()) as Record<string, unknown>);
      return json(200, { recipes: this.pantryRecipes, target: 500, usage: { used: 1, limit: 10 } });
    }
    if (url.pathname === '/v1/meal-plans') return this.mealPlans ? json(200, this.mealPlans(this.plan)) : json(404, { error: { code: 'not_found', message: 'Not found' } });
    if (url.pathname === '/v1/programs') return json(200, { items: this.programs });
    if (url.pathname === '/v1/programs/current') return json(200, { enrollment: null });
    if (url.pathname === '/v1/config') {
      return json(200, {
        apiVersion: 'v1', serverTime: Date.now(), maintenance: this.maintenance, update: this.update, minAppVersion: '1.0.0', latestAppVersion: this.latestAppVersion,
        features: {}, signIn: { google: false, email: false }, integrity: { required: false }, testPurchases: this.testPurchases, urls: { store: null, privacy: null, terms: null, supportEmail: null }, plans: {},
      });
    }
    if (url.pathname === '/v1/account' && req.method === 'DELETE') {
      const body = (await req.json()) as { confirm?: string };
      if (body.confirm !== 'DELETE MY ACCOUNT') return json(400, { error: { code: 'validation_failed', message: 'confirm' } });
      this.deletedAccounts.push(this.userId);
      this.records.clear();
      this.accessTokens.clear();
      this.refreshTokens.clear();
      return json(200, { deleted: true, subscriptionNote: this.plan === 'pro' ? 'Cancel your subscription in Google Play.' : null });
    }
    if (url.pathname === '/v1/account/export') {
      return json(200, { profile: this.profile, records: [...this.records.values()] });
    }
    if (url.pathname === '/v1/entitlements') {
      return json(200, {
        plan: this.plan, status: this.plan === 'pro' ? 'active' : 'none', expiresAt: null, willRenew: this.plan === 'pro', inGrace: false, isTrial: false,
        limits: { scansPerDay: 3, aiTextPerDay: 5, mealPhotos: 30, recipes: 10, progressPhotos: 12 },
        features: { workouts: this.plan === 'pro' ? 'all' : 'free', insights: this.plan === 'pro' ? 'full' : 'basic', export: true },
      });
    }
    if (url.pathname === '/v1/foods/search') {
      // Every word in the name or brand, like the backend.
      const words = (url.searchParams.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const items = [...this.foods.values()].filter((f) => words.every((w) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(w)));
      this.searches.push(url.searchParams.get('q') ?? '');
      return json(200, { items: items.slice(0, Number(url.searchParams.get('limit') ?? 25)) });
    }
    const foodId = url.pathname.match(/^\/v1\/foods\/([^/]+)$/);
    if (foodId && req.method === 'GET' && foodId[1] !== 'barcode') {
      const food = [...this.foods.values()].find((f) => f.id === foodId[1]);
      return food ? json(200, food) : json(404, { error: { code: 'not_found', message: 'Food not found' } });
    }
    const barcode = url.pathname.match(/^\/v1\/foods\/barcode\/([^/]+)$/);
    if (barcode) {
      const food = this.foods.get(barcode[1]);
      return food ? json(200, food) : json(404, { error: { code: 'not_found', message: 'No product found' } });
    }
    const scan = url.pathname.match(/^\/v1\/scans\/([^/]+)$/);
    if (scan && req.method === 'PUT') {
      if (this.scanStatus) return json(this.scanStatus, { error: { code: 'nope', message: 'scan refused' } });
      const body = (await req.json()) as Record<string, unknown>;
      this.scans.set(scan[1], body);
      return json(200, { id: scan[1], ...body });
    }
    if (url.pathname === '/v1/me/profile') {
      if (req.method === 'PATCH') {
        const body = (await req.json()) as Record<string, unknown>;
        this.profilePatches.push(body);
        if (this.rejectProfile) return json(400, { error: { code: 'validation_failed', message: 'bad profile' } });
        const { onboarded, ...fields } = body;
        this.profile = { ...this.profile, ...fields, onboardedAt: onboarded ? (this.profile.onboardedAt ?? Date.now()) : this.profile.onboardedAt };
      }
      return json(200, this.profile);
    }
    if (url.pathname === '/v1/sync/pull') {
      const since = Number(url.searchParams.get('since') ?? 0);
      const limit = this.pullPageSize ?? Number(url.searchParams.get('limit') ?? 200);
      if (since > 0 && since < this.purgedRev) return json(409, { error: { code: 'resync_required', message: 'resync' } });
      const changes = [...this.records.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev);
      const page = changes.slice(0, limit);
      const hasMore = changes.length > limit;
      return json(200, { changes: page.map((r) => ({ type: r.__type, record: strip(r) })), rev: hasMore ? page[page.length - 1].rev : this.rev, hasMore });
    }
    return json(404, { error: { code: 'not_found', message: url.pathname } });
  };
}

const strip = (r: Rec) => {
  const { __type, ...rest } = r as Rec & { __type?: string };
  void __type;
  return rest;
};
