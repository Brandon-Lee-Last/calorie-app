import createClient from 'openapi-fetch';

import { apiErrorFrom, networkError } from './errors';
import type { paths } from './schema';

export type Api = ReturnType<typeof createClient<paths>>;

/** Where the access token comes from, and how to get a new one after a 401. */
export type TokenSource = {
  accessToken(): Promise<string | null>;
  /** Called after a 401. Resolves true when a fresh token is ready and the request should be retried once. */
  refreshAfterUnauthorized(): Promise<boolean>;
};

export type ApiOptions = {
  baseUrl: string;
  appVersion?: string;
  tokens?: TokenSource;
  timeoutMs?: number;
  /** Defaults to the global fetch. Always called with a Request. */
  fetchImpl?: Fetcher;
};

type Fetcher = (request: Request) => Promise<Response>;

async function send(fetchImpl: Fetcher, request: Request, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(new Request(request, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A typed client for the backend (types generated from its OpenAPI spec into schema.d.ts). Adds the bearer token and
 * app version, times requests out, and on a 401 refreshes the session once and retries.
 */
export function createApi({ baseUrl, appVersion, tokens, timeoutMs = 15_000, fetchImpl = (r) => fetch(r) }: ApiOptions): Api {
  const withHeaders = async (request: Request): Promise<Request> => {
    const headers = new Headers(request.headers);
    if (appVersion) headers.set('x-app-version', appVersion);
    const token = tokens ? await tokens.accessToken() : null;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return new Request(request, { headers });
  };
  const doFetch = async (input: Request): Promise<Response> => {
    const first = await send(fetchImpl, await withHeaders(input.clone()), timeoutMs);
    if (first.status !== 401 || !tokens || !(await tokens.refreshAfterUnauthorized())) return first;
    return send(fetchImpl, await withHeaders(input), timeoutMs);
  };
  return createClient<paths>({ baseUrl, fetch: doFetch });
}

/** Resolves to the data of a successful call, or throws an ApiError. */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch (e) {
    throw networkError(e);
  }
  if (result.error !== undefined || !result.response.ok) throw apiErrorFrom(result.response.status, result.error);
  return result.data as T;
}
