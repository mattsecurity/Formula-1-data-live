import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { currentYear, getChampionship, getDrivers, getResults, getSeason, latestCompletedSession, seasons } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { RACE_POINTS, SPRINT_POINTS, teamColor } from '../model/constants';
import type { Driver } from '../model/types';
import { parseDate } from '../model/util';
import { ErrorCard } from '../ui/ErrorCard';
import { Headshot } from '../ui/Headshot';
import { Segmented } from '../ui/Segmented';
import { CountUp } from '../ui/motion';
import './standings.css';

interface Row {
  key: string;
  name: string;
  sub?: string;
  color: string;
  points: number;
  pos: number;
  delta?: number;
  driver?: Driver;
}

async function loadStandings(year: number, signal: AbortSignal): Promise<{ drivers: Row[]; teams: Row[]; computed: boolean; after: string }> {
  const latest = await latestCompletedSession(year, 'Race', signal);
  if (!latest) return { drivers: [], teams: [], computed: false, after: '' };
  const key = latest.session.session_key;
  const [champ, drivers] = await Promise.all([getChampionship(key, signal), getDrivers(key, signal)]);
  const byNum = new Map(drivers.map((d) => [d.num, d]));
  const after = latest.meeting.meeting_name;
  if (champ.drivers.length) {
    return {
      after,
      computed: false,
      drivers: champ.drivers.map((c) => {
        const d = byNum.get(c.driver_number);
        return { key: String(c.driver_number), name: d?.full ?? `#${c.driver_number}`, sub: d?.team, color: d?.color ?? '#888', points: c.points_current, pos: c.position_current, delta: c.position_start - c.position_current, driver: d };
      }),
      teams: champ.teams.map((c) => ({ key: c.team_name, name: c.team_name, color: teamColor(c.team_name, drivers.find((d) => d.team === c.team_name)?.color.slice(1)), points: c.points_current, pos: c.position_current, delta: c.position_start - c.position_current })),
    };
  }
  // Fallback: compute from every Race & Sprint result of the season.
  const season = await getSeason(year, signal);
  const now = Date.now();
  const sessions = season.flatMap((m) => m.sessions).filter((s) => (s.session_name === 'Race' || s.session_name === 'Sprint') && parseDate(s.date_end) < now);
  const pts = new Map<number, number>();
  const teamPts = new Map<string, number>();
  const teamOf = new Map<number, string>();
  for (const d of drivers) teamOf.set(d.num, d.team);
  for (const s of sessions) {
    const res = await getResults(s.session_key, signal);
    const table = s.session_name === 'Sprint' ? SPRINT_POINTS : RACE_POINTS;
    for (const r of res) {
      const p = r.position && !r.dsq ? table[r.position - 1] ?? 0 : 0;
      pts.set(r.driver_number, (pts.get(r.driver_number) ?? 0) + p);
      const team = teamOf.get(r.driver_number);
      if (team) teamPts.set(team, (teamPts.get(team) ?? 0) + p);
    }
  }
  const dRows = [...pts.entries()].sort((a, b) => b[1] - a[1]).map(([num, p], i) => {
    const d = byNum.get(num);
    return { key: String(num), name: d?.full ?? `#${num}`, sub: d?.team, color: d?.color ?? '#888', points: p, pos: i + 1, driver: d };
  });
  const tRows = [...teamPts.entries()].sort((a, b) => b[1] - a[1]).map(([team, p], i) => ({ key: team, name: team, color: drivers.find((d) => d.team === team)?.color ?? '#888', points: p, pos: i + 1 }));
  return { drivers: dRows, teams: tRows, computed: true, after };
}

export default function StandingsPage() {
  const { year } = useParams();
  const y = Number(year) || currentYear();
  const nav = useNavigate();
  const [kind, setKind] = useState<'drivers' | 'teams'>('drivers');
  const st = useAsync((s) => loadStandings(y, s), [y]);
  const rows = (kind === 'drivers' ? st.data?.drivers : st.data?.teams) ?? [];
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <main className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <div className="eyebrow">Campionato del mondo</div>
          <h1 className="title-lg" style={{ margin: '6px 0 0' }}>Classifiche {y}</h1>
          {st.data?.after && <p className="muted" style={{ margin: '6px 0 0' }}>Dopo il {st.data.after}{st.data.computed ? ' · calcolata dai risultati di gare e sprint' : ''}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Segmented label="Classifica" value={kind} onChange={setKind} options={[{ value: 'drivers', label: 'Piloti' }, { value: 'teams', label: 'Costruttori' }]} />
          <Segmented label="Stagione" value={y} onChange={(v) => nav(`/standings/${v}`)} options={seasons().map((s) => ({ value: s, label: String(s) }))} />
        </div>
      </div>
      {st.error && <ErrorCard error={st.error} onRetry={st.retry} />}
      {st.loading && <div className="skeleton" style={{ height: 500 }} />}
      {!st.loading && !rows.length && !st.error && <p className="muted">Nessuna classifica disponibile per questa stagione.</p>}
      <div className="stand card">
        {rows.map((r, i) => (
          <motion.div key={r.key} className="stand-row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }} style={{ ['--team' as string]: r.color }}>
            <span className={`stand-pos tabular ${r.pos <= 3 ? `p${r.pos}` : ''}`}>{r.pos}</span>
            {r.driver ? <Headshot driver={r.driver} size={38} /> : <span className="stand-swatch" />}
            <div className="stand-name">
              <b>{r.name}</b>
              {r.sub && <span className="dim">{r.sub}</span>}
            </div>
            <div className="stand-bar" aria-hidden>
              <motion.span initial={{ width: 0 }} animate={{ width: `${(r.points / max) * 100}%` }} transition={{ duration: 1.2, delay: 0.2 + i * 0.03, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <span className="stand-delta tabular">
              {r.delta ? <span style={{ color: r.delta > 0 ? 'var(--green)' : 'var(--red)' }}>{r.delta > 0 ? `▲${r.delta}` : `▼${-r.delta}`}</span> : null}
            </span>
            <b className="stand-pts tabular"><CountUp value={r.points} /></b>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
