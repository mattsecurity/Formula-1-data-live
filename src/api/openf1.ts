import type { Filter, RawCircuitInfo } from './types';
import { cacheGet, cacheSet } from './cache';

export const OPENF1_BASE = 'https://api.openf1.org/v1';

/**
 * A data source answers OpenF1-style queries. The real one talks to
 * api.openf1.org; the demo one synthesises a race locally so the app also
 * works offline.
 */
export interface DataSource {
  readonly id: string;
  get<T>(endpoint: string, filters?: Filter[], opts?: GetOptions): Promise<T[]>;
  /** Circuit map metadata (corners, rotation); defaults to the MultiViewer API. */
  circuitInfo?(meta: { circuit: string; year: number }): Promise<RawCircuitInfo | null>;
}

export interface GetOptions {
  signal?: AbortSignal;
  /** How long a cached answer stays valid. 0 disables caching. */
  cacheMs?: number;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function buildUrl(endpoint: string, filters: Filter[] = []): string {
  const parts = filters.map(([k, op, v]) => `${k}${op}${encodeURIComponent(String(v))}`);
  return `${OPENF1_BASE}/${endpoint}${parts.length ? '?' + parts.join('&') : ''}`;
}

// ---------------------------------------------------------------------------
// Polite request scheduler: the public API rate-limits per IP, so requests
// are queued, spaced out, and retried with back-off on 429/5xx.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3;
const MIN_SPACING_MS = 360;
const MAX_RETRIES = 7;

let active = 0;
let lastStart = 0;
let pausedUntil = 0;
const queue: (() => void)[] = [];

function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const now = Date.now();
    const wait = Math.max(lastStart + MIN_SPACING_MS - now, pausedUntil - now);
    if (wait > 0) {
      setTimeout(pump, wait);
      return;
    }
    lastStart = now;
    active++;
    queue.shift()!();
  }
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    });
    pump();
  });
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T[]> {
  let attempt = 0;
  for (;;) {
    signal?.throwIfAborted();
    let res: Response;
    try {
      res = await schedule(() => fetch(url, { signal, headers: { Accept: 'application/json' } }));
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      if (++attempt > 3) throw new HttpError(0, 'Connessione a OpenF1 non riuscita');
      await sleep(600 * 2 ** attempt, signal);
      continue;
    }
    if (res.ok) {
      const body = await res.json();
      return Array.isArray(body) ? (body as T[]) : [];
    }
    // OpenF1 answers 404 when a query simply has no rows.
    if (res.status === 404) return [];
    if (res.status === 429 || res.status >= 500) {
      // A 5xx usually means the query ran past the server's time budget:
      // retrying the very same query rarely helps, so give up early and let
      // the caller split it into smaller windows.
      const limit = res.status === 429 ? MAX_RETRIES : 2;
      if (++attempt > limit) throw new HttpError(res.status, `OpenF1 ha risposto ${res.status}`);
      const retryAfter = Number(res.headers.get('Retry-After'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      if (res.status === 429) pausedUntil = Date.now() + backoff;
      await sleep(backoff, signal);
      continue;
    }
    if (res.status === 422 || res.status === 413) {
      throw new HttpError(res.status, 'Richiesta troppo grande');
    }
    throw new HttpError(res.status, `OpenF1 ha risposto ${res.status}`);
  }
}

export class OpenF1Source implements DataSource {
  readonly id = 'openf1';

  async get<T>(endpoint: string, filters: Filter[] = [], opts: GetOptions = {}): Promise<T[]> {
    const url = buildUrl(endpoint, filters);
    const cacheMs = opts.cacheMs ?? 0;
    if (cacheMs > 0) {
      const hit = await cacheGet<T[]>(`q:${url}`, cacheMs);
      if (hit) return hit;
    }
    const rows = await fetchJson<T>(url, opts.signal);
    if (cacheMs > 0 && rows.length) void cacheSet(`q:${url}`, rows);
    return rows;
  }
}

export const HOUR = 3_600_000;
export const FOREVER = Number.POSITIVE_INFINITY;
