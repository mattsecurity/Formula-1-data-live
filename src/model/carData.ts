import { cacheGet, cacheSet } from '../api/cache';
import type { DataSource } from '../api/openf1';
import type { RawCarData } from '../api/types';
import { bisect } from './interp';
import type { SessionData } from './types';
import { parseDate } from './util';

export interface CarTelemetry {
  t: Float64Array;
  speed: Float32Array;
  rpm: Float32Array;
  gear: Uint8Array;
  throttle: Uint8Array;
  brake: Uint8Array;
  drs: Uint8Array;
}

export interface TelemetrySample {
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
}

const iso = (ms: number) => new Date(ms).toISOString();

async function fetchRange(src: DataSource, sessionKey: number, driver: number, from: number, to: number, signal?: AbortSignal, depth = 0): Promise<RawCarData[]> {
  try {
    return await src.get<RawCarData>(
      'car_data',
      [
        ['session_key', '=', sessionKey],
        ['driver_number', '=', driver],
        ['date', '>=', iso(from)],
        ['date', '<', iso(to)],
      ],
      { signal },
    );
  } catch (e) {
    if ((e as Error).name === 'AbortError' || depth >= 4 || to - from < 120_000) throw e;
    const mid = Math.round((from + to) / 2);
    const a = await fetchRange(src, sessionKey, driver, from, mid, signal, depth + 1);
    return a.concat(await fetchRange(src, sessionKey, driver, mid, to, signal, depth + 1));
  }
}

export function compactCarData(rows: RawCarData[], t0: number): CarTelemetry {
  const sorted = rows
    .map((r) => ({ ...r, tt: (parseDate(r.date) - t0) / 1000 }))
    .filter((r) => Number.isFinite(r.tt))
    .sort((a, b) => a.tt - b.tt);
  const n = sorted.length;
  const out: CarTelemetry = {
    t: new Float64Array(n),
    speed: new Float32Array(n),
    rpm: new Float32Array(n),
    gear: new Uint8Array(n),
    throttle: new Uint8Array(n),
    brake: new Uint8Array(n),
    drs: new Uint8Array(n),
  };
  sorted.forEach((r, i) => {
    out.t[i] = r.tt;
    out.speed[i] = r.speed ?? 0;
    out.rpm[i] = r.rpm ?? 0;
    out.gear[i] = r.n_gear ?? 0;
    out.throttle[i] = Math.max(0, Math.min(100, r.throttle ?? 0));
    out.brake[i] = r.brake ? (r.brake > 1 ? Math.min(100, r.brake) : 100) : 0;
    out.drs[i] = r.drs ?? 0;
  });
  return out;
}

const memory = new Map<string, Promise<CarTelemetry>>();

/** Whole-session telemetry for one car (lazy, cached in memory and IndexedDB). */
export function loadCarTelemetry(src: DataSource, data: SessionData, driver: number): Promise<CarTelemetry> {
  const from = Math.round(data.t0 + (data.startT - 60) * 1000);
  const to = Math.round(data.t0 + (data.endT + 60) * 1000);
  const key = `car:v1:${src.id}:${data.meta.key}:${driver}:${from}:${to}`;
  const hit = memory.get(key);
  if (hit) return hit;
  const cacheable = Date.now() > data.meta.dateEnd + 2 * 3_600_000;
  const p = (async () => {
    if (cacheable) {
      const c = await cacheGet<CarTelemetry>(key);
      if (c) return c;
    }
    const rows = await fetchRange(src, data.meta.key, driver, from, to);
    const out = compactCarData(rows, data.t0);
    if (cacheable && out.t.length) void cacheSet(key, out);
    return out;
  })();
  memory.set(key, p);
  p.catch(() => memory.delete(key));
  return p;
}

/** Telemetry for a time window (a single lap), not cached across sessions. */
export async function loadCarWindow(src: DataSource, data: SessionData, driver: number, a: number, b: number): Promise<CarTelemetry> {
  const from = Math.round(data.t0 + a * 1000);
  const to = Math.round(data.t0 + b * 1000);
  const key = `carw:v1:${src.id}:${data.meta.key}:${driver}:${from}:${to}`;
  const c = await cacheGet<CarTelemetry>(key);
  if (c) return c;
  const out = compactCarData(await fetchRange(src, data.meta.key, driver, from, to), data.t0);
  if (out.t.length) void cacheSet(key, out);
  return out;
}

export function sampleAt(tel: CarTelemetry, t: number): TelemetrySample | null {
  const i = bisect(tel.t, t);
  if (i < 0 || t - tel.t[i] > 5) return null;
  const j = Math.min(tel.t.length - 1, i + 1);
  const dt = tel.t[j] - tel.t[i];
  const u = dt > 0 ? Math.min(1, (t - tel.t[i]) / dt) : 0;
  return {
    speed: tel.speed[i] + (tel.speed[j] - tel.speed[i]) * u,
    rpm: tel.rpm[i] + (tel.rpm[j] - tel.rpm[i]) * u,
    gear: tel.gear[i],
    throttle: tel.throttle[i] + (tel.throttle[j] - tel.throttle[i]) * u,
    brake: tel.brake[i],
    drs: tel.drs[i] >= 10,
  };
}
