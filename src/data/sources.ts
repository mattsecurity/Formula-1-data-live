import { DemoSource, isDemoKey, DEMO_MEETING_KEY } from '../api/demo';
import { HOUR, OpenF1Source, type DataSource } from '../api/openf1';
import type { RawChampionshipDriver, RawChampionshipTeam, RawDriver, RawMeeting, RawResult, RawSession } from '../api/types';
import { teamColor } from '../model/constants';
import type { Driver } from '../model/types';
import { parseDate } from '../model/util';

export const openf1 = new OpenF1Source();
export const demo = new DemoSource();

export function sourceForSession(key: number): DataSource {
  return isDemoKey(key) ? demo : openf1;
}
export function sourceForMeeting(key: number): DataSource {
  return key === DEMO_MEETING_KEY ? demo : openf1;
}

export const FIRST_YEAR = 2023;
export function currentYear() {
  return new Date().getFullYear();
}
export function seasons(): number[] {
  const out: number[] = [];
  for (let y = currentYear(); y >= FIRST_YEAR; y--) out.push(y);
  return out;
}

export interface MeetingSummary extends RawMeeting {
  round: number;
  sessions: RawSession[];
  start: number;
  end: number;
  status: 'done' | 'live' | 'next' | 'upcoming';
}

const isTesting = (m: RawMeeting) => /test/i.test(m.meeting_name);

export async function getSeason(year: number, signal?: AbortSignal): Promise<MeetingSummary[]> {
  const isPast = year < currentYear();
  const cacheMs = isPast ? Infinity : 6 * HOUR;
  const [meetings, sessions] = await Promise.all([
    openf1.get<RawMeeting>('meetings', [['year', '=', year]], { signal, cacheMs }),
    openf1.get<RawSession>('sessions', [['year', '=', year]], { signal, cacheMs }),
  ]);
  const now = Date.now();
  const list = meetings
    .filter((m) => !isTesting(m) && !m.is_cancelled)
    .map((m) => {
      const ss = sessions.filter((s) => s.meeting_key === m.meeting_key).sort((a, b) => parseDate(a.date_start) - parseDate(b.date_start));
      const start = parseDate(ss[0]?.date_start ?? m.date_start);
      const end = parseDate(ss.at(-1)?.date_end ?? m.date_end ?? m.date_start);
      return { ...m, sessions: ss, start, end, round: 0, status: 'upcoming' as MeetingSummary['status'] };
    })
    .sort((a, b) => a.start - b.start);
  let nextMarked = false;
  list.forEach((m, i) => {
    m.round = i + 1;
    if (now > m.end) m.status = 'done';
    else if (now >= m.start) m.status = 'live';
    else if (!nextMarked) {
      m.status = 'next';
      nextMarked = true;
    }
  });
  return list;
}

export function toDriver(d: RawDriver): Driver {
  const last = d.last_name ?? d.full_name?.split(' ').slice(1).join(' ') ?? d.name_acronym;
  return {
    num: d.driver_number,
    code: d.name_acronym,
    first: d.first_name ?? d.full_name?.split(' ')[0] ?? '',
    last: last ? last.charAt(0) + last.slice(1).toLowerCase() : '',
    full: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : (d.full_name ?? d.name_acronym),
    team: d.team_name ?? '—',
    color: teamColor(d.team_name, d.team_colour),
    headshot: d.headshot_url ? d.headshot_url.replace('/1col/', '/2col/') : undefined,
    country: d.country_code ?? undefined,
  };
}

/** Latest race (or any) session with results, for a season. */
export async function latestCompletedSession(year: number, kind: 'Race' | 'any' = 'Race', signal?: AbortSignal) {
  const season = await getSeason(year, signal);
  const now = Date.now();
  for (let i = season.length - 1; i >= 0; i--) {
    const ss = season[i].sessions.filter((s) => parseDate(s.date_end) < now - 30 * 60_000 && (kind === 'any' || s.session_type === 'Race'));
    const race = ss.filter((s) => s.session_name === 'Race').at(-1) ?? ss.at(-1);
    if (race) return { meeting: season[i], session: race };
  }
  return null;
}

export async function getDrivers(sessionKey: number, signal?: AbortSignal): Promise<Driver[]> {
  const rows = await sourceForSession(sessionKey).get<RawDriver>('drivers', [['session_key', '=', sessionKey]], { signal, cacheMs: 12 * HOUR });
  const seen = new Set<number>();
  return rows.filter((r) => !seen.has(r.driver_number) && seen.add(r.driver_number)).map(toDriver);
}

export async function getResults(sessionKey: number, signal?: AbortSignal) {
  return sourceForSession(sessionKey).get<RawResult>('session_result', [['session_key', '=', sessionKey]], { signal, cacheMs: 12 * HOUR });
}

export async function getChampionship(sessionKey: number, signal?: AbortSignal) {
  const [drivers, teams] = await Promise.all([
    openf1.get<RawChampionshipDriver>('championship_drivers', [['session_key', '=', sessionKey]], { signal, cacheMs: 12 * HOUR }).catch(() => []),
    openf1.get<RawChampionshipTeam>('championship_teams', [['session_key', '=', sessionKey]], { signal, cacheMs: 12 * HOUR }).catch(() => []),
  ]);
  return {
    drivers: [...drivers].sort((a, b) => a.position_current - b.position_current),
    teams: [...teams].sort((a, b) => a.position_current - b.position_current),
  };
}
