import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_MEETING_KEY, DEMO_QUALI_KEY, DEMO_RACE_KEY } from '../api/demo';
import { currentYear, getDrivers, getResults, getSeason, latestCompletedSession } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { flagFor } from '../model/constants';
import { parseDate } from '../model/util';
import { CarArt } from '../ui/CarArt';
import { Headshot } from '../ui/Headshot';
import { Icon, type IconName } from '../ui/Icon';
import { CountUp, EASE, Reveal, WordsReveal, useTilt } from '../ui/motion';
import './home.css';

const FEATURES: { icon: IconName; title: string; text: string; color: string }[] = [
  { icon: 'play', title: 'Replay di ogni gara', text: 'Rivivi gare, sprint, qualifiche e prove libere dal 2023 con le posizioni reali delle monoposto in pista.', color: '#ff453a' },
  { icon: 'list', title: 'Classifica che vive', text: 'L’ordine si aggiorna in tempo reale a ogni sorpasso in pista, con distacchi live, gomme e pit stop.', color: '#30d158' },
  { icon: 'gauge', title: 'Telemetria di bordo', text: 'Velocità, marcia, giri motore, acceleratore, freno e DRS di ogni pilota, sincronizzati con il replay.', color: '#0a84ff' },
  { icon: 'chart', title: 'Analisi da muretto', text: 'Tempi sul giro, distacchi, lap chart, strategie gomme, settori viola e pit stop più veloci.', color: '#bf5af2' },
  { icon: 'stopwatch', title: 'Lap Lab', text: 'Confronta i giri più veloci di più piloti curva per curva, con il delta tempo metro per metro.', color: '#ff9f0a' },
  { icon: 'radio', title: 'Team radio e direzione gara', text: 'Ascolta i team radio ufficiali e segui bandiere, Safety Car e penalità nel momento in cui accadono.', color: '#40c8e0' },
];

function SpeedLines() {
  return (
    <div className="speed-lines" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ top: `${18 + ((i * 37) % 64)}%`, animationDelay: `${(i * 0.37) % 2.4}s`, width: `${80 + ((i * 53) % 160)}px`, opacity: 0.25 + ((i * 7) % 5) / 10 }} />
      ))}
    </div>
  );
}

function FeatureCard({ f, i }: { f: (typeof FEATURES)[number]; i: number }) {
  const tilt = useTilt(7);
  return (
    <motion.article
      className="feature card shine-sweep"
      initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay: (i % 3) * 0.08, ease: EASE }}
      style={{ ...tilt.style, ['--accent' as string]: f.color }}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <motion.span className="sheen" style={{ background: tilt.sheen }} />
      <motion.span
        className="feature-icon"
        style={{ background: `${f.color}22`, color: f.color }}
        whileHover={{ scale: 1.12, rotate: -6 }}
        transition={{ type: 'spring', stiffness: 400, damping: 14 }}
      >
        <Icon name={f.icon} size={22} />
      </motion.span>
      <h3>{f.title}</h3>
      <p className="muted">{f.text}</p>
    </motion.article>
  );
}

