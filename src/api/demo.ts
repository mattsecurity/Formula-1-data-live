// Offline demo: a fully simulated race weekend that answers queries in the
// same shape as OpenF1, so every screen can be explored without network.

import type { DataSource, GetOptions } from './openf1';
import type { Filter, RawCircuitInfo, RawDriver } from './types';
import { circuitById } from '../data/circuits';
import { OpenF1Source } from './openf1';

const DEMO_YEAR = 2025;
export const DEMO_MEETING_KEY = 990001;
export const DEMO_RACE_KEY = 990011;
export const DEMO_QUALI_KEY = 990012;

const RACE_START = Date.UTC(2025, 5, 15, 13, 0, 0);
const QUALI_START = Date.UTC(2025, 5, 14, 14, 0, 0);
const RACE_LAPS = 18;

const DRIVERS: [number, string, string, string, string, string, string][] = [
  [1, 'VER', 'Max', 'Verstappen', 'Red Bull Racing', '3671C6', 'NED'],
  [22, 'TSU', 'Yuki', 'Tsunoda', 'Red Bull Racing', '3671C6', 'JPN'],
  [4, 'NOR', 'Lando', 'Norris', 'McLaren', 'FF8000', 'GBR'],
  [81, 'PIA', 'Oscar', 'Piastri', 'McLaren', 'FF8000', 'AUS'],
  [16, 'LEC', 'Charles', 'Leclerc', 'Ferrari', 'E8002D', 'MON'],
  [44, 'HAM', 'Lewis', 'Hamilton', 'Ferrari', 'E8002D', 'GBR'],
  [63, 'RUS', 'George', 'Russell', 'Mercedes', '27F4D2', 'GBR'],
  [12, 'ANT', 'Kimi', 'Antonelli', 'Mercedes', '27F4D2', 'ITA'],
  [14, 'ALO', 'Fernando', 'Alonso', 'Aston Martin', '229971', 'ESP'],
  [18, 'STR', 'Lance', 'Stroll', 'Aston Martin', '229971', 'CAN'],
  [10, 'GAS', 'Pierre', 'Gasly', 'Alpine', '0093CC', 'FRA'],
  [43, 'COL', 'Franco', 'Colapinto', 'Alpine', '0093CC', 'ARG'],
  [23, 'ALB', 'Alexander', 'Albon', 'Williams', '64C4FF', 'THA'],
  [55, 'SAI', 'Carlos', 'Sainz', 'Williams', '64C4FF', 'ESP'],
  [6, 'HAD', 'Isack', 'Hadjar', 'Racing Bulls', '6692FF', 'FRA'],
  [30, 'LAW', 'Liam', 'Lawson', 'Racing Bulls', '6692FF', 'NZL'],
  [27, 'HUL', 'Nico', 'Hulkenberg', 'Kick Sauber', '52E252', 'GER'],
  [5, 'BOR', 'Gabriel', 'Bortoleto', 'Kick Sauber', '52E252', 'BRA'],
  [31, 'OCO', 'Esteban', 'Ocon', 'Haas F1 Team', 'B6BABD', 'FRA'],
  [87, 'BEA', 'Oliver', 'Bearman', 'Haas F1 Team', 'B6BABD', 'GBR'],
];

// Deterministic PRNG so the demo is identical on every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------- circuit
// The demo runs on the real Autodromo Nazionale Monza layout.
const MONZA = circuitById('it-1922')!;
const MONZA_PTS: [number, number][] = [];
for (let i = 0; i < MONZA.pts.length; i += 2) MONZA_PTS.push([MONZA.pts[i], MONZA.pts[i + 1]]);
// official turn numbers at outline indices of the dataset
const MONZA_CORNERS: [string, number][] = [
  ['1', 5], ['2', 9], ['3', 22], ['4', 34], ['5', 36], ['6', 51], ['7', 58], ['8', 76], ['9', 81], ['10', 88], ['11', 105],
];

