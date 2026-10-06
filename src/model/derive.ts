import { pointAtFraction } from './geometry';
import { bisectBy, distanceAt } from './interp';
import type { Period, SessionData, WeatherSample } from './types';

export type TrackStatus = 'green' | 'sc' | 'vsc' | 'red' | 'chequered' | 'pre';

export function activePeriod(data: SessionData, t: number): Period | undefined {
  return data.periods.find((p) => t >= p.start && t < p.end);
}

export function chequeredAt(data: SessionData): number | null {
  const m = data.raceControl.find((r) => r.flag === 'CHEQUERED');
  if (m) return m.t;
  if (data.finishAt.size) return Math.min(...data.finishAt.values());
  return null;
}

export function trackStatus(data: SessionData, t: number): TrackStatus {
  const chq = chequeredAt(data);
  if (data.meta.kind === 'race') {
    if (t < data.raceStart) return 'pre';
    if (chq != null && t >= chq) return 'chequered';
  } else if (chq != null && t >= chq) return 'chequered';
  const p = activePeriod(data, t);
  if (!p) return 'green';
  return p.kind === 'SC' ? 'sc' : p.kind === 'VSC' ? 'vsc' : 'red';
}

export const STATUS_LABEL: Record<TrackStatus, string> = {
  green: 'Pista libera',
  sc: 'Safety Car',
  vsc: 'Virtual Safety Car',
  red: 'Bandiera rossa',
  chequered: 'Bandiera a scacchi',
  pre: 'Griglia di partenza',
};

export const STATUS_COLOR: Record<TrackStatus, string> = {
  green: '#30d158',
  sc: '#ffd60a',
  vsc: '#ffd60a',
  red: '#ff453a',
  chequered: '#f5f5f7',
  pre: '#8e8e93',
};

export function weatherAt(data: SessionData, t: number): WeatherSample | undefined {
  const i = bisectBy(data.weather, t, (w) => w.t);
  return i >= 0 ? data.weather[i] : data.weather[0];
}

export function leaderNum(data: SessionData, t: number): number | undefined {
  let best: number | undefined;
  let bestD = -Infinity;
  for (const [num, tr] of data.tracks) {
    if (data.retiredAt.get(num) != null && t >= data.retiredAt.get(num)!) continue;
    const d = distanceAt(tr, t);
    if (d > bestD) {
      bestD = d;
      best = num;
    }
  }
  return best;
}

export interface SafetyCarState {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  phase: 'deploying' | 'on_track' | 'returning';
  kind: 'SC' | 'VSC';
}

/**
 * The Safety Car has no GPS feed, so (like the original project) it is
 * simulated a short distance ahead of the race leader.
 */
export function safetyCarAt(data: SessionData, t: number, leaderD: number): SafetyCarState | null {
  const p = data.periods.find((x) => x.kind === 'SC' && t >= x.start && t < x.end);
  if (!p) return null;
  const FADE = 4;
  let alpha = 1;
  let phase: SafetyCarState['phase'] = 'on_track';
  if (t - p.start < FADE) {
    alpha = (t - p.start) / FADE;
    phase = 'deploying';
  } else if (p.inLap != null && t >= p.inLap) {
    phase = 'returning';
    alpha = Math.max(0, Math.min(1, (p.end - t) / FADE));
  }
  const ahead = phase === 'returning' ? 0.06 * alpha + 0.01 : 0.075;
  const pt = pointAtFraction(data.ref, leaderD + ahead);
  return { ...pt, alpha, phase, kind: 'SC' };
}

/** Elapsed time in the session formatted like a TV clock. */
export function fmtClock(sec: number): string {
  const neg = sec < 0;
  const s = Math.abs(Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
  return neg ? `−${body}` : body;
}

export function localTimeOfDay(data: SessionData, t: number): string {
  const d = new Date(data.t0 + t * 1000 + data.meta.gmtOffsetMin * 60_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

/** Leader lap boundaries, used for timeline ticks & lap-synced charts. */
export function leaderLapStarts(data: SessionData): { lap: number; t: number }[] {
  const winner = data.results.find((r) => r.pos === 1)?.driver ?? data.drivers[0]?.num;
  const list = data.lapsByDriver.get(winner) ?? [];
  return list.filter((l) => l.start != null).map((l) => ({ lap: l.lap, t: l.start! }));
}

/** The current lap of the race leader (race) at time t. */
export function raceLapAt(data: SessionData, t: number): number {
  if (data.meta.kind !== 'race') return 0;
  const num = leaderNum(data, t);
  if (num == null) return 1;
  const d = distanceAt(data.tracks.get(num)!, t);
  return Math.max(1, Math.min(data.totalLaps || 999, Math.floor(d) + 1));
}