function Hero() {
  const latest = useAsync((s) => latestCompletedSession(currentYear(), 'Race', s), []);
  // A custom photo can be dropped in public/img/hero.jpg; otherwise the vector car is shown.
  const [imgOk, setImgOk] = useState(false);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgOk(true);
    img.src = './img/hero.jpg';
  }, []);
  // pointer parallax
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 80, damping: 18 });
  const sy = useSpring(py, { stiffness: 80, damping: 18 });
  const carX = useTransform(sx, (v) => v * -18);
  const carY = useTransform(sy, (v) => v * -10);
  const glowX = useTransform(sx, (v) => v * 40);
  return (
    <section
      className="hero"
      onPointerMove={(e) => {
        px.set(e.clientX / window.innerWidth - 0.5);
        py.set(e.clientY / window.innerHeight - 0.5);
      }}
    >
      <motion.div className="hero-bg" aria-hidden style={{ x: glowX }} />
      <div className="hero-copy">
        <motion.div className="eyebrow" initial={{ opacity: 0, letterSpacing: '0.3em' }} animate={{ opacity: 1, letterSpacing: '0.08em' }} transition={{ duration: 1.2, ease: EASE }}>
          Formula 1 · Replay e telemetria
        </motion.div>
        <h1 className="title-xl">
          <WordsReveal text="Ogni sorpasso." delay={0.15} />
          <br />
          <WordsReveal text="Ogni dato." delay={0.45} className="gradient-text gradient-anim" />
        </h1>
        <motion.p className="hero-sub muted" initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }} transition={{ duration: 0.9, delay: 0.75, ease: EASE }}>
          Il tuo muretto box personale: rivivi ogni Gran Premio con la telemetria reale, una classifica che cambia a ogni
          sorpasso e le analisi che usano i team.
        </motion.p>
        <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.95, ease: EASE }}>
          {latest.data ? (
            <Link className="btn btn-primary" to={`/replay/${latest.data.session.session_key}`}>
              <Icon name="play" size={16} /> Guarda {latest.data.meeting.meeting_name.replace('Grand Prix', 'GP')}
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/season">
              <Icon name="calendar" size={16} /> Scegli una gara
            </Link>
          )}
          <Link className="btn btn-secondary" to={`/replay/${DEMO_RACE_KEY}`}>
            Prova la demo offline
          </Link>
        </motion.div>
      </div>
      <motion.div className="hero-car" style={{ x: carX, y: carY }}>
        {!arrived && <SpeedLines />}
        <motion.div
          initial={{ x: '75vw', skewX: -8, filter: 'blur(14px)' }}
          animate={{ x: 0, skewX: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          onAnimationComplete={() => setArrived(true)}
        >
          {imgOk ? (
            <img src="./img/hero.jpg" alt="Monoposto di Formula 1" className="hero-photo" />
          ) : (
            <>
              <CarArt color="#d10a0a" accent="#ffffff" number={16} compound="SOFT" className={`hero-svg ${arrived ? 'idle' : ''}`} spinning={!arrived} title="Monoposto di Formula 1" />
              <div className="hero-reflection" aria-hidden>
                <CarArt color="#d10a0a" accent="#ffffff" number={16} compound="SOFT" className={`hero-svg ${arrived ? 'idle' : ''}`} spinning={!arrived} />
              </div>
            </>
          )}
        </motion.div>
        <motion.div className="hero-floor" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 1.4, delay: 0.9, ease: EASE }} aria-hidden />
      </motion.div>
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
  if (state.loading) return <div className="skeleton" style={{ height: 300 }} />;
  if (!state.data) return null;
  const { meeting, session, results, drivers } = state.data;
  const byNum = new Map(drivers.map((d) => [d.num, d]));
  const podium = results
    .filter((r) => r.position != null && r.position <= 3)
    .sort((a, b) => a.position! - b.position!)
    .map((r) => byNum.get(r.driver_number))
    .filter(Boolean);
  const order = [podium[1], podium[0], podium[2]];
  return (
    <motion.section
      className="latest card"
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: EASE }}
    >
      <div className="latest-info">
        <div className="eyebrow">Ultimo Gran Premio</div>
        <h2 className="title-lg" style={{ margin: '6px 0 4px' }}>
          {flagFor(meeting.country_code)} {meeting.meeting_name}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {meeting.circuit_short_name} · {new Date(parseDate(session.date_start)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="latest-cta">
          <Link className="btn btn-primary" to={`/replay/${session.session_key}`}>
            <Icon name="play" size={16} /> Replay gara
          </Link>
          <Link className="btn btn-secondary" to={`/meeting/${meeting.meeting_key}`}>
            Tutte le sessioni
          </Link>
        </div>
      </div>
      {podium.length === 3 && (
        <div className="podium" aria-label="Podio">
          {order.map((d, i) =>
            d ? (
              <motion.div
                key={d.num}
                className={`podium-step step-${[2, 1, 3][i]}`}
                style={{ ['--team' as string]: d.color }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 + [0.25, 0.5, 0.1][i], ease: EASE }}
              >
                <Headshot driver={d} size={[2, 1, 3][i] === 1 ? 96 : 76} />
                <b>{d.code}</b>
                <span className="dim">{d.team}</span>
                <motion.div
                  className="podium-block"
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: [0.25, 0.5, 0.1][i] }}
                  style={{ transformOrigin: 'bottom' }}
                >
                  {[2, 1, 3][i]}
                </motion.div>
              </motion.div>
            ) : null,
          )}
        </div>
      )}
    </motion.section>
  );
}

