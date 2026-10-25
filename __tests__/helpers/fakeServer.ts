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
  /** Products by barcode for GET /v1/foods/barcode/{code}; anything else is 404. */
  foods = new Map<string, Record<string, unknown>>();
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
      this.plan = 'pro';
      return json(200, {});
    }
    if (url.pathname === '/v1/subscription') {
      return json(200, { subscription: null, entitlement: null, products: [{ id: 'pro_monthly', plan: 'pro', period: 'P1M', trialDays: 0 }, { id: 'pro_yearly', plan: 'pro', period: 'P1Y', trialDays: 7 }] });
    }
    if (url.pathname === '/v1/programs') return json(200, { items: this.programs });
    if (url.pathname === '/v1/programs/current') return json(200, { enrollment: null });
    if (url.pathname === '/v1/entitlements') {
      return json(200, {
        plan: this.plan, status: this.plan === 'pro' ? 'active' : 'none', expiresAt: null, willRenew: this.plan === 'pro', inGrace: false, isTrial: false,
        limits: { scansPerDay: 3, aiTextPerDay: 5, mealPhotos: 30, recipes: 10, progressPhotos: 12 },
        features: { workouts: this.plan === 'pro' ? 'all' : 'free', insights: this.plan === 'pro' ? 'full' : 'basic', export: true },
      });
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
