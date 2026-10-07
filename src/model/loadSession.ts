import type { DataSource } from '../api/openf1';
import { FOREVER } from '../api/openf1';
import { cacheGet, cacheSet } from '../api/cache';
import type {
  Filter,
  RawCarData,
  RawCircuitInfo,
  RawDriver,
  RawInterval,
  RawLap,
  RawLocation,
  RawMeeting,
  RawOvertake,
  RawPit,
  RawPosition,
  RawRaceControl,
  RawRadio,
  RawResult,
  RawSession,
  RawStint,
  RawWeather,
} from '../api/types';
import { cornerName, findCircuit } from '../data/circuits';
import { normCompound, teamColor } from './constants';
import { analyseReferenceLap, elevationProfile, gridSlots, marshalSectors, tracePitLane } from './trackDetails';
import { buildReference, projectS } from './geometry';
import { bisect, carAt, distanceAt, runningMax, timeAtDistance } from './interp';
import type {
  Driver,
  DriverTrack,
  Lap,
  Period,
  ReferencePath,
  SessionData,
  SessionKind,
  SessionMeta,
  TimedValue,
} from './types';
import { groupBy, isNum, median, parseDate, parseGmtOffset } from './util';

export type Progress = (label: string, fraction: number) => void;

export function kindOf(sessionType: string, sessionName: string): SessionKind {
  const t = `${sessionType} ${sessionName}`.toLowerCase();
  if (t.includes('practice')) return 'practice';
  if (t.includes('qualifying') || t.includes('shootout')) return 'quali';
  return 'race';
}