function catmullClosed(pts: [number, number][], perSeg: number) {
  const out: [number, number][] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const u = k / perSeg;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

interface Circuit {
  x: Float64Array;
  y: Float64Array;
  nx: Float64Array;
  ny: Float64Array;
  v: Float64Array;
  ds: number;
  L: number;
  n: number;
  drs: [number, number][];
}

function buildCircuit(): Circuit {
  const raw = catmullClosed(MONZA_PTS, 12);
  // resample every ~4 m
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i % raw.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const L = cum[cum.length - 1];
  const scale = 1;
  const n = Math.round(L / 4);
  const ds = L / n;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k * ds) / scale;
    while (j < raw.length - 1 && cum[j + 1] < target) j++;
    const a = raw[j];
    const b = raw[(j + 1) % raw.length];
    const f = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    x[k] = (a[0] + (b[0] - a[0]) * f) * scale;
    y[k] = (a[1] + (b[1] - a[1]) * f) * scale;
  }
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  const vLat = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n;
    const c = (i + 3) % n;
    const dx = x[c] - x[a];
    const dy = y[c] - y[a];
    const len = Math.hypot(dx, dy) || 1;
    nx[i] = -dy / len;
    ny[i] = dx / len;
    // curvature from a wider stencil for stability
    const p = (i - 8 + n) % n;
    const q = (i + 8) % n;
    const ax = x[i] - x[p];
    const ay = y[i] - y[p];
    const bx = x[q] - x[i];
    const by = y[q] - y[i];
    const cross = Math.abs(ax * by - ay * bx);
    const k = (2 * cross) / ((Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(x[q] - x[p], y[q] - y[p])) || 1);
    vLat[i] = Math.min(95, Math.sqrt(52 / Math.max(k, 1e-5)));
  }
  // forward/backward passes for traction & braking limits
  const v = Float64Array.from(vLat);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < n * 2; i++) {
      const a = (i - 1) % n;
      const b = i % n;
      const acc = 16 * Math.max(0.15, 1 - v[a] / 102);
      v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * acc * ds));
    }
    for (let i = n * 2; i > 0; i--) {
      const a = i % n;
      const b = (i - 1) % n;
      v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * 48 * ds));
    }
  }
  // DRS on the two longest flat-out stretches
  const runs: [number, number][] = [];
  let st = -1;
  for (let i = 0; i < n; i++) {
    const fast = v[i] > 80;
    if (fast && st < 0) st = i;
    if (!fast && st >= 0) {
      runs.push([st, i]);
      st = -1;
    }
  }
  if (st >= 0) runs.push([st, n - 1]);
  const drs = runs
    .filter((r) => r[1] - r[0] > 60)
    .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
    .slice(0, 2)
    .map(([a, b]) => [(a + 25) / n, Math.min(b, a + 25 + Math.round(n * 0.11)) / n] as [number, number]);
  return { x, y, nx, ny, v, ds, L, n, drs };
}

// ----------------------------------------------------------------- simulation
type Row = Record<string, unknown>;

interface DemoDb {
  race: Record<string, Row[]>;
  quali: Record<string, Row[]>;
}

const isoAt = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

function sampleCircuit(c: Circuit, s: number) {
  const pos = (((s % c.L) + c.L) % c.L) / c.ds;
  const i = Math.floor(pos) % c.n;
  const k = (i + 1) % c.n;
  const f = pos - Math.floor(pos);
  return {
    x: c.x[i] + (c.x[k] - c.x[i]) * f,
    y: c.y[i] + (c.y[k] - c.y[i]) * f,
    nx: c.nx[i],
    ny: c.ny[i],
    v: c.v[i] + (c.v[k] - c.v[i]) * f,
  };
}

function inDrs(c: Circuit, s: number) {
  const f = (((s % c.L) + c.L) % c.L) / c.L;
  return c.drs.some(([a, b]) => f >= a && f <= b);
}

/** Plausible mini-sector colours (yellow / green / purple, pit on out laps). */
function demoSegments(rand: () => number, pitOut: boolean) {
  const seg = (n: number, first: boolean) =>
    Array.from({ length: n }, (_, i) => {
      if (pitOut && first && i < 3) return 2064;
      const r = rand();
      return r < 0.06 ? 2051 : r < 0.36 ? 2049 : 2048;
    });
  return { segments_sector_1: seg(8, true), segments_sector_2: seg(9, false), segments_sector_3: seg(8, false) };
}

function gearFor(kmh: number) {
  const edges = [0, 85, 125, 160, 195, 230, 265, 295];
  let g = 1;
  for (let i = 0; i < edges.length; i++) if (kmh >= edges[i]) g = i + 1;
  return Math.min(8, g);
}

