import { NextResponse } from 'next/server';

type RateLimitRecord = {
  remaining: number;
  reset: number;
};

type RateLimitStore = Map<string, RateLimitRecord>;

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;

const globalRateLimitStore =
  (globalThis as unknown as { __rateLimitStore?: RateLimitStore }).__rateLimitStore ??
  new Map<string, RateLimitRecord>();

if (!(globalThis as unknown as { __rateLimitStore?: RateLimitStore }).__rateLimitStore) {
  (globalThis as unknown as { __rateLimitStore?: RateLimitStore }).__rateLimitStore =
    globalRateLimitStore;
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(10),
    'X-RateLimit-Remaining': Math.max(result.remaining, 0).toString(10),
    'X-RateLimit-Reset': Math.ceil(result.reset / 1000).toString(10)
  };
}

export function applyHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = buildRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function applyRateLimit(
  key: string,
  { limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS }: RateLimitOptions = {}
): RateLimitResult {
  const now = Date.now();
  const expiresAt = now + windowMs;
  const existing = globalRateLimitStore.get(key);

  if (!existing || existing.reset < now) {
    globalRateLimitStore.set(key, { remaining: limit - 1, reset: expiresAt });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: expiresAt
    };
  }

  if (existing.remaining <= 0) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: existing.reset
    };
  }

  existing.remaining -= 1;
  globalRateLimitStore.set(key, existing);

  return {
    success: true,
    limit,
    remaining: existing.remaining,
    reset: existing.reset
  };
}
