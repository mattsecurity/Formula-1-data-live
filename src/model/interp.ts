import type { DriverTrack, TimedValue } from './types';

/** Index of the last element with t <= target (-1 if none). */
export function bisect(ts: ArrayLike<number>, target: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  if (hi < 0 || ts[0] > target) return -1;
  if (ts[hi] <= target) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function bisectBy<T>(arr: T[], target: number, key: (v: T) => number): number {
  let lo = 0;
  let hi = arr.length - 1;
  if (hi < 0 || key(arr[0]) > target) return -1;
  if (key(arr[hi]) <= target) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (key(arr[mid]) <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Latest value at or before t. */
export function valueAt<T>(series: TimedValue<T>[] | undefined, t: number): T | undefined {
  if (!series) return undefined;
  const i = bisectBy(series, t, (v) => v.t);
  return i >= 0 ? series[i].v : undefined;
}

const MAX_GAP = 6; // seconds — longer holes are not interpolated across

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

export interface CarState {
  x: number;
  y: number;
  d: number;
  /** true if the sample is fresh (car has telemetry around t) */
  live: boolean;
}

export function carAt(track: DriverTrack, t: number): CarState | null {
  const n = track.t.length;
  if (!n) return null;
  const i = bisect(track.t, t);
  if (i < 0) return { x: track.x[0], y: track.y[0], d: track.d[0], live: false };
  if (i >= n - 1) return { x: track.x[n - 1], y: track.y[n - 1], d: track.d[n - 1], live: t - track.t[n - 1] < MAX_GAP };
  const t1 = track.t[i];
  const t2 = track.t[i + 1];
  const dt = t2 - t1;
  if (dt > MAX_GAP) return { x: track.x[i], y: track.y[i], d: track.d[i], live: t - t1 < MAX_GAP };
  const u = dt > 0 ? (t - t1) / dt : 0;
  const i0 = Math.max(0, i - 1);
  const i3 = Math.min(n - 1, i + 2);
  return {
    x: catmull(track.x[i0], track.x[i], track.x[i + 1], track.x[i3], u),
    y: catmull(track.y[i0], track.y[i], track.y[i + 1], track.y[i3], u),
    d: track.d[i] + (track.d[i + 1] - track.d[i]) * u,
    live: true,
  };
}

/** Linear interpolation of race distance at t. */
export function distanceAt(track: DriverTrack, t: number): number {
  const n = track.t.length;
  if (!n) return 0;
  const i = bisect(track.t, t);
  if (i < 0) return track.d[0];
  if (i >= n - 1) return track.d[n - 1];
  const dt = track.t[i + 1] - track.t[i];
  const u = dt > 0 ? (t - track.t[i]) / dt : 0;
  return track.d[i] + (track.d[i + 1] - track.d[i]) * Math.min(1, u);
}

/**
 * Earliest time the car reached race distance `d` (monotone search over the
 * running maximum, robust to small GPS jitter). Returns null if never.
 */
export function timeAtDistance(track: DriverTrack, d: number, runningMax: Float64Array): number | null {
  const n = runningMax.length;
  if (!n || runningMax[n - 1] < d) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (runningMax[mid] >= d) hi = mid;
    else lo = mid + 1;
  }
  if (lo === 0) return track.t[0];
  const d0 = runningMax[lo - 1];
  const d1 = runningMax[lo];
  const u = d1 > d0 ? (d - d0) / (d1 - d0) : 1;
  return track.t[lo - 1] + (track.t[lo] - track.t[lo - 1]) * u;
}

export function runningMax(d: Float64Array): Float64Array {
  const out = new Float64Array(d.length);
  let m = -Infinity;
  for (let i = 0; i < d.length; i++) {
    if (d[i] > m) m = d[i];
    out[i] = m;
  }
  return out;
}