interface CarSim {
  num: number;
  code: string;
  pace: number;
  s: number;
  v: number;
  lap: number;
  sectorMark: number;
  lapStartT: number;
  sectorT: number[];
  pitLaps: number[];
  compounds: string[];
  stint: number;
  stintStartLap: number;
  inPit: boolean;
  pitEnterT: number;
  stopUntil: number;
  stopped: boolean;
  retireAt: number | null;
  retired: boolean;
  finished: boolean;
  finishT: number;
  offset: number;
  lastSpeed: number;
}

function simulateRace(c: Circuit): Record<string, Row[]> {
  const rand = rng(42);
  const dt = 0.05;
  const sampleEvery = 0.27;
  const out: Record<string, Row[]> = {
    location: [], car_data: [], laps: [], stints: [], pit: [], race_control: [], weather: [],
    position: [], intervals: [], session_result: [], overtakes: [], team_radio: [],
  };
  const base = { meeting_key: DEMO_MEETING_KEY, session_key: DEMO_RACE_KEY };
  const order = [...DRIVERS].sort(() => rand() - 0.5);
  // Fast cars near the front, with some shuffling for interest.
  const paceBy = new Map<number, number>();
  DRIVERS.forEach(([n], i) => paceBy.set(n, 1 + i * 0.0021 + rand() * 0.006));
  order.sort((a, b) => paceBy.get(a[0])! - paceBy.get(b[0])! + (rand() - 0.5) * 0.008);
  const strategies = [
    { laps: [7], comp: ['MEDIUM', 'HARD'] },
    { laps: [6], comp: ['SOFT', 'HARD'] },
    { laps: [9], comp: ['HARD', 'MEDIUM'] },
    { laps: [5, 12], comp: ['SOFT', 'MEDIUM', 'SOFT'] },
  ];
  const cars: CarSim[] = order.map(([num, code], g) => {
    const strat = strategies[Math.floor(rand() * strategies.length)];
    return {
      num, code, pace: paceBy.get(num)!, s: -g * 8 - 6, v: 0, lap: 0, sectorMark: 0, lapStartT: 0, sectorT: [],
      pitLaps: strat.laps.map((l) => l + Math.floor(rand() * 2)), compounds: strat.comp, stint: 0, stintStartLap: 1,
      inPit: false, pitEnterT: 0, stopUntil: 0, stopped: false, retireAt: null, retired: false, finished: false,
      finishT: 0, offset: 0, lastSpeed: 0,
    };
  });
  // one retirement for realism
  cars[13].retireAt = 11.55;
  const startT = 0; // lights out at t=0 relative to RACE_START + 180s
  const T0 = RACE_START + 180_000;
  const scStart = { lap: 8.4 };
  let scDeployed: number | null = null;
  let scInLap: number | null = null;
  let scEnd: number | null = null;
  let chequered: number | null = null;
  const rc = (t: number, category: string, message: string, extra: Row = {}) =>
    out.race_control.push({ ...base, date: isoAt(T0 + t * 1000), category, message, flag: null, scope: null, sector: null, driver_number: null, lap_number: null, ...extra });
  rc(-170, 'Other', 'PIT EXIT CLOSED');
  rc(-60, 'Flag', 'GREEN LIGHT - PIT EXIT OPEN', { flag: 'GREEN', scope: 'Track' });
  let lastPositions: number[] = [];
  let lastPosEmit = -10;
  let lastIntEmit = -10;
  let nextSample = -150;
  let lastWeather = -999;
  const tyreDeg = (comp: string, age: number) => {
    const k = comp === 'SOFT' ? 0.0016 : comp === 'MEDIUM' ? 0.0010 : 0.0006;
    const off = comp === 'SOFT' ? -0.006 : comp === 'MEDIUM' ? 0 : 0.005;
    return 1 + off + k * age;
  };
  const leaderLap = () => Math.max(...cars.map((cr) => cr.s / c.L));
  for (let t = -150; t < 3600; t += dt) {
    const raceOn = t >= startT;
    // safety car control
    const lead = leaderLap();
    if (scDeployed == null && lead > scStart.lap) {
      scDeployed = t;
      rc(t, 'SafetyCar', 'SAFETY CAR DEPLOYED', { lap_number: Math.ceil(lead) });
      rc(t + 1, 'Flag', 'YELLOW IN TRACK SECTOR 9', { flag: 'YELLOW', scope: 'Sector', sector: 9 });
    }
    if (scDeployed != null && scInLap == null && t > scDeployed + 150) {
      scInLap = t;
      rc(t, 'SafetyCar', 'SAFETY CAR IN THIS LAP', { lap_number: Math.ceil(lead) });
    }
    const scActive = scDeployed != null && (scEnd == null || t < scEnd) && t >= scDeployed;
    const sorted = [...cars].sort((a, b) => b.s - a.s);
    for (let i = 0; i < sorted.length; i++) {
      const car = sorted[i];
      const ahead = i > 0 ? sorted[i - 1] : null;
      if (!raceOn) {
        car.v = 0;
        continue;
      }
      const lapF = car.s / c.L;
      const sNorm = ((car.s % c.L) + c.L) % c.L;
      const sm = sampleCircuit(c, car.s);
      const comp = car.compounds[car.stint];
      const age = car.lap - car.stintStartLap + 1;
      let vt = sm.v / (car.pace * tyreDeg(comp, Math.max(0, age)));
      if (car.finished) vt *= 0.45;
      if (scActive && !car.finished) {
        vt = Math.min(vt, 42);
        if (ahead && !ahead.retired) {
          const gap = ahead.s - car.s;
          if (gap < 30) vt = Math.min(vt, ahead.v * 0.97);
          else if (gap > 70) vt = Math.min(sm.v, vt * 1.35);
        }
      } else if (ahead && !ahead.retired && !ahead.inPit && !car.inPit && !ahead.finished) {
        const gap = ahead.s - car.s;
        const aheadPace = ahead.pace * tyreDeg(ahead.compounds[ahead.stint], ahead.lap - ahead.stintStartLap + 1);
        const myPace = car.pace * tyreDeg(comp, Math.max(0, age));
        const canPass = inDrs(c, car.s) && car.lap >= 3 && myPace < aheadPace;
        if (gap > 0 && gap < 60 && canPass) {
          vt *= 1.04; // DRS + faster car: go for it
          car.offset = Math.min(7, car.offset + 10 * dt);
        } else if (gap > 0 && gap < 14) {
          vt = Math.min(vt, ahead.v); // stuck behind
          if (gap < 7) car.v = Math.min(car.v, ahead.v * 0.97);
        } else if (gap > 0 && gap < 30) vt *= 0.994; // dirty air
      }
      // pit stops: enter in the last 350 m, stop right after the line
      const wantsPit = car.pitLaps[car.stint] === car.lap && car.stint < car.compounds.length - 1;
      if (!car.inPit && wantsPit && sNorm > c.L - 380 && !car.retired) {
        car.inPit = true;
        car.pitEnterT = t;
      }
      if (car.inPit) {
        vt = Math.min(vt, 22.2);
        car.offset = Math.min(32, car.offset + 40 * dt);
      } else if (!car.retired) car.offset = Math.max(0, car.offset - 6 * dt);
      if (car.retireAt != null && lapF >= car.retireAt && !car.retired) {
        car.retired = true;
        rc(t + 2, 'Other', `CAR ${car.num} (${car.code}) STOPPED ON TRACK`, { driver_number: car.num, lap_number: car.lap });
      }
      if (car.retired) {
        vt = 0;
        car.offset = Math.min(45, car.offset + 20 * dt);
      }
      if (t < car.stopUntil) vt = 0;
      // dynamics
      if (vt > car.v) car.v = Math.min(vt, car.v + 16 * Math.max(0.15, 1 - car.v / 102) * dt * (car.lap === 0 ? 0.9 : 1));
      else car.v = Math.max(vt, car.v - 42 * dt);
      const prevS = car.s;
      car.s += car.v * dt;
      // line crossings
      const prevLap = Math.floor(prevS / c.L);
      const newLap = Math.floor(car.s / c.L);
      const third = c.L / 3;
      const lapStartT = car.lap === 0 ? startT : car.lapStartT;
      if (car.lap >= 1 || car.s > 0) {
        const pm = Math.floor((prevS - 0) / third);
        const nm = Math.floor(car.s / third);
        if (nm > pm && car.s > 0 && nm % 3 !== 0) car.sectorT.push(t);
      }
      if (newLap > prevLap && car.s > 0) {
        // completed lap `car.lap` (lap 0 = run to the line from the grid)
        if (car.lap >= 1 && !car.finished) {
          const dur = t - lapStartT;
          const [a, b] = car.sectorT.slice(-2);
          const s1 = a != null ? a - lapStartT : null;
          const s2 = a != null && b != null ? b - a : null;
          const s3 = b != null ? t - b : null;
          out.laps.push({
            ...base, driver_number: car.num, lap_number: car.lap, date_start: isoAt(T0 + lapStartT * 1000),
            lap_duration: +dur.toFixed(3), duration_sector_1: s1 && +s1.toFixed(3), duration_sector_2: s2 && +s2.toFixed(3),
            duration_sector_3: s3 && +s3.toFixed(3), is_pit_out_lap: car.stint > 0 && car.stintStartLap === car.lap,
            i1_speed: Math.round(280 + rand() * 30), i2_speed: Math.round(250 + rand() * 30), st_speed: Math.round(300 + rand() * 25),
            ...demoSegments(rand, car.stint > 0 && car.stintStartLap === car.lap),
          });
        }
        car.sectorT = [];
        if (car.lap === 0) car.lap = 1;
        else car.lap++;
        car.lapStartT = car.lap === 1 ? startT : t;
        if (car.lap === 1) car.lapStartT = startT;
        if (car.inPit) {
          car.stopUntil = t + 2.1 + rand() * 1.2;
          const ln = car.lap - 1;
          car.stint++;
          car.stintStartLap = car.lap;
          out.pit.push({ ...base, driver_number: car.num, date: isoAt(T0 + car.pitEnterT * 1000), lap_number: ln, lane_duration: 0, pit_duration: 0, stop_duration: +(car.stopUntil - t).toFixed(1), _enter: car.pitEnterT });
        }
        if (!car.finished && !car.retired && (car.lap > RACE_LAPS || chequered != null)) {
          car.finished = true;
          car.finishT = t;
          if (chequered == null) {
            chequered = t;
            rc(t, 'Flag', 'CHEQUERED FLAG', { flag: 'CHEQUERED', scope: 'Track' });
          }
        }
      }
      if (car.inPit && t > car.stopUntil && car.stopUntil > 0 && sNorm > 350 && sNorm < 600) {
        car.inPit = false;
        const p = [...out.pit].reverse().find((r) => r.driver_number === car.num);
        if (p) {
          const lane = +(t - (p._enter as number)).toFixed(3);
          p.lane_duration = lane;
          p.pit_duration = lane;
        }
      }
      car.lastSpeed = car.v;
    }
    if (scInLap != null && scEnd == null) {
      const leader = sorted[0];
      const crossed = Math.floor(leader.s / c.L) > Math.floor((leader.s - leader.v * dt) / c.L);
      if (crossed && t > scInLap + 5) {
        scEnd = t;
        rc(t, 'Flag', 'GREEN FLAG', { flag: 'GREEN', scope: 'Track' });
        rc(t + 0.5, 'Other', 'TRACK CLEAR');
      }
    }
    // sampling
    if (t >= nextSample) {
      nextSample += sampleEvery + (rand() - 0.5) * 0.04;
      const ms = T0 + t * 1000;
      for (const car of cars) {
        if (car.finished && t - car.finishT > 75) continue;
        const sm = sampleCircuit(c, car.s);
        const x = (sm.x + sm.nx * car.offset) * 10;
        const y = (sm.y + sm.ny * car.offset) * 10;
        out.location.push({ ...base, driver_number: car.num, date: isoAt(ms + rand() * 30), x: Math.round(x), y: Math.round(y), z: 0 });
        const kmh = Math.round(car.v * 3.6);
        const accel = car.v - car.lastSpeed;
        out.car_data.push({
          ...base, driver_number: car.num, date: isoAt(ms + 15), speed: kmh, n_gear: kmh < 3 ? 0 : gearFor(kmh),
          rpm: kmh < 3 ? 4000 : Math.round(9500 + ((kmh % 40) / 40) * 2400),
          throttle: car.v < sm.v * 0.93 / car.pace && accel < -0.1 ? 0 : kmh < 3 ? 0 : 100,
          brake: accel < -0.5 ? 100 : 0,
          drs: inDrs(c, car.s) && car.lap >= 3 && !scActive ? 12 : 8,
        });
      }
    }
    // positions & intervals
    if (raceOn && t - lastPosEmit >= 1) {
      lastPosEmit = t;
      const ranked = [...cars].sort((a, b) => {
        if (a.retired !== b.retired) return a.retired ? 1 : -1;
        if (a.finished && b.finished) return a.finishT - b.finishT;
        return b.s - a.s;
      });
      ranked.forEach((car, i) => {
        if (lastPositions[i] !== car.num) {
          out.position.push({ ...base, driver_number: car.num, date: isoAt(T0 + t * 1000), position: i + 1 });
          const prevIdx = lastPositions.indexOf(car.num);
          if (prevIdx > i && lastPositions.length && !car.inPit && t > 20) {
            const victim = lastPositions[i];
            const v = cars.find((cc) => cc.num === victim);
            if (v && !v.inPit && !v.retired)
              out.overtakes.push({ ...base, date: isoAt(T0 + t * 1000), overtaking_driver_number: car.num, overtaken_driver_number: victim, position: i + 1 });
          }
        }
      });
      lastPositions = ranked.map((r) => r.num);
      if (t - lastIntEmit >= 4) {
        lastIntEmit = t;
        ranked.forEach((car, i) => {
          const gl = (ranked[0].s - car.s) / 62;
          const gi = i ? (ranked[i - 1].s - car.s) / 62 : 0;
          out.intervals.push({ ...base, driver_number: car.num, date: isoAt(T0 + t * 1000), gap_to_leader: i ? +gl.toFixed(3) : 0, interval: i ? +gi.toFixed(3) : 0 });
        });
      }
    } else if (!raceOn && t > -2 && !lastPositions.length) {
      cars.forEach((car, i) => out.position.push({ ...base, driver_number: car.num, date: isoAt(T0 + t * 1000), position: i + 1 }));
      lastPositions = cars.map((car) => car.num);
    }
    if (t - lastWeather >= 60) {
      lastWeather = t;
      out.weather.push({ ...base, date: isoAt(T0 + t * 1000), air_temperature: +(27.4 + Math.sin(t / 900) * 0.6).toFixed(1), track_temperature: +(44 - t / 600).toFixed(1), humidity: 46, pressure: 1012.3, rainfall: 0, wind_speed: +(2.1 + rand()).toFixed(1), wind_direction: Math.round(200 + rand() * 40) });
    }
    if (chequered != null && cars.every((cc) => cc.finished || cc.retired) && t > chequered + 90) break;
  }
  // stints
  for (const car of cars) {
    const lapsDone = out.laps.filter((l) => l.driver_number === car.num).length;
    let start = 1;
    car.compounds.forEach((comp, i) => {
      if (i > car.stint) return;
      const end = i < car.stint ? (car.pitLaps[i] ?? lapsDone) : lapsDone;
      out.stints.push({ ...base, driver_number: car.num, stint_number: i + 1, compound: comp, lap_start: start, lap_end: end, tyre_age_at_start: i === 0 ? 2 : 0 });
      start = end + 1;
    });
  }
  // results
  const ranked = [...cars].sort((a, b) => {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    if (a.retired && b.retired) return b.s - a.s;
    return a.finishT - b.finishT;
  });
  const winner = ranked[0];
  ranked.forEach((car, i) => {
    const lapsDone = out.laps.filter((l) => l.driver_number === car.num).length;
    out.session_result.push({ ...base, driver_number: car.num, position: i + 1, number_of_laps: lapsDone, dnf: car.retired, dns: false, dsq: false, duration: car.retired ? null : +(car.finishT - startT).toFixed(3), gap_to_leader: i === 0 ? 0 : car.retired ? null : +(car.finishT - winner.finishT).toFixed(3) });
  });
  for (const p of out.pit) delete p._enter;
  return out;
}

