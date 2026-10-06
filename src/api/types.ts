// Raw record shapes returned by the OpenF1 REST API (https://openf1.org).
// Only the fields the app reads are declared.

export interface RawMeeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name?: string;
  location: string;
  country_name: string;
  country_code?: string;
  circuit_key?: number;
  circuit_short_name: string;
  circuit_type?: string;
  circuit_image?: string;
  circuit_info_url?: string;
  country_flag?: string;
  date_start: string;
  date_end?: string;
  gmt_offset?: string;
  is_cancelled?: boolean;
  year: number;
}

export interface RawSession {
  session_key: number;
  session_name: string;
  session_type: string;
  meeting_key: number;
  date_start: string;
  date_end: string;
  gmt_offset?: string;
  circuit_key?: number;
  circuit_short_name: string;
  country_name: string;
  country_code?: string;
  location: string;
  year: number;
  is_cancelled?: boolean;
}

export interface RawDriver {
  driver_number: number;
  broadcast_name?: string;
  full_name?: string;
  first_name?: string | null;
  last_name?: string | null;
  name_acronym: string;
  team_name?: string | null;
  team_colour?: string | null;
  headshot_url?: string | null;
  country_code?: string | null;
}

export interface RawLocation {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z?: number;
}

export interface RawCarData {
  date: string;
  driver_number: number;
  speed: number;
  rpm: number;
  n_gear: number;
  throttle: number;
  brake: number;
  drs: number;
}

export interface RawLap {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed?: number | null;
  i2_speed?: number | null;
  st_speed?: number | null;
  is_pit_out_lap: boolean;
  segments_sector_1?: (number | null)[] | null;
  segments_sector_2?: (number | null)[] | null;
  segments_sector_3?: (number | null)[] | null;
}

export interface RawStint {
  driver_number: number;
  stint_number: number;
  lap_start: number | null;
  lap_end: number | null;
  compound: string | null;
  tyre_age_at_start: number | null;
}

export interface RawPit {
  date: string;
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  lane_duration?: number | null;
  stop_duration?: number | null;
}

export interface RawPosition {
  date: string;
  driver_number: number;
  position: number;
}

export interface RawInterval {
  date: string;
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}

export interface RawRaceControl {
  date: string;
  category: string;
  flag: string | null;
  message: string;
  lap_number: number | null;
  scope: string | null;
  sector: number | null;
  driver_number: number | null;
  qualifying_phase?: number | null;
}

export interface RawWeather {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_speed: number;
  wind_direction: number;
}

export interface RawResult {
  driver_number: number;
  position: number | null;
  number_of_laps: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | number[] | null;
  gap_to_leader: number | string | (number | string | null)[] | null;
}

export interface RawGrid {
  driver_number: number;
  position: number;
  lap_duration?: number | null;
}

export interface RawRadio {
  date: string;
  driver_number: number;
  recording_url: string;
}

export interface RawOvertake {
  date: string;
  overtaking_driver_number: number;
  overtaken_driver_number: number;
  position: number;
}

export interface RawChampionshipDriver {
  driver_number: number;
  points_current: number;
  points_start: number;
  position_current: number;
  position_start: number;
  session_key: number;
}

export interface RawChampionshipTeam {
  team_name: string;
  points_current: number;
  points_start: number;
  position_current: number;
  position_start: number;
  session_key: number;
}

export interface RawCircuitInfo {
  x?: number[];
  y?: number[];
  rotation?: number;
  corners?: { number: number; letter?: string; angle?: number; trackPosition: { x: number; y: number } }[];
}

export type QueryValue = string | number | boolean;
/** Filters are passed as `[key, op, value]` triples, e.g. ['date', '>=', iso]. */
export type Filter = [string, '=' | '>' | '>=' | '<' | '<=', QueryValue];