function NextRace() {
  const s = useAsync((signal) => getSeason(currentYear(), signal), []);
  const next = s.data?.find((m) => m.status === 'next' || m.status === 'live');
  if (!next) return null;
  const days = Math.max(0, Math.ceil((next.start - Date.now()) / 86_400_000));
  return (
    <Link to={`/meeting/${next.meeting_key}`} className="next card press">
      <div>
        <div className="eyebrow">{next.status === 'live' ? 'In corso adesso' : 'Prossimo weekend'}</div>
        <div className="title-md" style={{ marginTop: 4 }}>
          {flagFor(next.country_code)} {next.meeting_name}
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          {next.circuit_short_name} · Round {next.round}
        </div>
      </div>
      <div className="next-count">
        <b className="tabular">{next.status === 'live' ? 'LIVE' : <CountUp value={days} />}</b>
        {next.status !== 'live' && <span className="dim">{days === 1 ? 'giorno' : 'giorni'}</span>}
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main>
      <Hero />
      <div className="page" style={{ paddingTop: 24 }}>
        <div className="home-grid">
          <LatestWeekend />
          <NextRace />
        </div>

        <section className="features">
          <Reveal>
            <div className="eyebrow">Cosa puoi fare</div>
            <h2 className="title-lg" style={{ margin: '8px 0 28px' }}>Tutto il weekend, in un unico posto.</h2>
          </Reveal>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} f={f} i={i} />
            ))}
          </div>
        </section>

        <Reveal>
        <section className="demo-band card shine-sweep">
          <div>
            <div className="eyebrow">Nessuna connessione? Nessun problema</div>
            <h2 className="title-md" style={{ margin: '6px 0' }}>Demo Grand Prix — una gara simulata completa</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
              18 giri con sorpassi, Safety Car, pit stop, un ritiro e qualifiche: perfetta per scoprire tutte le funzioni senza
              scaricare nulla.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-secondary" to={`/replay/${DEMO_RACE_KEY}`}>
              Gara demo
            </Link>
            <Link className="btn btn-secondary" to={`/lab/${DEMO_QUALI_KEY}`}>
              Lap Lab demo
            </Link>
            <Link className="btn btn-secondary" to={`/meeting/${DEMO_MEETING_KEY}`}>
              Weekend demo
            </Link>
          </div>
        </section>
        </Reveal>

        <footer className="footer dim">
          <p>
            Dati da <a href="https://openf1.org" target="_blank" rel="noreferrer">OpenF1</a> (API open source, nessun account
            richiesto). Ispirato a{' '}
            <a href="https://github.com/IAmTomShaw/f1-race-replay" target="_blank" rel="noreferrer">
              f1-race-replay
            </a>{' '}
            di Tom Shaw e dei suoi contributor.
          </p>
          <p>
            Progetto non ufficiale, senza scopo di lucro. Formula 1, F1 e i marchi correlati appartengono ai rispettivi
            proprietari.
          </p>
        </footer>
      </div>
    </main>
  );
}