function simulateQuali(c: Circuit): Record<string, Row[]> {
  const rand = rng(7);
  const out: Record<string, Row[]> = { location: [], car_data: [], laps: [], stints: [], pit: [], race_control: [], weather: [], position: [], intervals: [], session_result: [], overtakes: [], team_radio: [] };
  const base = { meeting_key: DEMO_MEETING_KEY, session_key: DEMO_QUALI_KEY };
  const T0 = QUALI_START;
  const best = new Map<number, number>();
  out.race_control.push({ ...base, date: isoAt(T0), category: 'Flag', message: 'GREEN LIGHT - PIT EXIT OPEN', flag: 'GREEN', scope: 'Track', sector: null, driver_number: null, lap_number: null });
  DRIVERS.forEach(([num], idx) => {
    const pace = 1 + idx * 0.0019 + rand() * 0.005;
    const runs = [60 + rand() * 300, 900 + rand() * 250];
    let lapNo = 0;
    let stint = 0;
    for (const runStart of runs) {
      stint++;
      out.stints.push({ ...base, driver_number: num, stint_number: stint, compound: 'SOFT', lap_start: lapNo + 1, lap_end: lapNo + 3, tyre_age_at_start: 0 });
      // out lap (slow), push lap, cool-down/in lap
      const plan = [0.62, 1, 0.58];
      let t = runStart;
      let s = -260;
      let v = 0;
      const pushPace = pace * (1 - 0.004 * (stint - 1) + (rand() - 0.5) * 0.003);
      plan.forEach((factor, k) => {
        lapNo++;
        const lapStart = t;
        const sectorTimes: number[] = [];
        const lapEndS = (k + 1) * c.L;
        let next = t;
        while (s < lapEndS) {
          const sm = sampleCircuit(c, s);
          const vt = factor === 1 ? sm.v / pushPace : Math.min(sm.v, 60) * factor + 8;
          if (vt > v) v = Math.min(vt, v + 16 * Math.max(0.15, 1 - v / 102) * 0.05);
          else v = Math.max(vt, v - 42 * 0.05);
          const prev = s;
          s += v * 0.05;
          t += 0.05;
          const th = c.L / 3;
          if (Math.floor(s / th) > Math.floor(prev / th) && s > k * c.L + 1) sectorTimes.push(t);
          if (t >= next) {
            next += 0.27;
            const off = s < 0 ? 30 : 0;
            out.location.push({ ...base, driver_number: num, date: isoAt(T0 + t * 1000), x: Math.round((sm.x + sm.nx * off) * 10), y: Math.round((sm.y + sm.ny * off) * 10), z: 0 });
            const kmh = Math.round(v * 3.6);
            out.car_data.push({ ...base, driver_number: num, date: isoAt(T0 + t * 1000 + 10), speed: kmh, n_gear: gearFor(kmh), rpm: Math.round(9800 + ((kmh % 40) / 40) * 2200), throttle: v < vt - 0.5 ? 100 : v > vt + 0.5 ? 0 : 60, brake: v > vt + 1 ? 100 : 0, drs: factor === 1 && inDrs(c, s) ? 12 : 8 });
          }
        }
        const dur = t - lapStart;
        const [a, b] = sectorTimes;
        out.laps.push({ ...base, driver_number: num, lap_number: lapNo, date_start: isoAt(T0 + lapStart * 1000), lap_duration: +dur.toFixed(3), duration_sector_1: a ? +(a - lapStart).toFixed(3) : null, duration_sector_2: a && b ? +(b - a).toFixed(3) : null, duration_sector_3: b ? +(t - b).toFixed(3) : null, is_pit_out_lap: k === 0, i1_speed: 290, i2_speed: 260, st_speed: 310, ...demoSegments(rand, k === 0) });
        if (factor === 1) best.set(num, Math.min(best.get(num) ?? Infinity, dur));
      });
    }
  });
  [...best.entries()].sort((a, b) => a[1] - b[1]).forEach(([num, time], i, arr) => {
    out.session_result.push({ ...base, driver_number: num, position: i + 1, number_of_laps: 6, dnf: false, dns: false, dsq: false, duration: +time.toFixed(3), gap_to_leader: i ? +(time - arr[0][1]).toFixed(3) : 0 });
  });
  for (let t = 0; t < 1800; t += 60) out.weather.push({ ...base, date: isoAt(T0 + t * 1000), air_temperature: 28.1, track_temperature: 47.2, humidity: 41, pressure: 1011.8, rainfall: 0, wind_speed: 1.8, wind_direction: 210 });
  return out;
}

