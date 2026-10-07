import { activePeriod, chequeredAt } from './derive';
import type { RaceControlMsg, SessionData } from './types';

export type SectorFlagKind = 'YELLOW' | 'DOUBLE YELLOW';

export interface SectorFlag {
  sector: number;
  kind: SectorFlagKind;
  start: number;
  end: number;
}

/** A yellow without an explicit CLEAR is assumed to last at most this long. */
const MAX_YELLOW = 180;

/**
 * Turns race-control messages ("YELLOW IN TRACK SECTOR 9", "CLEAR IN TRACK
 * SECTOR 9", "DOUBLE YELLOW …", track-wide clears) into per-sector intervals.
 */
export function buildSectorFlags(rc: RaceControlMsg[], endT: number): SectorFlag[] {
  const open = new Map<number, SectorFlag>();
  const out: SectorFlag[] = [];
  const close = (sector: number, t: number) => {
    const f = open.get(sector);
    if (!f) return;
    f.end = Math.min(t, f.start + MAX_YELLOW);
    out.push(f);
    open.delete(sector);
  };
  for (const m of rc) {
    const flag = (m.flag ?? '').toUpperCase();
    const msg = m.message.toUpperCase();
    const scope = (m.scope ?? '').toUpperCase();
    if (scope === 'SECTOR' && m.sector != null) {
      if (flag === 'YELLOW' || flag === 'DOUBLE YELLOW') {
        const prev = open.get(m.sector);
        if (prev && prev.kind === flag) continue;
        if (prev) close(m.sector, m.t);
        open.set(m.sector, { sector: m.sector, kind: flag as SectorFlagKind, start: m.t, end: endT });
      } else if (flag === 'CLEAR' || flag === 'GREEN') {
        close(m.sector, m.t);
      }
    } else if (scope === 'TRACK' && (flag === 'CLEAR' || flag === 'GREEN' || flag === 'RED' || msg.includes('TRACK CLEAR'))) {
      for (const s of [...open.keys()]) close(s, m.t);
    }
  }
  for (const s of [...open.keys()]) close(s, endT);
  return out.sort((a, b) => a.start - b.start);
}

const flagCache = new WeakMap<SessionData, SectorFlag[]>();
export function sectorFlags(data: SessionData): SectorFlag[] {
  let f = flagCache.get(data);
  if (!f) {
    f = buildSectorFlags(data.raceControl, data.endT);
    flagCache.set(data, f);
  }
  return f;
}

export function sectorFlagsAt(data: SessionData, t: number): SectorFlag[] {
  return sectorFlags(data).filter((f) => t >= f.start && t < f.end);
}

/** Lap-fraction range [from, to) of a marshal sector (to may exceed 1 when it wraps). */
export function marshalRange(data: SessionData, sector: number): [number, number] | null {
  const list = data.ref.marshal;
  const i = list.findIndex((m) => m.num === sector);
  if (i < 0) return null;
  const from = list[i].from;
  let to = i + 1 < list.length ? list[i + 1].from : list[0].from + 1;
  if (to <= from) to += 1;
  return [from, to];
}

/** Nearest named corner to a lap fraction, for human-readable flag locations. */
export function nearestCorner(data: SessionData, frac: number): { num: string; name?: string } | null {
  let best: { num: string; name?: string } | null = null;
  let bestD = Infinity;
  const L = data.ref.length;
  for (const c of data.ref.corners) {
    // corners carry world positions; compare by the closest reference vertex
    let k = 0;
    let kd = Infinity;
    for (let i = 0; i < data.ref.x.length; i += 2) {
      const d = (data.ref.x[i] - c.x) ** 2 + (data.ref.y[i] - c.y) ** 2;
      if (d < kd) {
        kd = d;
        k = i;
      }
    }
    const cf = data.ref.s[k] / L;
    let d = Math.abs(cf - frac);
    d = Math.min(d, 1 - d);
    if (d < bestD) {
      bestD = d;
      best = { num: c.num, name: c.name };
    }
  }
  return bestD < 0.05 ? best : null;
}

export type TrackFlag = 'green' | 'yellow' | 'double-yellow' | 'red' | 'sc' | 'vsc' | 'chequered' | 'none';

export interface FlagState {
  flag: TrackFlag;
  sectors: SectorFlag[];
}

/** What a marshal would be waving right now: most serious condition first. */
export function flagStateAt(data: SessionData, t: number): FlagState {
  const sectors = sectorFlagsAt(data, t);
  const chq = chequeredAt(data);
  if (chq != null && t >= chq) return { flag: 'chequered', sectors };
  if (data.meta.kind === 'race' && t < data.raceStart) return { flag: 'none', sectors };
  const p = activePeriod(data, t);
  if (p?.kind === 'RED') return { flag: 'red', sectors };
  if (p?.kind === 'SC') return { flag: 'sc', sectors };
  if (p?.kind === 'VSC') return { flag: 'vsc', sectors };
  if (sectors.some((s) => s.kind === 'DOUBLE YELLOW')) return { flag: 'double-yellow', sectors };
  if (sectors.length) return { flag: 'yellow', sectors };
  return { flag: 'green', sectors };
}
