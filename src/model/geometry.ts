import type { ReferencePath } from './types';

/** Resample a closed polyline into `n` points evenly spaced by arc length. */
export function resampleClosed(xs: ArrayLike<number>, ys: ArrayLike<number>, n: number) {
  const m = xs.length;
  const cum = new Float64Array(m + 1);
  for (let i = 1; i <= m; i++) {
    const a = i - 1;
    const b = i % m;
    cum[i] = cum[i - 1] + Math.hypot(xs[b] - xs[a], ys[b] - ys[a]);
  }
  const total = cum[m];
  const ox = new Float32Array(n);
  const oy = new Float32Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (j < m - 1 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = (target - cum[j]) / seg;
    const b = (j + 1) % m;
    ox[k] = xs[j] + (xs[b] - xs[j]) * f;
    oy[k] = ys[j] + (ys[b] - ys[j]) * f;
  }
  return { x: ox, y: oy, length: total };
}

/** Circular moving-average smoothing of a closed polyline. */
export function smoothClosed(xs: Float32Array, ys: Float32Array, radius: number) {
  const n = xs.length;
  const ox = new Float32Array(n);
  const oy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = (i + k + n) % n;
      sx += xs[j];
      sy += ys[j];
    }
    ox[i] = sx / (2 * radius + 1);
    oy[i] = sy / (2 * radius + 1);
  }
  return { x: ox, y: oy };
}

export function cumulative(xs: Float32Array, ys: Float32Array): { s: Float32Array; length: number } {
  const n = xs.length;
  const s = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  const length = s[n - 1] + Math.hypot(xs[0] - xs[n - 1], ys[0] - ys[n - 1]);
  return { s, length };
}

export function buildReference(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  opts: { rotation?: number; n?: number } = {},
): ReferencePath {
  const n = opts.n ?? 900;
  const r = resampleClosed(xs, ys, n);
  const sm = smoothClosed(r.x, r.y, 2);
  const { s, length } = cumulative(sm.x, sm.y);
  return {
    x: sm.x,
    y: sm.y,
    s,
    length,
    rotation: opts.rotation ?? bestFitRotation(sm.x, sm.y),
    corners: [],
    drs: [],
    sectors: null,
    unitsPerMeter: 10,
    lengthM: length / 10,
    speed: null,
    pitLane: null,
    grid: [],
    z: null,
    marshal: [],
    marshalEstimated: true,
  };
}

/**
 * Rotation (degrees) that lays the circuit's longest axis horizontally —
 * used when the official circuit rotation is unavailable.
 */
export function principalRotation(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return (-angle * 180) / Math.PI;
}

/**
 * Rotation (degrees) that lets the circuit fill a landscape viewport best,
 * used when the official TV orientation is unavailable.
 */
export function bestFitRotation(xs: ArrayLike<number>, ys: ArrayLike<number>, aspect = 1.45): number {
  let best = 0;
  let bestScale = -Infinity;
  for (let deg = 0; deg < 180; deg += 2) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < xs.length; i += 3) {
      const x = xs[i] * c - ys[i] * s;
      const y = xs[i] * s + ys[i] * c;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const scale = Math.min(aspect / (maxX - minX), 1 / (maxY - minY));
    if (scale > bestScale + 1e-12) {
      bestScale = scale;
      best = deg;
    }
  }
  return best;
}

/** Closest vertex search. `hint` enables a fast local search. */
export function nearestIndex(ref: ReferencePath, x: number, y: number, hint = -1, window = 40): number {
  const n = ref.x.length;
  let best = -1;
  let bestD = Infinity;
  if (hint >= 0) {
    for (let k = -window; k <= window; k++) {
      const i = (hint + k + n) % n;
      const d = (ref.x[i] - x) ** 2 + (ref.y[i] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Accept the local answer unless it sits on the edge of the window,
    // which means the true minimum may lie outside it.
    const edge = Math.min((best - hint + n) % n, (hint - best + n) % n);
    if (edge < window - 2) return best;
  }
  for (let i = 0; i < n; i++) {
    const d = (ref.x[i] - x) ** 2 + (ref.y[i] - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Arc length (0..length) of the projection of (x, y) onto the reference. */
export function projectS(ref: ReferencePath, x: number, y: number, hint = -1): { s: number; idx: number } {
  const n = ref.x.length;
  const i = nearestIndex(ref, x, y, hint);
  // refine against the two adjacent segments
  let bestS = ref.s[i];
  let bestD = Infinity;
  for (const j of [(i - 1 + n) % n, i]) {
    const k = (j + 1) % n;
    const ax = ref.x[j];
    const ay = ref.y[j];
    const bx = ref.x[k] - ax;
    const by = ref.y[k] - ay;
    const len2 = bx * bx + by * by || 1;
    let f = ((x - ax) * bx + (y - ay) * by) / len2;
    f = Math.max(0, Math.min(1, f));
    const px = ax + bx * f;
    const py = ay + by * f;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bestD) {
      bestD = d;
      const segLen = k === 0 ? ref.length - ref.s[j] : ref.s[k] - ref.s[j];
      bestS = ref.s[j] + segLen * f;
    }
  }
  return { s: bestS % ref.length, idx: i };
}

/** Point on the reference at a lap fraction (any real number, wraps). */
export function pointAtFraction(ref: ReferencePath, frac: number): { x: number; y: number; angle: number } {
  const n = ref.x.length;
  let f = frac % 1;
  if (f < 0) f += 1;
  const target = f * ref.length;
  // binary search on cumulative s
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ref.s[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  const j = lo;
  const k = (j + 1) % n;
  const segLen = (k === 0 ? ref.length - ref.s[j] : ref.s[k] - ref.s[j]) || 1;
  const t = (target - ref.s[j]) / segLen;
  return {
    x: ref.x[j] + (ref.x[k] - ref.x[j]) * t,
    y: ref.y[j] + (ref.y[k] - ref.y[j]) * t,
    angle: Math.atan2(ref.y[k] - ref.y[j], ref.x[k] - ref.x[j]),
  };
}

/** Bounding box of the reference after rotation. */
export function rotatedBounds(ref: ReferencePath, rotationDeg: number) {
  const a = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ref.x.length; i++) {
    const x = ref.x[i] * c - ref.y[i] * s;
    const y = ref.x[i] * s + ref.y[i] * c;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