let db: DemoDb | null = null;
function getDb(): DemoDb {
  if (db) return db;
  const c = buildCircuit();
  db = { race: simulateRace(c), quali: simulateQuali(c) };
  return db;
}

const meeting = {
  meeting_key: DEMO_MEETING_KEY, meeting_name: 'Italian Grand Prix · Demo', meeting_official_name: 'SIMULAZIONE OFFLINE — AUTODROMO NAZIONALE MONZA',
  location: 'Monza', country_name: 'Italy', country_code: 'ITA', circuit_short_name: 'Monza', circuit_type: 'Permanent',
  date_start: isoAt(QUALI_START - 86_400_000), date_end: isoAt(RACE_START + 7_200_000), gmt_offset: '02:00:00', year: DEMO_YEAR, is_cancelled: false,
};
const sessions = [
  { session_key: DEMO_QUALI_KEY, session_name: 'Qualifying', session_type: 'Qualifying', date_start: isoAt(QUALI_START), date_end: isoAt(QUALI_START + 3_600_000) },
  { session_key: DEMO_RACE_KEY, session_name: 'Race', session_type: 'Race', date_start: isoAt(RACE_START), date_end: isoAt(RACE_START + 7_200_000) },
].map((s) => ({ ...s, meeting_key: DEMO_MEETING_KEY, circuit_short_name: meeting.circuit_short_name, country_name: meeting.country_name, country_code: 'ITA', location: meeting.location, gmt_offset: meeting.gmt_offset, year: DEMO_YEAR, is_cancelled: false }));