export function toMeta(s: RawSession, m: RawMeeting | undefined): SessionMeta {
  return {
    key: s.session_key,
    name: s.session_name,
    type: s.session_type,
    kind: kindOf(s.session_type, s.session_name),
    isSprint: /sprint/i.test(s.session_name),
    year: s.year,
    meetingKey: s.meeting_key,
    meetingName: m?.meeting_name ?? `${s.country_name} Grand Prix`,
    officialName: m?.meeting_official_name,
    circuit: s.circuit_short_name,
    circuitKey: s.circuit_key,
    circuitType: m?.circuit_type,
    circuitImage: m?.circuit_image,
    circuitInfoUrl: m?.circuit_info_url,
    country: s.country_name,
    countryCode: s.country_code ?? m?.country_code,
    countryFlag: m?.country_flag,
    location: s.location,
    dateStart: parseDate(s.date_start),
    dateEnd: parseDate(s.date_end),
    gmtOffsetMin: parseGmtOffset(s.gmt_offset ?? m?.gmt_offset),
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

interface CompactTrack {
  t: Float64Array;
  x: Float32Array;
  y: Float32Array;
  z?: Float32Array;
}

async function fetchWindowed<T>(
  src: DataSource,
  endpoint: string,
  base: Filter[],
  from: number,
  to: number,
  signal: AbortSignal | undefined,
  depth = 0,
): Promise<T[]> {
  try {
    return await src.get<T>(endpoint, [...base, ['date', '>=', iso(from)], ['date', '<', iso(to)]], { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError' || depth >= 4 || to - from < 120_000) throw e;
    const mid = Math.round((from + to) / 2);
    const a = await fetchWindowed<T>(src, endpoint, base, from, mid, signal, depth + 1);
    const b = await fetchWindowed<T>(src, endpoint, base, mid, to, signal, depth + 1);
    return a.concat(b);
  }
}

async function loadLocation(
  src: DataSource,
  sessionKey: number,
  driver: number,
  from: number,
  to: number,
  t0: number,
  cacheable: boolean,
  signal?: AbortSignal,
): Promise<CompactTrack> {
  const key = `loc:v3:${src.id}:${sessionKey}:${driver}:${from}:${to}`;
  if (cacheable) {
    const hit = await cacheGet<CompactTrack>(key);
    if (hit) return hit;
  }
  const rows = await fetchWindowed<RawLocation>(
    src,
    'location',
    [
      ['session_key', '=', sessionKey],
      ['driver_number', '=', driver],
    ],
    from,
    to,
    signal,
  );
  const pts: [number, number, number, number][] = [];
  for (const r of rows) {
    if (!isNum(r.x) || !isNum(r.y) || (r.x === 0 && r.y === 0)) continue;
    const t = (parseDate(r.date) - t0) / 1000;
    if (Number.isFinite(t)) pts.push([t, r.x, r.y, isNum(r.z) ? r.z : NaN]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const t = new Float64Array(pts.length);
  const x = new Float32Array(pts.length);
  const y = new Float32Array(pts.length);
  const z = new Float32Array(pts.length);
  let n = 0;
  let hasZ = false;
  for (const p of pts) {
    if (n && p[0] - t[n - 1] < 0.01) continue;
    t[n] = p[0];
    x[n] = p[1];
    y[n] = p[2];
    z[n] = Number.isFinite(p[3]) ? p[3] : 0;
    if (Number.isFinite(p[3]) && p[3] !== 0) hasZ = true;
    n++;
  }
  const out: CompactTrack = { t: t.slice(0, n), x: x.slice(0, n), y: y.slice(0, n) };
  if (hasZ) out.z = z.slice(0, n);
  if (cacheable && n) void cacheSet(key, out);
  return out;
}

/** Project every sample on the reference and unwrap into a continuous distance (in laps). */
export function computeDistance(track: CompactTrack, ref: ReferencePath): Float64Array {
  const n = track.t.length;
  const d = new Float64Array(n);
  const L = ref.length;
  let hint = -1;
  let prevS = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const p = projectS(ref, track.x[i], track.y[i], hint);
    hint = p.idx;
    if (i > 0) {
      let delta = p.s - prevS;
      if (delta < -L / 2) delta += L;
      else if (delta > L / 2) delta -= L;
      acc += delta;
    } else acc = p.s;
    prevS = p.s;
    d[i] = acc / L;
  }
  return d;
}

/** Shift distances by an integer number of laps so that D at each lap start ≈ lap - 1. */
export function calibrate(track: DriverTrack, laps: Lap[], fallbackStart: number) {
  const diffs: number[] = [];
  for (const l of laps) {
    if (l.start == null || l.lap < 1) continue;
    if (l.start < track.t[0] || l.start > track.t[track.t.length - 1]) continue;
    diffs.push(l.lap - 1 - distanceAt(track, l.start));
  }
  let k: number;
  if (diffs.length) k = Math.round(median(diffs));
  else k = -Math.floor(distanceAt(track, fallbackStart) + 0.02);
  if (k) for (let i = 0; i < track.d.length; i++) track.d[i] += k;
}

function chooseReferenceLap(
  laps: Lap[],
  tracks: Map<number, CompactTrack>,
  kind: SessionKind,
): { lap: Lap; pts: { x: number[]; y: number[] } } | null {
  const timed = laps.filter((l) => l.start != null && l.dur != null && l.dur > 20 && !l.pitOut && l.lap > 1);
  if (!timed.length) return null;
  const med = median(timed.map((l) => l.dur!));
  const pitIn = new Set<string>();
  for (const l of laps) if (l.pitOut) pitIn.add(`${l.driver}:${l.lap - 1}`);
  const candidates = timed
    .filter((l) => l.dur! < med * (kind === 'race' ? 1.04 : 1.25) && !pitIn.has(`${l.driver}:${l.lap}`))
    .sort((a, b) => a.dur! - b.dur!);
  for (const lap of candidates.slice(0, 40)) {
    const tr = tracks.get(lap.driver);
    if (!tr || tr.t.length < 10) continue;
    const a = lap.start!;
    const b = a + lap.dur!;
    const i0 = bisect(tr.t, a);
    const i1 = bisect(tr.t, b);
    if (i0 < 0 || i1 >= tr.t.length - 1 || i1 - i0 < lap.dur! * 2.2) continue;
    let maxGap = 0;
    for (let i = i0 + 1; i <= i1 + 1; i++) maxGap = Math.max(maxGap, tr.t[i] - tr.t[i - 1]);
    if (maxGap > 2.5) continue;
    const xs: number[] = [];
    const ys: number[] = [];
    const startPt = carAt({ ...tr, d: new Float64Array(tr.t.length) }, a)!;
    xs.push(startPt.x);
    ys.push(startPt.y);
    for (let i = i0 + 1; i <= i1; i++) {
      xs.push(tr.x[i]);
      ys.push(tr.y[i]);
    }
    return { lap, pts: { x: xs, y: ys } };
  }
  return null;
}

/** Fallback outline: densest single-car loop between two consecutive passes of the same spot. */
function fallbackOutline(tracks: Map<number, CompactTrack>): { x: number[]; y: number[] } | null {
  let best: CompactTrack | null = null;
  for (const tr of tracks.values()) if (!best || tr.t.length > best.t.length) best = tr;
  if (!best || best.t.length < 200) return null;
  const start = Math.floor(best.t.length / 3);
  const sx = best.x[start];
  const sy = best.y[start];
  let far = false;
  for (let i = start + 30; i < best.t.length; i++) {
    const d = Math.hypot(best.x[i] - sx, best.y[i] - sy);
    if (d > 2000) far = true;
    if (far && d < 150) {
      return { x: Array.from(best.x.slice(start, i)), y: Array.from(best.y.slice(start, i)) };
    }
  }
  return null;
}

async function fetchCircuitInfo(meta: SessionMeta, signal?: AbortSignal): Promise<RawCircuitInfo | null> {
  const url =
    meta.circuitInfoUrl ??
    (meta.circuitKey ? `https://api.multiviewer.app/api/v1/circuits/${meta.circuitKey}/${meta.year}` : null);
  if (!url) return null;
  const key = `circuit:${url}`;
  const hit = await cacheGet<RawCircuitInfo>(key);
  if (hit) return hit;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    signal?.addEventListener('abort', () => ctl.abort());
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const info = (await res.json()) as RawCircuitInfo;
    void cacheSet(key, info);
    return info;
  } catch {
    return null;
  }
}

function buildPeriods(
  rc: SessionData['raceControl'],
  leader: { track: DriverTrack; max: Float64Array } | null,
  endT: number,
): Period[] {
  const out: Period[] = [];
  let sc: Period | null = null;
  let vsc: Period | null = null;
  let red: Period | null = null;
  const nextLine = (t: number) => {
    if (!leader) return t + 60;
    const d = distanceAt(leader.track, t);
    return timeAtDistance(leader.track, Math.floor(d) + 1, leader.max) ?? t + 60;
  };
  for (const m of rc) {
    const msg = m.message.toUpperCase();
    if (msg.includes('VIRTUAL SAFETY CAR DEPLOYED')) {
      if (!vsc) vsc = { kind: 'VSC', start: m.t, end: endT };
    } else if (msg.includes('VIRTUAL SAFETY CAR ENDING') || msg.includes('VSC ENDING')) {
      if (vsc) {
        vsc.end = m.t + 10;
        out.push(vsc);
        vsc = null;
      }
    } else if (msg.includes('SAFETY CAR DEPLOYED')) {
      if (!sc) sc = { kind: 'SC', start: m.t, end: endT };
    } else if (msg.includes('SAFETY CAR IN THIS LAP')) {
      if (sc) {
        sc.inLap = m.t;
        sc.end = nextLine(m.t);
        out.push(sc);
        sc = null;
      }
    }
    if (m.flag === 'RED' && (m.scope ?? 'Track') === 'Track') {
      if (sc) {
        sc.end = m.t;
        out.push(sc);
        sc = null;
      }
      if (vsc) {
        vsc.end = m.t;
        out.push(vsc);
        vsc = null;
      }
      if (!red) red = { kind: 'RED', start: m.t, end: endT };
    } else if (red && (m.flag === 'GREEN' || msg.includes('TRACK CLEAR') || msg.includes('RESUME'))) {
      if (m.t > red.start + 30) {
        red.end = m.t;
        out.push(red);
        red = null;
      }
    }
  }
  for (const p of [sc, vsc, red]) if (p) out.push(p);
  return out.sort((a, b) => a.start - b.start);
}

export interface LoadOptions {
  signal?: AbortSignal;
  onProgress?: Progress;
}

export async function loadSession(src: DataSource, sessionKey: number, opts: LoadOptions = {}): Promise<SessionData> {
  const { signal } = opts;
  const progress = opts.onProgress ?? (() => {});
  const s: Filter[] = [['session_key', '=', sessionKey]];

  progress('Informazioni sessione', 0.02);
  const [session] = await src.get<RawSession>('sessions', s, { signal, cacheMs: FOREVER });
  if (!session) throw new Error('Sessione non trovata');
  const [meeting] = await src.get<RawMeeting>('meetings', [['meeting_key', '=', session.meeting_key]], {
    signal,
    cacheMs: FOREVER,
  });
  const meta = toMeta(session, meeting);
  const t0 = meta.dateStart;
  const ended = Date.now() > meta.dateEnd + 2 * 3_600_000;
  const cacheMs = ended ? FOREVER : 60_000;
  const rel = (d: string | null | undefined) => (parseDate(d) - t0) / 1000;
  const isRace = meta.kind === 'race';

  progress('Piloti, giri e strategie', 0.05);
  const opt = { signal, cacheMs };
  const [rawDrivers, rawLaps, rawStints, rawPits, rawRc, rawWeather, rawPos, rawInt, rawRes, rawRadio, rawOvt] =
    await Promise.all([
      src.get<RawDriver>('drivers', s, opt),
      src.get<RawLap>('laps', s, opt),
      src.get<RawStint>('stints', s, opt),
      src.get<RawPit>('pit', s, opt),
      src.get<RawRaceControl>('race_control', s, opt),
      src.get<RawWeather>('weather', s, opt),
      src.get<RawPosition>('position', s, opt),
      isRace ? src.get<RawInterval>('intervals', s, opt) : Promise.resolve([] as RawInterval[]),
      src.get<RawResult>('session_result', s, opt).catch(() => [] as RawResult[]),
      src.get<RawRadio>('team_radio', s, opt).catch(() => [] as RawRadio[]),
      isRace ? src.get<RawOvertake>('overtakes', s, opt).catch(() => [] as RawOvertake[]) : Promise.resolve([]),
    ]);

  // ---------------- drivers
  const seen = new Set<number>();
  const drivers: Driver[] = [];
  for (const d of rawDrivers) {
    if (seen.has(d.driver_number)) continue;
    seen.add(d.driver_number);
    const last = d.last_name ?? d.full_name?.split(' ').slice(1).join(' ') ?? d.name_acronym;
    drivers.push({
      num: d.driver_number,
      code: d.name_acronym ?? String(d.driver_number),
      first: d.first_name ?? d.full_name?.split(' ')[0] ?? '',
      last: last ? last.charAt(0) + last.slice(1).toLowerCase() : '',
      full: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.full_name ?? d.name_acronym,
      team: d.team_name ?? '—',
      color: teamColor(d.team_name, d.team_colour),
      headshot: d.headshot_url ? d.headshot_url.replace('/1col/', '/2col/') : undefined,
      country: d.country_code ?? undefined,
    });
  }
  if (!drivers.length) throw new Error('Nessun dato pilota disponibile per questa sessione');
  const byNum = new Map(drivers.map((d) => [d.num, d]));

  // ---------------- laps
  const laps: Lap[] = rawLaps
    .filter((l) => byNum.has(l.driver_number))
    .map((l) => {
      const start = l.date_start ? rel(l.date_start) : null;
      const dur = isNum(l.lap_duration) ? l.lap_duration : null;
      return {
        driver: l.driver_number,
        lap: l.lap_number,
        start,
        dur,
        end: start != null && dur != null ? start + dur : null,
        s1: l.duration_sector_1 ?? null,
        s2: l.duration_sector_2 ?? null,
        s3: l.duration_sector_3 ?? null,
        pitOut: !!l.is_pit_out_lap,
        i1: l.i1_speed ?? null,
        i2: l.i2_speed ?? null,
        st: l.st_speed ?? null,
        segs: [l.segments_sector_1 ?? [], l.segments_sector_2 ?? [], l.segments_sector_3 ?? []],
      };
    })
    .sort((a, b) => a.driver - b.driver || a.lap - b.lap);
  const lapsByDriver = groupBy(laps, (l) => l.driver);
  // Fill missing lap starts from the previous lap's end (lap 1 often lacks one).
  for (const list of lapsByDriver.values()) {
    for (let i = list.length - 2; i >= 0; i--) {
      const cur = list[i];
      const next = list[i + 1];
      if (cur.start == null && next.start != null && cur.dur != null && next.lap === cur.lap + 1) {
        cur.start = next.start - cur.dur;
        cur.end = next.start;
      }
    }
    for (let i = 0; i < list.length - 1; i++) {
      if (list[i].end == null && list[i + 1].start != null && list[i + 1].lap === list[i].lap + 1) {
        list[i].end = list[i + 1].start;
      }
    }
  }

  const validDurs = laps.filter((l) => l.dur && l.dur > 20 && !l.pitOut && l.lap > 1).map((l) => l.dur!);
  const typicalLap = validDurs.length ? median(validDurs) : 90;

  // ---------------- results, positions, intervals
  const results = rawRes
    .filter((r) => byNum.has(r.driver_number))
    .map((r) => ({
      driver: r.driver_number,
      pos: r.position ?? null,
      laps: r.number_of_laps ?? null,
      dnf: !!r.dnf,
      dns: !!r.dns,
      dsq: !!r.dsq,
      time: Array.isArray(r.duration) ? (r.duration.filter(isNum).at(-1) ?? null) : (r.duration ?? null),
      gap: Array.isArray(r.gap_to_leader)
        ? r.gap_to_leader.filter((g) => g != null).at(-1)?.toString() ?? null
        : r.gap_to_leader != null
          ? String(r.gap_to_leader)
          : null,
    }))
    .sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));

  const positions = new Map<number, TimedValue<number>[]>();
  for (const p of rawPos) {
    const list = positions.get(p.driver_number) ?? [];
    list.push({ t: rel(p.date), v: p.position });
    positions.set(p.driver_number, list);
  }
  for (const list of positions.values()) list.sort((a, b) => a.t - b.t);

  const intervals = new Map<number, TimedValue<{ gap: string | null; int: string | null }>[]>();
  const fmtGap = (g: number | string | null) => (g == null ? null : typeof g === 'number' ? g.toFixed(3) : g);
  for (const p of rawInt) {
    const list = intervals.get(p.driver_number) ?? [];
    list.push({ t: rel(p.date), v: { gap: fmtGap(p.gap_to_leader), int: fmtGap(p.interval) } });
    intervals.set(p.driver_number, list);
  }
  for (const list of intervals.values()) list.sort((a, b) => a.t - b.t);

  // ---------------- timeline window
  const lap1Starts = laps.filter((l) => l.lap === 1 && l.start != null).map((l) => l.start!);
  const lapEnds = laps.filter((l) => l.end != null).map((l) => l.end!);
  const firstLapStart = laps.filter((l) => l.start != null).reduce((m, l) => Math.min(m, l.start!), Infinity);
  const sessionLen = (meta.dateEnd - meta.dateStart) / 1000;
  let raceStart = 0;
  let startT: number;
  let endT: number;
  if (isRace) {
    raceStart = lap1Starts.length ? Math.min(...lap1Starts) : Number.isFinite(firstLapStart) ? firstLapStart : 0;
    startT = raceStart - 15;
    endT = lapEnds.length ? Math.max(...lapEnds) + 120 : sessionLen;
  } else {
    startT = Number.isFinite(firstLapStart) ? Math.max(-300, firstLapStart - 60) : 0;
    endT = lapEnds.length ? Math.max(...lapEnds) + 60 : sessionLen;
  }
  if (!(endT > startT)) endT = startT + Math.max(sessionLen, 3600);

  // ---------------- locations
  const locFrom = t0 + (startT - (isRace ? 300 : 120)) * 1000;
  const locTo = t0 + (endT + 120) * 1000;
  const compact = new Map<number, CompactTrack>();
  let done = 0;
  await Promise.all(
    drivers.map(async (d) => {
      const tr = await loadLocation(src, sessionKey, d.num, Math.round(locFrom), Math.round(locTo), t0, ended, signal);
      compact.set(d.num, tr);
      done++;
      progress(`Posizioni in pista · ${d.code}`, 0.1 + (0.75 * done) / drivers.length);
    }),
  );
  const totalSamples = [...compact.values()].reduce((a, t) => a + t.t.length, 0);
  if (totalSamples < 100) throw new Error('OpenF1 non ha ancora i dati di posizione per questa sessione');

  // ---------------- reference path
  progress('Disegno del circuito', 0.87);
  const chosen = chooseReferenceLap(laps, compact, meta.kind);
  const outline = chosen?.pts ?? fallbackOutline(compact);
  if (!outline) throw new Error('Impossibile ricostruire il tracciato da questi dati');
  const info = src.circuitInfo ? await src.circuitInfo(meta) : await fetchCircuitInfo(meta, signal);
  const circuit = findCircuit(meta.circuit, meta.location, meta.meetingName);
  const ref = buildReference(outline.x, outline.y, {
    rotation: isNum(info?.rotation) ? info!.rotation : undefined,
  });
  if (info?.corners) {
    ref.corners = info.corners
      .filter((c) => c.trackPosition && isNum(c.trackPosition.x))
      .map((c) => {
        const num = `${c.number}${c.letter ?? ''}`;
        return { num, x: c.trackPosition.x, y: c.trackPosition.y, name: cornerName(circuit?.id, num) };
      });
  }

  // ---------------- distances
  progress('Calcolo delle distanze di gara', 0.9);
  const tracks = new Map<number, DriverTrack>();
  for (const d of drivers) {
    const c = compact.get(d.num);
    if (!c || !c.t.length) continue;
    const tr: DriverTrack = { ...c, d: computeDistance(c, ref) };
    calibrate(tr, lapsByDriver.get(d.num) ?? [], isRace ? raceStart : startT);
    tracks.set(d.num, tr);
  }

  // ---------------- DRS, sectors, speed map & lap length from the reference lap
  let integratedM: number | null = null;
  if (chosen) {
    const refTrack = tracks.get(chosen.lap.driver);
    if (refTrack) {
      const a = t0 + chosen.lap.start! * 1000;
      const b = a + chosen.lap.dur! * 1000;
      const cd = await src
        .get<RawCarData>(
          'car_data',
          [...s, ['driver_number', '=', chosen.lap.driver], ['date', '>=', iso(a)], ['date', '<=', iso(b)]],
          { signal, cacheMs },
        )
        .catch(() => [] as RawCarData[]);
      integratedM = analyseReferenceLap(ref, chosen.lap, refTrack, cd, t0).lengthM;
      ref.z = elevationProfile(ref, refTrack, chosen.lap.start!, chosen.lap.start! + chosen.lap.dur!);
    }
  }
  ref.lengthM = circuit?.length ?? integratedM ?? ref.length / 10;
  ref.unitsPerMeter = ref.length / ref.lengthM;

  // ---------------- stints, pits, race control, weather, radio
  const stints = rawStints
    .filter((x) => byNum.has(x.driver_number))
    .map((x) => ({
      driver: x.driver_number,
      n: x.stint_number,
      lapStart: x.lap_start ?? 1,
      lapEnd: x.lap_end ?? x.lap_start ?? 1,
      compound: normCompound(x.compound),
      ageStart: x.tyre_age_at_start ?? 0,
    }))
    .sort((a, b) => a.driver - b.driver || a.n - b.n);
  const pits = rawPits
    .filter((p) => byNum.has(p.driver_number))
    .map((p) => ({
      driver: p.driver_number,
      t: rel(p.date),
      lap: p.lap_number,
      lane: p.lane_duration ?? p.pit_duration ?? null,
      stop: p.stop_duration ?? null,
    }))
    .sort((a, b) => a.t - b.t);
  const raceControl = rawRc
    .map((m) => ({
      t: rel(m.date),
      category: m.category,
      flag: m.flag,
      message: m.message,
      lap: m.lap_number,
      scope: m.scope,
      sector: m.sector,
      driver: m.driver_number,
    }))
    .filter((m) => Number.isFinite(m.t))
    .sort((a, b) => a.t - b.t);
  const weather = rawWeather
    .map((w) => ({
      t: rel(w.date),
      air: w.air_temperature,
      track: w.track_temperature,
      humidity: w.humidity,
      pressure: w.pressure,
      rain: !!w.rainfall,
      windSpeed: w.wind_speed,
      windDir: w.wind_direction,
    }))
    .sort((a, b) => a.t - b.t);
  const radio = rawRadio
    .filter((r) => r.recording_url)
    .map((r) => ({ t: rel(r.date), driver: r.driver_number, url: r.recording_url }))
    .sort((a, b) => a.t - b.t);
  const overtakes = rawOvt
    .map((o) => ({ t: rel(o.date), by: o.overtaking_driver_number, on: o.overtaken_driver_number, pos: o.position }))
    .sort((a, b) => a.t - b.t);

  // ---------------- finish / retirements
  const finishAt = new Map<number, number>();
  const retiredAt = new Map<number, number>();
  const finalLaps = new Map<number, number>();
  let totalLaps = laps.reduce((m, l) => Math.max(m, l.lap), 0);
  if (isRace) {
    const winner = results.find((r) => r.pos === 1);
    if (winner?.laps) totalLaps = winner.laps;
    const resultBy = new Map(results.map((r) => [r.driver, r]));
    for (const d of drivers) {
      const tr = tracks.get(d.num);
      const list = lapsByDriver.get(d.num) ?? [];
      const r = resultBy.get(d.num);
      const completed = r?.laps ?? list.filter((l) => l.end != null).length;
      finalLaps.set(d.num, completed);
      const out = r ? r.dnf || r.dns || r.dsq : completed < totalLaps - 3;
      if (!tr) {
        if (out) retiredAt.set(d.num, raceStart);
        continue;
      }
      if (out && !r?.dsq) {
        const max = runningMax(tr.d);
        const finalD = max[max.length - 1];
        const stopT = timeAtDistance(tr, finalD - 0.01, max) ?? tr.t[tr.t.length - 1];
        retiredAt.set(d.num, Math.max(raceStart, stopT + 5));
      } else if (completed > 0) {
        const lastLap = list.find((l) => l.lap === completed);
        const max = runningMax(tr.d);
        const tFinish = lastLap?.end ?? timeAtDistance(tr, completed, max);
        if (tFinish != null) finishAt.set(d.num, tFinish);
      }
    }
  }

  // ---------------- flags & safety car periods
  const winnerNum = results.find((r) => r.pos === 1)?.driver ?? drivers[0].num;
  const wTrack = tracks.get(winnerNum);
  const periods = buildPeriods(raceControl, wTrack ? { track: wTrack, max: runningMax(wTrack.d) } : null, endT);

  const lastSample = Math.max(...[...tracks.values()].map((t) => t.t[t.t.length - 1] ?? 0));
  if (lastSample > startT) endT = Math.min(endT, lastSample + 5);

  const grid = isRace
    ? [...positions.entries()]
        .map(([driver, list]) => ({ driver, pos: list.find((p) => p.t <= raceStart + 5)?.v ?? list[0]?.v ?? 99 }))
        .sort((a, b) => a.pos - b.pos)
    : [];

  ref.pitLane = tracePitLane(ref, tracks, pits);
  {
    const maxSeen = raceControl.reduce((m, r) => (r.sector != null && r.sector > m ? r.sector : m), 0);
    const ms = marshalSectors(ref, info?.marshalSectors, maxSeen);
    ref.marshal = ms.list;
    ref.marshalEstimated = ms.estimated;
  }
  if (isRace) ref.grid = gridSlots(ref, tracks, grid, raceStart);

  progress('Pronto', 1);
  return {
    source: src.id,
    meta,
    circuitId: circuit?.id,
    t0,
    drivers,
    byNum,
    tracks,
    ref,
    laps,
    lapsByDriver,
    stints,
    pits,
    raceControl,
    weather,
    positions,
    intervals,
    results,
    grid,
    radio,
    overtakes,
    periods,
    totalLaps,
    startT,
    endT,
    raceStart,
    finishAt,
    retiredAt,
    finalLaps,
    typicalLap,
  };
}
