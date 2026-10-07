import type { RawCarData } from '../api/types';
import { pointAtFraction, projectS } from './geometry';
import { bisect, carAt } from './interp';
import type { DriverTrack, Lap, PitStop, ReferencePath } from './types';
import { parseDate } from './util';

/**
 * Speed map, DRS zones, sector boundaries and an integrated lap length from
 * the reference lap's car telemetry.
 */
export function analyseReferenceLap(
  ref: ReferencePath,
  refLap: Lap,
  refTrack: DriverTrack,
  carData: RawCarData[],
  t0: number,
): { lengthM: number | null } {
  const L = ref.length;
  const n = ref.x.length;
  const fracAt = (t: number) => {
    const p = carAt(refTrack, t);
    if (!p) return null;
    return projectS(ref, p.x, p.y).s / L;
  };
  if (refLap.s1 && refLap.s2 && refLap.start != null) {
    const f1 = fracAt(refLap.start + refLap.s1);
    const f2 = fracAt(refLap.start + refLap.s1 + refLap.s2);
    if (f1 != null && f2 != null && f1 < f2) ref.sectors = [f1, f2];
  }
  const samples = carData
    .map((c) => ({ t: (parseDate(c.date) - t0) / 1000, open: c.drs >= 10, v: c.speed }))
    .filter((c) => Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t);
  if (!samples.length) return { lengthM: null };

  // DRS: contiguous runs of an open flap
  const zones: [number, number][] = [];
  let runStart: number | null = null;
  let last = 0;
  const close = (end: number) => {
    if (runStart != null && end - runStart > 1.5) {
      const a = fracAt(runStart);
      const b = fracAt(end);
      if (a != null && b != null) zones.push([a, b]);
    }
    runStart = null;
  };
  for (const s of samples) {
    if (s.open && runStart == null) runStart = s.t;
    if (!s.open && runStart != null) close(last);
    last = s.t;
  }
  close(last);
  ref.drs = zones;

  // speed map: average speed per vertex bin, gaps filled by interpolation
  const sum = new Float64Array(n);
  const cnt = new Uint16Array(n);
  let dist = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (i > 0) dist += ((s.v + samples[i - 1].v) / 2 / 3.6) * (s.t - samples[i - 1].t);
    const f = fracAt(s.t);
    if (f == null) continue;
    const k = Math.min(n - 1, Math.max(0, Math.floor(f * n)));
    sum[k] += s.v;
    cnt[k]++;
  }
  const speed = new Float32Array(n);
  const known: number[] = [];
  for (let k = 0; k < n; k++) if (cnt[k]) known.push(k);
  if (known.length > n / 20) {
    for (let j = 0; j < known.length; j++) {
      const a = known[j];
      const b = known[(j + 1) % known.length];
      const va = sum[a] / cnt[a];
      const vb = sum[b] / cnt[b];
      const span = (b - a + n) % n || n;
      for (let d = 0; d < span; d++) speed[(a + d) % n] = va + ((vb - va) * d) / span;
    }
    // light smoothing
    const sm = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      let acc = 0;
      for (let d = -3; d <= 3; d++) acc += speed[(k + d + n) % n];
      sm[k] = acc / 7;
    }
    ref.speed = sm;
  }
  const lapT = refLap.dur ?? 0;
  const lengthM = dist > 1000 && lapT > 0 ? dist * (lapT / (samples[samples.length - 1].t - samples[0].t || lapT)) : null;
  return { lengthM };
}

/** Trace the pit lane from a car's positions around one of its stops. */
export function tracePitLane(ref: ReferencePath, tracks: Map<number, DriverTrack>, pits: PitStop[]): ReferencePath['pitLane'] {
  const minOff = 6 * ref.unitsPerMeter;
  const candidates = pits.filter((p) => (p.lane ?? 0) > 12 && (p.lane ?? 99) < 45).slice(0, 12);
  for (const p of candidates) {
    const tr = tracks.get(p.driver);
    if (!tr) continue;
    const i0 = Math.max(0, bisect(tr.t, p.t - 50));
    const i1 = Math.min(tr.t.length - 1, bisect(tr.t, p.t + (p.lane ?? 25) + 50));
    const off: boolean[] = [];
    for (let i = i0; i <= i1; i++) {
      const pr = projectS(ref, tr.x[i], tr.y[i]);
      const q = pointAtFraction(ref, pr.s / ref.length);
      off.push(Math.hypot(q.x - tr.x[i], q.y - tr.y[i]) > minOff);
    }
    // longest contiguous off-track run
    let best: [number, number] | null = null;
    let st = -1;
    for (let k = 0; k <= off.length; k++) {
      if (k < off.length && off[k]) {
        if (st < 0) st = k;
      } else if (st >= 0) {
        if (!best || k - st > best[1] - best[0]) best = [st, k - 1];
        st = -1;
      }
    }
    if (!best || best[1] - best[0] < 12) continue;
    const a = Math.max(i0, i0 + best[0] - 3);
    const b = Math.min(i1, i0 + best[1] + 3);
    let gap = 0;
    for (let i = a + 1; i <= b; i++) gap = Math.max(gap, tr.t[i] - tr.t[i - 1]);
    if (gap > 4) continue;
    return { x: tr.x.slice(a, b + 1), y: tr.y.slice(a, b + 1) };
  }
  return null;
}

/** Grid boxes: where each car sat just before lights out. */
export function gridSlots(
  ref: ReferencePath,
  tracks: Map<number, DriverTrack>,
  grid: { driver: number; pos: number }[],
  raceStart: number,
): ReferencePath['grid'] {
  const out: ReferencePath['grid'] = [];
  for (const g of grid) {
    const tr = tracks.get(g.driver);
    if (!tr) continue;
    const a = carAt(tr, raceStart - 2);
    const b = carAt(tr, raceStart - 0.5);
    if (!a || !b || !a.live) continue;
    // must be stationary
    if (Math.hypot(a.x - b.x, a.y - b.y) > 3 * ref.unitsPerMeter) continue;
    const pr = projectS(ref, a.x, a.y);
    const dir = pointAtFraction(ref, pr.s / ref.length);
    out.push({ pos: g.pos, x: a.x, y: a.y, angle: dir.angle });
  }
  return out;
}