function compare(a: unknown, op: string, b: unknown): boolean {
  let x: number | string;
  let y: number | string;
  if (typeof a === 'number') {
    x = a;
    y = Number(b);
  } else if (typeof a === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(a)) {
    x = Date.parse(a);
    y = Date.parse(String(b));
  } else {
    x = String(a);
    y = String(b);
  }
  switch (op) {
    case '=': return x == y;
    case '>': return x > y;
    case '>=': return x >= y;
    case '<': return x < y;
    case '<=': return x <= y;
    default: return true;
  }
}

let headshots: Promise<Map<number, string>> | null = null;
/** Real driver portraits from the latest OpenF1 session, when online. */
function realHeadshots(): Promise<Map<number, string>> {
  if (!headshots) {
    const src = new OpenF1Source();
    headshots = Promise.race([
      src
        .get<RawDriver>('drivers', [['session_key', '=', 'latest']], { cacheMs: 86_400_000 })
        .then((rows) => new Map(rows.filter((r) => r.headshot_url).map((r) => [r.driver_number, r.headshot_url!]))),
      new Promise<Map<number, string>>((resolve) => setTimeout(() => resolve(new Map()), 6000)),
    ]).catch(() => new Map());
  }
  return headshots;
}

export class DemoSource implements DataSource {
  readonly id = 'demo';

