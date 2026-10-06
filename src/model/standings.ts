import { distanceAt, runningMax, timeAtDistance, valueAt } from './interp';
import type { Compound, DriverTrack, SessionData, Stint } from './types';

export type RowStatus = 'run' | 'pit' | 'out' | 'fin' | 'grid';

export interface StandingRow {
  num: number;
  pos: number;
  status: RowStatus;
  /** race distance in laps */
  d: number;
  lap: number;
  gap: string;
  interval: string;
  compound: Compound;
  tyreAge: number;
  pits: number;
  /** positions gained (+) / lost (−) vs. grid */
  delta: number;
  /** quali / practice */
  best: number | null;
  lastLap: number | null;
}

export type OrderMode = 'live' | 'official';

const maxCache = new WeakMap<DriverTrack, Float64Array>();
function maxOf(tr: DriverTrack) {
  let m = maxCache.get(tr);
  if (!m) {
    m = runningMax(tr.d);
    maxCache.set(tr, m);
  }
  return m;
}

export function stintAt(stints: Stint[], driver: number, lap: number): Stint | undefined {
  let best: Stint | undefined;
  for (const s of stints) {
    if (s.driver !== driver) continue;
    if (s.lapStart <= lap) best = s;
  }
  return best;
}

export function fmtGapSeconds(s: number): string {
  if (!Number.isFinite(s)) return '';
  if (s < 60) return `+${s.toFixed(s < 10 ? 3 : 1)}`;
  const m = Math.floor(s / 60);
  return `+${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

export function fmtLapTime(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m ? `${m}:${rest.toFixed(3).padStart(6, '0')}` : rest.toFixed(3);
}

const EPS = 0.0009; // ≈ 4–5 m: closer than this keeps the previous order (no flicker)

export function currentLapOf(data: SessionData, d: number): number {
  return Math.max(1, Math.min(data.totalLaps || Infinity, Math.floor(d + 1e-6) + 1));
}

export function computeStandings(
  data: SessionData,
  t: number,
  prev: number[] = [],
  mode: OrderMode = 'live',
): StandingRow[] {
  return data.meta.kind === 'race' ? raceStandings(data, t, prev, mode) : timedStandings(data, t, prev);
}

function inPit(data: SessionData, num: number, t: number): boolean {
  for (const p of data.pits) {
    if (p.driver !== num) continue;
    if (p.t > t) break;
    if (t <= p.t + (p.lane ?? 25)) return true;
  }
  return false;
}

function pitsDone(data: SessionData, num: number, t: number): number {
  let n = 0;
  for (const p of data.pits) if (p.driver === num && p.t <= t) n++;
  return n;
}

function raceStandings(data: SessionData, t: number, prev: number[], mode: OrderMode): StandingRow[] {
  const prevRank = new Map(prev.map((n, i) => [n, i]));
  const gridPos = new Map(data.grid.map((g) => [g.driver, g.pos]));
  const resultPos = new Map(data.results.map((r) => [r.driver, r.pos ?? 99]));
  const beforeStart = t < data.raceStart;

  interface Tmp {
    num: number;
    key: number;
    d: number;
    status: RowStatus;
  }
  const tmp: Tmp[] = [];
  for (const drv of data.drivers) {
    const tr = data.tracks.get(drv.num);
    const d = tr ? distanceAt(tr, t) : 0;
    const fin = data.finishAt.get(drv.num);
    const ret = data.retiredAt.get(drv.num);
    let status: RowStatus = 'run';
    let key: number;
    if (beforeStart) {
      status = 'grid';
      key = -(gridPos.get(drv.num) ?? 50);
    } else if (ret != null && t >= ret) {
      status = 'out';
      key = -1000 + d;
    } else if (fin != null && t >= fin) {
      status = 'fin';
      key = (data.finalLaps.get(drv.num) ?? d) + 0.0009 * (1 - (resultPos.get(drv.num) ?? 99) / 100);
    } else {
      const cap = data.finalLaps.get(drv.num);
      key = cap ? Math.min(d, cap) : d;
      if (inPit(data, drv.num, t)) status = 'pit';
    }
    if (!tr && status === 'run') {
      key = -500;
    }
    tmp.push({ num: drv.num, key, d, status });
  }

  if (mode === 'official' && !beforeStart) {
    for (const r of tmp) {
      if (r.status === 'out') continue;
      const p = valueAt(data.positions.get(r.num), t);
      if (p != null) r.key = 1000 - p;
    }
  }

  tmp.sort((a, b) => {
    const diff = b.key - a.key;
    if (Math.abs(diff) < EPS && mode === 'live') {
      const ra = prevRank.get(a.num);
      const rb = prevRank.get(b.num);
      if (ra != null && rb != null) return ra - rb;
    }
    return diff;
  });

  const leader = tmp[0];
  const leaderTrack = data.tracks.get(leader?.num);
  const winnerFinish = Math.min(...[...data.finishAt.values()]);
  const rows: StandingRow[] = [];
  for (let i = 0; i < tmp.length; i++) {
    const r = tmp[i];
    const lap = currentLapOf(data, r.d);
    const stint = stintAt(data.stints, r.num, lap);
    const row: StandingRow = {
      num: r.num,
      pos: i + 1,
      status: r.status,
      d: r.d,
      lap,
      gap: '',
      interval: '',
      compound: stint?.compound ?? 'UNKNOWN',
      tyreAge: stint ? stint.ageStart + Math.max(0, lap - stint.lapStart) : 0,
      pits: pitsDone(data, r.num, t),
      delta: beforeStart ? 0 : (gridPos.get(r.num) ?? i + 1) - (i + 1),
      best: null,
      lastLap: null,
    };
    if (r.status === 'out') {
      row.gap = 'RIT';
      row.interval = 'RIT';
    } else if (r.status === 'grid') {
      row.gap = '';
    } else if (i === 0) {
      row.gap = r.status === 'fin' ? 'Bandiera' : `Giro ${lap}`;
      row.interval = 'Leader';
    } else if (r.status === 'fin' && data.finishAt.has(r.num)) {
      const lapsDown = (data.finalLaps.get(leader.num) ?? 0) - (data.finalLaps.get(r.num) ?? 0);
      row.gap = lapsDown > 0 ? `+${lapsDown} ${lapsDown === 1 ? 'giro' : 'giri'}` : fmtGapSeconds(data.finishAt.get(r.num)! - winnerFinish);
      row.interval = row.gap;
    } else {
      row.gap = gapBetween(data, leaderTrack, r, t);
      const ahead = tmp[i - 1];
      row.interval = gapBetween(data, data.tracks.get(ahead.num), r, t);
    }
    rows.push(row);
  }
  return rows;
}

function gapBetween(
  data: SessionData,
  aheadTrack: DriverTrack | undefined,
  r: { num: number; d: number },
  t: number,
): string {
  if (!aheadTrack) return '';
  const aheadD = distanceAt(aheadTrack, t);
  const lapsDown = Math.floor(aheadD - r.d);
  if (lapsDown >= 1) return `+${lapsDown} ${lapsDown === 1 ? 'giro' : 'giri'}`;
  const ta = timeAtDistance(aheadTrack, r.d, maxOf(aheadTrack));
  if (ta == null) return '';
  const g = t - ta;
  if (g > data.typicalLap * 1.5) return '';
  if (g < 0) return '+0.000'; // side by side: hysteresis kept the previous order
  return fmtGapSeconds(g);
}

function timedStandings(data: SessionData, t: number, prev: number[]): StandingRow[] {
  const prevRank = new Map(prev.map((n, i) => [n, i]));
  const rows = data.drivers.map((drv) => {
    const list = data.lapsByDriver.get(drv.num) ?? [];
    let best: number | null = null;
    let lastLap: number | null = null;
    let lapNow = 0;
    for (const l of list) {
      if (l.start != null && l.start <= t) lapNow = l.lap;
      if (l.end == null || l.end > t || l.dur == null) continue;
      lastLap = l.dur;
      if (!l.pitOut && (best == null || l.dur < best)) best = l.dur;
    }
    const tr = data.tracks.get(drv.num);
    let status: RowStatus = 'pit';
    if (tr) {
      const n = tr.t.length;
      // moving if position changes in the last few seconds
      const d1 = distanceAt(tr, t);
      const d0 = distanceAt(tr, t - 4);
      if (n && t >= tr.t[0] && t <= tr.t[n - 1] + 3 && Math.abs(d1 - d0) > 0.005) status = 'run';
      if (inPit(data, drv.num, t)) status = 'pit';
    }
    const stint = stintAt(data.stints, drv.num, Math.max(1, lapNow));
    return {
      num: drv.num,
      pos: 0,
      status,
      d: tr ? distanceAt(tr, t) : 0,
      lap: lapNow,
      gap: '',
      interval: '',
      compound: stint?.compound ?? 'UNKNOWN',
      tyreAge: stint ? stint.ageStart + Math.max(0, lapNow - stint.lapStart) : 0,
      pits: 0,
      delta: 0,
      best,
      lastLap,
    } satisfies StandingRow;
  });
  rows.sort((a, b) => {
    if (a.best != null && b.best != null) return a.best - b.best;
    if (a.best != null) return -1;
    if (b.best != null) return 1;
    return (prevRank.get(a.num) ?? a.num) - (prevRank.get(b.num) ?? b.num);
  });
  const top = rows[0]?.best ?? null;
  rows.forEach((r, i) => {
    r.pos = i + 1;
    if (r.best == null) r.gap = 'Nessun tempo';
    else if (i === 0 || top == null) r.gap = fmtLapTime(r.best);
    else r.gap = `+${(r.best - top).toFixed(3)}`;
    r.interval = r.best != null ? fmtLapTime(r.best) : '';
  });
  return rows;
}
