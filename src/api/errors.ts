/** A failed API call. `status` 0 means the request never got an answer (offline, timeout, DNS). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Worth trying again later without changing anything. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  /** The server will refuse this exact request every time (invalid, conflicting or too large), so drop it. */
  get permanent(): boolean {
    return this.status === 400 || this.status === 409 || this.status === 413 || this.status === 422;
  }
}

type ErrorBody = { error?: { code?: string; message?: string; details?: unknown; requestId?: string } };

export function apiErrorFrom(status: number, body: unknown): ApiError {
  const e = (body as ErrorBody | undefined)?.error;
  return new ApiError(status, e?.code ?? `http_${status}`, e?.message ?? `Request failed (${status})`, e?.details, e?.requestId);
}

export const networkError = (cause: unknown) =>
  new ApiError(0, 'network', cause instanceof Error && cause.name === 'AbortError' ? 'The request timed out' : 'No connection to the server');
