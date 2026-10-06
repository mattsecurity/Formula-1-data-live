import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { currentYear, getSeason, seasons, type MeetingSummary } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { flagFor } from '../model/constants';
import { Segmented } from '../ui/Segmented';
import { ErrorCard } from '../ui/ErrorCard';
import { useTilt } from '../ui/motion';
import './season.css';

const fmtRange = (a: number, b: number) => {
  const da = new Date(a);
  const db = new Date(b);
  const m = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' });
  return da.getMonth() === db.getMonth() ? `${da.getDate()}–${db.getDate()} ${m(db)}` : `${da.getDate()} ${m(da)} – ${db.getDate()} ${m(db)}`;
};

const STATUS: Record<MeetingSummary['status'], string> = {
  done: 'Concluso',
  live: 'In corso',
  next: 'Prossimo',
  upcoming: 'In programma',
};

function MeetingCard({ m, i }: { m: MeetingSummary; i: number }) {
  const tilt = useTilt(6);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: Math.min(i, 16) * 0.035, ease: [0.32, 0.72, 0, 1] }}
      style={tilt.style}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <Link to={`/meeting/${m.meeting_key}`} className={`mcard card press status-${m.status}`}>
        <motion.span className="sheen" style={{ background: tilt.sheen }} />
        <div className="mcard-top">
          <span className="mcard-round">R{String(m.round).padStart(2, '0')}</span>
          <span className={`mcard-status s-${m.status}`}>{STATUS[m.status]}</span>
        </div>
        <div className="mcard-circuit">
          {m.circuit_image ? <img src={m.circuit_image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} /> : null}
        </div>
        <div className="mcard-flag">{flagFor(m.country_code)}</div>
        <h3>{m.meeting_name}</h3>
        <p className="muted">
          {m.circuit_short_name} · {fmtRange(m.start, m.end)}
        </p>
        {m.sessions.some((s) => /sprint/i.test(s.session_name)) && <span className="chip mcard-chip">Sprint</span>}
      </Link>
    </motion.div>
  );
}

export default function SeasonPage() {
  const { year } = useParams();
  const y = Number(year) || currentYear();
  const nav = useNavigate();
  const state = useAsync((s) => getSeason(y, s), [y]);
  return (
    <main className="page">
      <div className="season-head">
        <div>
          <div className="eyebrow">Calendario</div>
          <h1 className="title-lg" style={{ margin: '6px 0 0' }}>Stagione {y}</h1>
        </div>
        <Segmented label="Stagione" value={y} onChange={(v) => nav(`/season/${v}`)} options={seasons().map((s) => ({ value: s, label: String(s) }))} />
      </div>
      {state.error && <ErrorCard error={state.error} onRetry={state.retry} />}
      <div className="mgrid">
        {state.loading && !state.data && Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 250 }} />)}
        {state.data?.map((m, i) => <MeetingCard key={m.meeting_key} m={m} i={i} />)}
      </div>
      {state.data && !state.data.length && <p className="muted">Nessun evento disponibile per questa stagione.</p>}
    </main>
  );
}
