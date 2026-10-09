import { afterEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the IndexedDB cache, honouring maxAgeMs like the real one.
const store = new Map<string, { v: unknown; ts: number }>();
vi.mock('../src/api/cache', () => ({
  cacheGet: async (key: string, maxAgeMs = Infinity) => {
    const e = store.get(key);
    return e && Date.now() - e.ts <= maxAgeMs ? e.v : undefined;
  },
  cacheSet: async (key: string, v: unknown) => void store.set(key, { v, ts: Date.now() }),
}));

const { OpenF1Source, HttpError } = await import('../src/api/openf1');

const KEY = 'q:https://api.openf1.org/v1/meetings?year=2026';
const locked = () => vi.fn(async () => new Response('{"detail":"Live F1 session in progress"}', { status: 401 }));

describe('OpenF1 while a live session locks free access', () => {
  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('serves expired cached rows instead of failing', async () => {
    store.set(KEY, { v: [{ meeting_key: 1 }], ts: Date.now() - 48 * 3_600_000 });
    vi.stubGlobal('fetch', locked());
    const rows = await new OpenF1Source().get('meetings', [['year', '=', 2026]], { cacheMs: 6 * 3_600_000 });
    expect(rows).toEqual([{ meeting_key: 1 }]);
  });

  it('explains the lock when nothing is cached', async () => {
    vi.stubGlobal('fetch', locked());
    const err = await new OpenF1Source().get('meetings', [['year', '=', 2026]], { cacheMs: 6 * 3_600_000 }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/accesso gratuito/);
  });

  it('does not touch the cache for uncached queries', async () => {
    store.set(KEY, { v: [{ meeting_key: 1 }], ts: 0 });
    vi.stubGlobal('fetch', locked());
    await expect(new OpenF1Source().get('meetings', [['year', '=', 2026]])).rejects.toBeInstanceOf(HttpError);
  });
});
