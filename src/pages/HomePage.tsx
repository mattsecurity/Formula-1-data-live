import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { DEMO_MEETING_KEY, DEMO_QUALI_KEY, DEMO_RACE_KEY } from '../api/demo';
import { circuitById, findCircuit } from '../data/circuits';
import { currentYear, getDrivers, getResults, getSeason, latestCompletedSession } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { parseDate } from '../model/util';
import { CircuitOutline } from '../ui/CircuitOutline';
import { Headshot } from '../ui/Headshot';
import { Icon, type IconName } from '../ui/Icon';
import { CountUp, EASE, Reveal } from '../ui/motion';
import './home.css';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'play', title: 'Replay della sessione', text: 'Gare, sprint, qualifiche e prove libere dal 2023, con le posizioni GPS reali di tutte le monoposto.' },
  { icon: 'list', title: 'Torre dei tempi live', text: 'Ordine calcolato dalla posizione in pista: si aggiorna nell’istante del sorpasso, con intervalli, gomme e soste.' },
  { icon: 'gauge', title: 'Telemetria di bordo', text: 'Velocità, marcia, RPM, gas, freno, DRS, delta live sul giro personale e minisettori.' },
  { icon: 'layers', title: 'Circuito in dettaglio', text: 'Cordoli, corsia box, griglia, settori, zone DRS, curve numerate con il loro nome e mappa delle velocità.' },
  { icon: 'chart', title: 'Analisi da muretto', text: 'Tempi sul giro, distacchi, lap chart, strategie gomme, settori viola, pit stop e mondiale live.' },
  { icon: 'stopwatch', title: 'Lap Lab', text: 'Confronto dei giri metro per metro: delta tempo, tracce di telemetria e mini-settori dominanti.' },
];

const HERO_CARS = [
  { color: '#ff8000', lap: 9.6, offset: 0 },
  { color: '#e8002d', lap: 9.75, offset: 0.35 },
  { color: '#3671c6', lap: 9.9, offset: 0.7 },
  { color: '#27f4d2', lap: 10.05, offset: 1.1 },
];

function Hero() {
  const latest = useAsync((s) => latestCompletedSession(currentYear(), 'Race', s), []);
  const circuit =
    (latest.data && findCircuit(latest.data.meeting.circuit_short_name, latest.data.meeting.location)) || circuitById('it-1922')!;
  return (
    <section className="hero">
      <div className="hero-copy">
        <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          Formula 1 · Replay · Telemetria
        </motion.div>
        <motion.h1
          className="title-xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
        >
          Il muretto box,
          <br />
          <span className="dim-2">nel tuo browser.</span>
        </motion.h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}>
          Rivivi ogni sessione con i dati reali del cronometraggio: posizioni in pista, telemetria di ogni monoposto e
          un’analisi completa, giro dopo giro.
        </motion.p>
        <motion.div className="hero-cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.4 }}>
          {latest.data ? (
            <Link className="btn btn-primary" to={`/replay/${latest.data.session.session_key}`}>
              <Icon name="play" size={14} /> {latest.data.meeting.meeting_name}
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/season">
              Scegli una gara
            </Link>
          )}
          <Link className="btn btn-secondary" to={`/replay/${DEMO_RACE_KEY}`}>
            Demo offline · Monza
          </Link>
        </motion.div>
      </div>
      <motion.figure className="hero-map" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: EASE }}>
        <CircuitOutline circuit={circuit} width={640} height={520} stroke={3} animate glow cars={HERO_CARS} className="hero-svg" />
        <figcaption className="hero-cap">
          <div>
            <span className="label">Circuito</span>
            <b>{circuit.name}</b>
          </div>
          <div>
            <span className="label">Lunghezza</span>
            <b className="num">{(circuit.length / 1000).toFixed(3)} km</b>
          </div>
          {circuit.firstGp && (
            <div>
              <span className="label">Primo GP</span>
              <b className="num">{circuit.firstGp}</b>
            </div>
          )}
        </figcaption>
      </motion.figure>
    </section>
  );
}

