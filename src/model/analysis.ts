import { COMPOUND_COLORS } from './constants';
import { stintAt } from './standings';
import type { Lap, SessionData } from './types';
import { median } from './util';

export interface LapPoint {
  lap: number;
  time: number;
  compound: string;
  pitOut: boolean;
  pitIn: boolean;
}

export function lapSeries(data: SessionData, uptoT = Infinity): Map<number, LapPoint[]> {
  const out = new Map<number, LapPoint[]>();
  for (const d of data.drivers) {
    const laps = data.lapsByDriver.get(d.num) ?? [];
    const pitOutSet = new Set(laps.filter((l) => l.pitOut).map((l) => l.lap));
    const pts: LapPoint[] = [];
    for (const l of laps) {
      if (l.dur == null || l.end == null || l.end > uptoT) continue;
      const st = stintAt(data.stints, d.num, l.lap);
      pts.push({
        lap: l.lap,
        time: l.dur,
        compound: COMPOUND_COLORS[st?.compound ?? 'UNKNOWN'],
        pitOut: l.pitOut,
        pitIn: pitOutSet.has(l.lap + 1),
      });
    }
    out.set(d.num, pts);
  }
  return out;
}

/** Crossing time (end) of lap n, per driver. */
function crossings(data: SessionData): Map<number, Map<number, number>> {
  const m = new Map<number, Map<number, number>>();
  for (const [num, laps] of data.lapsByDriver) {
    const c = new Map<number, number>();
    for (const l of laps) if (l.end != null) c.set(l.lap, l.end);
    m.set(num, c);
  }
  return m;
}

/** Classic lap chart: position at the end of each lap. */
export function positionsByLap(data: SessionData, uptoT = Infinity): Map<number, [number, number][]> {
  const cross = crossings(data);
  const out = new Map<number, [number, number][]>();
  for (const d of data.drivers) out.set(d.num, []);
  const maxLap = Math.max(0, ...[...cross.values()].map((c) => Math.max(0, ...c.keys())));
  // lap 0 = grid
  for (const g of data.grid) out.get(g.driver)?.push([0, g.pos]);
  for (let lap = 1; lap <= maxLap; lap++) {
    const entries: [number, number][] = [];
    for (const [num, c] of cross) {
      const t = c.get(lap);
      if (t != null && t <= uptoT) entries.push([num, t]);
    }
    entries.sort((a, b) => a[1] - b[1]);
    entries.forEach(([num], i) => out.get(num)?.push([lap, i + 1]));
  }
  return out;
}

/** Gap to the leader (seconds) at the end of each lap. */
export function gapsByLap(data: SessionData, uptoT = Infinity): Map<number, [number, number][]> {
  const cross = crossings(data);
  const out = new Map<number, [number, number][]>();
  for (const d of data.drivers) out.set(d.num, []);
  const maxLap = Math.max(0, ...[...cross.values()].map((c) => Math.max(0, ...c.keys())));
  for (let lap = 1; lap <= maxLap; lap++) {
    let first = Infinity;
    for (const c of cross.values()) {
      const t = c.get(lap);
      if (t != null && t < first) first = t;
    }
    if (!Number.isFinite(first) || first > uptoT) continue;
    for (const [num, c] of cross) {
      const t = c.get(lap);
      if (t != null && t <= uptoT) out.get(num)?.push([lap, t - first]);
    }
  }
  return out;
}

/** Lap ranges of SC / VSC / red-flag periods, for chart shading. */
export function periodLaps(data: SessionData): { kind: string; from: number; to: number }[] {
  const winner = data.results.find((r) => r.pos === 1)?.driver ?? data.drivers[0]?.num;
  const laps = (data.lapsByDriver.get(winner) ?? []).filter((l) => l.start != null);
  const lapAt = (t: number) => {
    let n = 1;
    for (const l of laps) if (l.start! <= t) n = l.lap;
    return n;
  };
  return data.periods.map((p) => ({ kind: p.kind, from: lapAt(p.start), to: lapAt(p.end) + (p.kind === 'RED' ? 0 : 0.999) }));
}

export interface SectorRow {
  driver: number;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  best: number | null;
  ideal: number | null;
  topSpeed: number | null;
}

export function sectorTable(data: SessionData, uptoT = Infinity): { rows: SectorRow[]; best: [number, number, number, number] } {
  const rows: SectorRow[] = [];
  const min = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b));
  for (const d of data.drivers) {
    const laps = (data.lapsByDriver.get(d.num) ?? []).filter((l) => l.end != null && l.end <= uptoT);
    let s1: number | null = null;
    let s2: number | null = null;
    let s3: number | null = null;
    let best: number | null = null;
    let top: number | null = null;
    for (const l of laps) {
      if (!l.pitOut) {
        s1 = min(s1, l.s1);
        s2 = min(s2, l.s2);
        s3 = min(s3, l.s3);
        best = min(best, l.dur);
      }
      for (const v of [l.st, l.i1, l.i2]) if (v != null) top = Math.max(top ?? 0, v);
    }
    rows.push({ driver: d.num, s1, s2, s3, best, ideal: s1 != null && s2 != null && s3 != null ? s1 + s2 + s3 : null, topSpeed: top });
  }
  rows.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
  const bestOf = (k: keyof SectorRow) => Math.min(...rows.map((r) => (r[k] as number | null) ?? Infinity));
  return { rows, best: [bestOf('s1'), bestOf('s2'), bestOf('s3'), bestOf('best')] };
}

export function typicalLapTime(laps: Lap[]): number {
  const v = laps.filter((l) => l.dur != null && !l.pitOut && l.lap > 1).map((l) => l.dur!);
  return v.length ? median(v) : 90;
}

/** Fastest valid lap of a driver (optionally before t). */
export function fastestLap(data: SessionData, driver: number, uptoT = Infinity): Lap | undefined {
  let best: Lap | undefined;
  for (const l of data.lapsByDriver.get(driver) ?? []) {
    if (l.dur == null || l.start == null || l.end == null || l.end > uptoT || l.pitOut) continue;
    if (!best || l.dur < best.dur!) best = l;
  }
  return best;
}
