import { useMemo, useRef } from 'react';
import { computeStandings, type StandingRow } from '../model/standings';
import type { SessionData } from '../model/types';
import { usePlayback, useThrottledTime } from './store';

export interface OvertakeEvent {
  id: number;
  by: number;
  on: number;
  pos: number;
  at: number; // wall clock ms
}

export interface StandingsView {
  rows: StandingRow[];
  t: number;
  flashes: Map<number, { dir: 1 | -1; until: number }>;
  overtakes: OvertakeEvent[];
}

let nextId = 1;

/** Latest classification (driver number → position), read by the map renderer. */
export const liveOrder = new Map<number, number>();

/** Live classification at ~8 Hz, plus overtake detection between frames. */
export function useStandings(data: SessionData): StandingsView {
  const t = useThrottledTime(120);
  const orderMode = usePlayback((s) => s.orderMode);
  const prevRef = useRef<{ t: number; rows: StandingRow[] } | null>(null);
  const flashes = useRef(new Map<number, { dir: 1 | -1; until: number }>());
  const overtakes = useRef<OvertakeEvent[]>([]);

  return useMemo(() => {
    const prev = prevRef.current;
    const rows = computeStandings(data, t, prev?.rows.map((r) => r.num) ?? [], orderMode);
    const now = performance.now();
    const continuous = prev && t > prev.t && t - prev.t < 20;
    if (prev && continuous && data.meta.kind === 'race') {
      const before = new Map(prev.rows.map((r) => [r.num, r]));
      for (const r of rows) {
        const old = before.get(r.num);
        if (!old || old.pos === r.pos) continue;
        flashes.current.set(r.num, { dir: r.pos < old.pos ? 1 : -1, until: now + 2600 });
      }
      // genuine on-track passes: both running, A moved ahead of B
      for (const a of rows) {
        const oldA = before.get(a.num);
        if (!oldA || a.pos >= oldA.pos || a.status !== 'run' || oldA.status !== 'run') continue;
        for (const b of rows) {
          if (b.num === a.num || b.status !== 'run') continue;
          const oldB = before.get(b.num);
          if (!oldB || oldB.status !== 'run') continue;
          if (oldB.pos < oldA.pos && b.pos > a.pos && Math.abs(a.d - b.d) < 0.05) {
            window.dispatchEvent(new CustomEvent('pitwall:overtake', { detail: a.num }));
            overtakes.current = [
              { id: nextId++, by: a.num, on: b.num, pos: a.pos, at: now },
              ...overtakes.current,
            ].slice(0, 4);
          }
        }
      }
    } else if (!continuous) {
      flashes.current.clear();
      overtakes.current = [];
    }
    for (const [k, f] of flashes.current) if (f.until < now) flashes.current.delete(k);
    overtakes.current = overtakes.current.filter((o) => now - o.at < 5000);
    prevRef.current = { t, rows };
    liveOrder.clear();
    for (const r of rows) liveOrder.set(r.num, r.pos);
    return { rows, t, flashes: flashes.current, overtakes: overtakes.current };
  }, [data, t, orderMode]);
}