function LatestWeekend() {
  const state = useAsync(async (signal) => {
    const latest = await latestCompletedSession(currentYear(), 'Race', signal);
    if (!latest) return null;
    const [results, drivers] = await Promise.all([getResults(latest.session.session_key, signal), getDrivers(latest.session.session_key, signal)]);
    return { ...latest, results, drivers };
  }, []);
  if (state.loading) return <div className="skeleton" style={{ height: 260 }} />;
  if (!state.data) return null;
  const { meeting, session, results, drivers } = state.data;
  const byNum = new Map(drivers.map((d) => [d.num, d]));
  const top = results
    .filter((r) => r.position != null && r.position <= 3)
    .sort((a, b) => a.position! - b.position!)
    .map((r) => ({ r, d: byNum.get(r.driver_number) }))
    .filter((x) => x.d);
  const circuit = findCircuit(meeting.circuit_short_name, meeting.location);
  return (
    <motion.section className="latest card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}>
      <div className="latest-info">
        <div className="label">Ultimo Gran Premio · Round {meeting.round}</div>
        <h2 className="title-lg" style={{ margin: '8px 0 4px' }}>
          {meeting.meeting_name}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {meeting.circuit_short_name} · {new Date(parseDate(session.date_start)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <ol className="podium">
          {top.map(({ r, d }, i) => (
            <motion.li
              key={d!.num}
              style={{ ['--team' as string]: d!.color }}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: EASE }}
            >
              <span className="pd-pos num">{r.position}</span>
              <Headshot driver={d!} size={40} />
              <span className="pd-name">
                <b>{d!.full}</b>
                <span>{d!.team}</span>
              </span>
              <span className="pd-gap num">
                {i === 0
                  ? 'Vincitore'
                  : typeof r.gap_to_leader === 'number'
                    ? `+${r.gap_to_leader.toFixed(3)}`
                    : Array.isArray(r.gap_to_leader)
                      ? ''
                      : (r.gap_to_leader ?? '')}
              </span>
            </motion.li>
          ))}
        </ol>
        <div className="latest-cta">
          <Link className="btn btn-primary" to={`/replay/${session.session_key}`}>
            <Icon name="play" size={14} /> Replay gara
          </Link>
          <Link className="btn btn-secondary" to={`/meeting/${meeting.meeting_key}`}>
            Weekend completo
          </Link>
        </div>
      </div>
      {circuit && <CircuitOutline circuit={circuit} width={360} height={300} stroke={2.4} className="latest-map" />}
    </motion.section>
  );
}

function NextRace() {
  const s = useAsync((signal) => getSeason(currentYear(), signal), []);
  const next = s.data?.find((m) => m.status === 'next' || m.status === 'live');
  if (!next) return null;
  const days = Math.max(0, Math.ceil((next.start - Date.now()) / 86_400_000));
  const circuit = findCircuit(next.circuit_short_name, next.location);
  return (
    <Link to={`/meeting/${next.meeting_key}`} className="next card press">
      {circuit && <CircuitOutline circuit={circuit} width={120} height={90} stroke={1.6} className="next-map" showStart={false} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label">{next.status === 'live' ? 'In corso' : 'Prossimo appuntamento'} · Round {next.round}</div>
        <div className="title-md" style={{ marginTop: 4 }}>
          {next.meeting_name}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {next.circuit_short_name} · {new Date(next.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
        </div>
      </div>
      <div className="next-count">
        <b className="num">{next.status === 'live' ? 'LIVE' : <CountUp value={days} />}</b>
        {next.status !== 'live' && <span className="label">{days === 1 ? 'giorno' : 'giorni'}</span>}
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main>
      <Hero />
      <div className="page" style={{ paddingTop: 8 }}>
        <div className="home-grid">
          <LatestWeekend />
          <NextRace />
        </div>

        <section className="features">
          <Reveal>
            <div className="eyebrow">Funzioni</div>
            <h2 className="title-lg" style={{ margin: '8px 0 26px' }}>Tutto il weekend, con i dati reali.</h2>
          </Reveal>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06} y={18}>
                <article className="feature card">
                  <span className="feature-icon">
                    <Icon name={f.icon} size={18} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal>
          <section className="demo-band card">
            <CircuitOutline circuit={circuitById('it-1922')!} width={150} height={110} stroke={1.8} className="demo-map" cars={HERO_CARS.slice(0, 2)} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="label">Demo offline</div>
              <h2 className="title-md" style={{ margin: '6px 0' }}>Gran Premio d’Italia simulato a Monza</h2>
              <p className="muted" style={{ margin: 0, maxWidth: 560, fontSize: 14 }}>
                18 giri sul tracciato reale con sorpassi, Safety Car, pit stop e un ritiro, più una qualifica per il Lap Lab.
                Funziona anche senza connessione.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn-secondary btn-sm" to={`/replay/${DEMO_RACE_KEY}`}>
                Gara
              </Link>
              <Link className="btn btn-secondary btn-sm" to={`/lab/${DEMO_QUALI_KEY}`}>
                Lap Lab
              </Link>
              <Link className="btn btn-secondary btn-sm" to={`/meeting/${DEMO_MEETING_KEY}`}>
                Weekend
              </Link>
            </div>
          </section>
        </Reveal>

        <footer className="footer">
          <p>
            Dati: <a href="https://openf1.org" target="_blank" rel="noreferrer">OpenF1</a> · Tracciati:{' '}
            <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">bacinger/f1-circuits</a> · Basato su{' '}
            <a href="https://github.com/IAmTomShaw/f1-race-replay" target="_blank" rel="noreferrer">f1-race-replay</a> di Tom Shaw e
            contributor.
          </p>
          <p>Progetto non ufficiale e senza scopo di lucro. Formula 1, F1 e i marchi correlati appartengono ai rispettivi proprietari.</p>
        </footer>
      </div>
    </main>
  );
}
