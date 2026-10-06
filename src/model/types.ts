// Normalised, replay-ready session model. All times are seconds relative to
// `SessionData.t0` (epoch milliseconds of the session's scheduled start).

export type SessionKind = 'race' | 'quali' | 'practice';

export interface SessionMeta {
  key: number;
  name: string;
  type: string;
  kind: SessionKind;
  isSprint: boolean;
  year: number;
  meetingKey: number;
  meetingName: string;
  officialName?: string;
  circuit: string;
  circuitKey?: number;
  circuitType?: string;
  circuitImage?: string;
  circuitInfoUrl?: string;
  country: string;
  countryCode?: string;
  countryFlag?: string;
  location: string;
  dateStart: number;
  dateEnd: number;
  gmtOffsetMin: number;
}

export interface Driver {
  num: number;
  code: string;
  first: string;
  last: string;
  full: string;
  team: string;
  color: string;
  headshot?: string;
  country?: string;
}

export interface DriverTrack {
  t: Float64Array;
  x: Float32Array;
  y: Float32Array;
  /** Race distance in laps (1.5 = halfway round lap 2), unwrapped & calibrated. */
  d: Float64Array;
}

export interface Lap {
  driver: number;
  lap: number;
  start: number | null;
  dur: number | null;
  end: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  pitOut: boolean;
  i1: number | null;
  i2: number | null;
  st: number | null;
}

export type Compound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | 'UNKNOWN';

export interface Stint {
  driver: number;
  n: number;
  lapStart: number;
  lapEnd: number;
  compound: Compound;
  ageStart: number;
}

export interface PitStop {
  driver: number;
  t: number;
  lap: number;
  lane: number | null;
  stop: number | null;
}

export interface RaceControlMsg {
  t: number;
  category: string;
  flag: string | null;
  message: string;
  lap: number | null;
  scope: string | null;
  sector: number | null;
  driver: number | null;
}

export interface WeatherSample {
  t: number;
  air: number;
  track: number;
  humidity: number;
  pressure: number;
  rain: boolean;
  windSpeed: number;
  windDir: number;
}

export interface TimedValue<T> {
  t: number;
  v: T;
}

export interface Result {
  driver: number;
  pos: number | null;
  laps: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  time: number | null;
  gap: string | null;
}

export interface Radio {
  t: number;
  driver: number;
  url: string;
}

export interface Overtake {
  t: number;
  by: number;
  on: number;
  pos: number;
}

export interface Period {
  kind: 'SC' | 'VSC' | 'RED';
  start: number;
  /** When the SC peels into the pits / VSC ends / session resumes. */
  end: number;
  /** For SC: time the SC was told to come in (start of the "returning" phase). */
  inLap?: number;
}

export interface ReferencePath {
  x: Float32Array;
  y: Float32Array;
  /** cumulative arc length at each vertex */
  s: Float32Array;
  length: number;
  /** degrees to rotate the world so the circuit looks like the TV graphic */
  rotation: number;
  corners: { num: string; x: number; y: number }[];
  /** DRS zones as [startFraction, endFraction] of a lap. */
  drs: [number, number][];
  /** Sector boundaries as lap fractions (end of S1, end of S2). */
  sectors: [number, number] | null;
}

export interface SessionData {
  source: string;
  meta: SessionMeta;
  t0: number;
  drivers: Driver[];
  byNum: Map<number, Driver>;
  tracks: Map<number, DriverTrack>;
  ref: ReferencePath;
  laps: Lap[];
  lapsByDriver: Map<number, Lap[]>;
  stints: Stint[];
  pits: PitStop[];
  raceControl: RaceControlMsg[];
  weather: WeatherSample[];
  positions: Map<number, TimedValue<number>[]>;
  intervals: Map<number, TimedValue<{ gap: string | null; int: string | null }>[]>;
  results: Result[];
  grid: { driver: number; pos: number }[];
  radio: Radio[];
  overtakes: Overtake[];
  periods: Period[];
  /** total scheduled race laps (race) or max lap number seen */
  totalLaps: number;
  /** replay window */
  startT: number;
  endT: number;
  /** race only: lights-out time */
  raceStart: number;
  /** Per driver: time they took the chequered flag (race) */
  finishAt: Map<number, number>;
  /** Per driver: time they stopped for good (DNF) */
  retiredAt: Map<number, number>;
  /** Per driver: classified laps at the flag */
  finalLaps: Map<number, number>;
  /** Typical green-flag lap time, seconds */
  typicalLap: number;
}