  async circuitInfo(): Promise<RawCircuitInfo> {
    return {
      corners: MONZA_CORNERS.map(([num, idx]) => ({
        number: Number(num),
        trackPosition: { x: Math.round(MONZA_PTS[idx][0] * 10), y: Math.round(MONZA_PTS[idx][1] * 10) },
      })),
    };
  }

  async get<T>(endpoint: string, filters: Filter[] = [], _opts: GetOptions = {}): Promise<T[]> {
    void _opts;
    await new Promise((r) => setTimeout(r, 0));
    let rows: Row[];
    const sessionKey = filters.find((f) => f[0] === 'session_key')?.[2];
    if (endpoint === 'meetings') rows = [meeting];
    else if (endpoint === 'sessions') rows = sessions;
    else if (endpoint === 'drivers') {
      const shots = await realHeadshots();
      rows = DRIVERS.map(([num, code, first, last, team, colour, cc]) => ({
        driver_number: num, name_acronym: code, first_name: first, last_name: last, full_name: `${first} ${last.toUpperCase()}`,
        broadcast_name: `${first[0]} ${last.toUpperCase()}`, team_name: team, team_colour: colour, headshot_url: shots.get(num) ?? null, country_code: cc,
        session_key: sessionKey, meeting_key: DEMO_MEETING_KEY,
      }));
    } else if (endpoint === 'championship_drivers' || endpoint === 'championship_teams') rows = [];
    else {
      const d = getDb();
      const set = Number(sessionKey) === DEMO_QUALI_KEY ? d.quali : d.race;
      rows = set[endpoint] ?? [];
    }
    const res = rows.filter((r) => filters.every(([k, op, v]) => (k in r ? compare(r[k], op, v) : true)));
    return res as T[];
  }
}

export function isDemoKey(key: number) {
  return key === DEMO_RACE_KEY || key === DEMO_QUALI_KEY;
}
