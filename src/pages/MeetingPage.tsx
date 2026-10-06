import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { HOUR } from '../api/openf1';
import type { RawMeeting, RawSession } from '../api/types';
import { getDrivers, getResults, sourceForMeeting } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { flagFor } from '../model/constants';
import { fmtLapTime } from '../model/standings';
import { parseDate } from '../model/util';
import { ErrorCard } from '../ui/ErrorCard';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import './meeting.css';

const NAME_IT: Record<string, string> = {
  'Practice 1': 'Prove libere 1',
  'Practice 2': 'Prove libere 2',
  'Practice 3': 'Prove libere 3',
  Qualifying: 'Qualifiche',
  'Sprint Qualifying': 'Qualifiche Sprint',
  'Sprint Shootout': 'Sprint Shootout',
  Sprint: 'Sprint',
  Race: 'Gara',
};

function Results({ session }: { session: RawSession }) {
  const st = useAsync(async (signal) => {
    const [results, drivers] = await Promise.all([getResults(session.session_key, signal), getDrivers(session.session_key, signal)]);
    return { results, drivers };
  }, [session.session_key]);
  if (st.loading) return <div className="skeleton" style={{ height: 400 }} />;
  if (!st.data || !st.data.results.length) return <p className="muted">Risultati non ancora disponibili.</p>;
  const byNum = new Map(st.data.drivers.map((d) => [d.num, d]));
  const isRace = /race|sprint$/i.test(session.session_type) && !/qualifying|shootout/i.test(session.session_name);
  const rows = [...st.data.results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  return (
    <div className="results card">
      {rows.map((r, i) => {
        const d = byNum.get(r.driver_number);
        if (!d) return null;
        const dur = Array.isArray(r.duration) ? r.duration.filter((x) => x != null).at(-1) : r.duration;
        const gap = Array.isArray(r.gap_to_leader) ? r.gap_to_leader.filter((x) => x != null).at(-1) : r.gap_to_leader;
        let info = '';
        if (r.dnf) info = 'Ritirato';
        else if (r.dns) info = 'Non partito';
        else if (r.dsq) info = 'Squalificato';
        else if (i === 0 && typeof dur === 'number') info = isRace ? new Date(dur * 1000).toISOString().slice(11, 19) : fmtLapTime(dur);
        else if (typeof gap === 'number') info = `+${gap.toFixed(3)}`;
        else if (typeof gap === 'string') info = gap;
        return (
          <motion.div
            key={r.driver_number}
            className="res-row"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            style={{ ['--team' as string]: d.color }}
          >
            <span className="res-pos tabular">{r.position ?? '—'}</span>
            <span className="res-bar" />
            <Headshot driver={d} size={34} />
            <div className="res-name">
              <b>{d.full}</b>
              <span className="dim">{d.team}</span>
            </div>
            <span className="res-laps dim tabular">{r.number_of_laps ? `${r.number_of_laps} giri` : ''}</span>
            <span className="res-info tabular">{info}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function MeetingPage() {
  const { key } = useParams();
  const mk = Number(key);
  const st = useAsync(async (signal) => {
    const src = sourceForMeeting(mk);
    const [meetings, sessions] = await Promise.all([
      src.get<RawMeeting>('meetings', [['meeting_key', '=', mk]], { signal, cacheMs: 6 * HOUR }),
      src.get<RawSession>('sessions', [['meeting_key', '=', mk]], { signal, cacheMs: HOUR }),
    ]);
    return { meeting: meetings[0], sessions: sessions.sort((a, b) => parseDate(a.date_start) - parseDate(b.date_start)) };
  }, [mk]);

  if (st.error) return <main className="page"><ErrorCard error={st.error} onRetry={st.retry} /></main>;
  if (!st.data) return <main className="page"><div className="skeleton" style={{ height: 420 }} /></main>;
  const { meeting, sessions } = st.data;
  if (!meeting) return <main className="page"><p className="muted">Weekend non trovato.</p></main>;
  const now = Date.now();
  const resultSession = [...sessions].reverse().find((s) => parseDate(s.date_end) < now && (s.session_name === 'Race' || s.session_name === 'Qualifying')) ?? [...sessions].reverse().find((s) => parseDate(s.date_end) < now);

  return (
    <main className="page">
      <Link to={`/season/${meeting.year}`} className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
        <Icon name="chevronLeft" size={15} /> Stagione {meeting.year}
      </Link>
      <section className="mt-head fade-in">
        <div>
          <div className="eyebrow">
            {meeting.location} · {meeting.country_name}
          </div>
          <h1 className="title-lg" style={{ margin: '8px 0' }}>
            {flagFor(meeting.country_code)} {meeting.meeting_name}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {meeting.meeting_official_name}
          </p>
          <div className="mt-chips">
            <span className="chip">{meeting.circuit_short_name}</span>
            {meeting.circuit_type && <span className="chip">{meeting.circuit_type}</span>}
          </div>
        </div>
        {meeting.circuit_image && (
          <img className="mt-circuit" src={meeting.circuit_image} alt={`Tracciato di ${meeting.circuit_short_name}`} referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="title-md">Sessioni</h2>
        <div className="sessions">
          {sessions.map((s) => {
            const done = parseDate(s.date_end) < now - 20 * 60_000;
            const live = parseDate(s.date_start) <= now && !done;
            const d = new Date(parseDate(s.date_start));
            return (
              <div key={s.session_key} className="session card">
                <div className="session-when">
                  <b>{d.toLocaleDateString('it-IT', { weekday: 'short' })}</b>
                  <span className="dim tabular">{d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="session-name">
                  <b>{NAME_IT[s.session_name] ?? s.session_name}</b>
                  <span className="dim">{live ? 'In corso' : done ? 'Conclusa' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
                </div>
                <div className="session-actions">
                  {done ? (
                    <>
                      <Link className="btn btn-primary btn-sm" to={`/replay/${s.session_key}`}>
                        <Icon name="play" size={14} /> Replay
                      </Link>
                      <Link className="btn btn-secondary btn-sm" to={`/lab/${s.session_key}`}>
                        <Icon name="stopwatch" size={14} /> Lap Lab
                      </Link>
                    </>
                  ) : (
                    <span className="chip">{live ? 'Dati disponibili a fine sessione' : 'Non ancora disputata'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {resultSession && (
        <section style={{ marginTop: 40 }}>
          <h2 className="title-md">Classifica · {NAME_IT[resultSession.session_name] ?? resultSession.session_name}</h2>
          <Results session={resultSession} />
        </section>
      )}
    </main>
  );
}
