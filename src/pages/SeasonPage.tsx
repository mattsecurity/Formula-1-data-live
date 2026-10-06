import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { currentYear, getSeason, seasons, type MeetingSummary } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { findCircuit } from '../data/circuits';
import { CircuitOutline } from '../ui/CircuitOutline';
import { Flag } from '../ui/Flag';
import { Segmented } from '../ui/Segmented';
import { ErrorCard } from '../ui/ErrorCard';
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
  const circuit = findCircuit(m.circuit_short_name, m.location);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(i, 16) * 0.03, ease: [0.32, 0.72, 0, 1] }}
    >
      <Link to={`/meeting/${m.meeting_key}`} className={`mcard card status-${m.status}`}>
        <div className="mcard-top">
          <span className="mcard-round num">R{String(m.round).padStart(2, '0')}</span>
          <span className={`mcard-status s-${m.status}`}>{STATUS[m.status]}</span>
        </div>
        <div className="mcard-circuit">
          {circuit ? (
            <CircuitOutline circuit={circuit} width={220} height={120} stroke={1.8} />
          ) : m.circuit_image ? (
            <img src={m.circuit_image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : null}
        </div>
        <div className="mcard-meta">
          <Flag code={m.country_code} url={m.country_flag} />
          <span>{m.country_name}</span>
          {m.sessions.some((s) => /sprint/i.test(s.session_name)) && <span className="mcard-chip">Sprint</span>}
        </div>
        <h3>{m.meeting_name}</h3>
        <p>
          <span>{m.circuit_short_name}</span>
          <span className="num">{fmtRange(m.start, m.end)}</span>
        </p>
        {circuit && <div className="mcard-len num">{(circuit.length / 1000).toFixed(3)} km</div>}
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
