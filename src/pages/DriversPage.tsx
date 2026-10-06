import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DEMO_RACE_KEY } from '../api/demo';
import { currentYear, getChampionship, getDrivers, latestCompletedSession, seasons } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { flagFor } from '../model/constants';
import type { Driver } from '../model/types';
import { CarArt } from '../ui/CarArt';
import { ErrorCard } from '../ui/ErrorCard';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { CountUp, useTilt } from '../ui/motion';
import './drivers.css';

interface Champ {
  pos: number;
  points: number;
}

function DriverCard({ d, champ, onOpen, i }: { d: Driver; champ?: Champ; onOpen: () => void; i: number }) {
  const tilt = useTilt(10);
  return (
    <motion.button
      className="dcard"
      onClick={onOpen}
      style={{ ['--team' as string]: d.color, ...tilt.style }}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(i, 16) * 0.03, ease: [0.32, 0.72, 0, 1] }}
      aria-label={`${d.full}, ${d.team}`}
    >
      <motion.span className="sheen" style={{ background: tilt.sheen }} />
      <span className="dcard-num" aria-hidden>
        {d.num}
      </span>
      <div className="dcard-photo">
        {d.headshot ? (
          <Headshot driver={d} size={150} ring={false} />
        ) : (
          <Headshot driver={d} size={110} ring={false} />
        )}
      </div>
      <div className="dcard-info">
        <span className="dcard-first">{d.first}</span>
        <span className="dcard-last">{d.last}</span>
        <span className="dcard-team">
          {flagFor(d.country)} {d.team}
        </span>
      </div>
      {champ && (
        <span className="dcard-pts tabular">
          P{champ.pos} · {champ.points} pt
        </span>
      )}
    </motion.button>
  );
}

function DrivingCar({ color, number, team }: { color: string; number: number; team: string }) {
  const [moving, setMoving] = useState(true);
  return (
    <motion.div
      initial={{ x: '-110%', skewX: 10 }}
      animate={{ x: 0, skewX: 0 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      onAnimationComplete={() => setMoving(false)}
    >
      <CarArt color={color} number={number} className="dsheet-car" spinning={moving} title={`Monoposto ${team}`} />
    </motion.div>
  );
}

function DriverSheet({ d, champ, sessionKey, onClose }: { d: Driver; champ?: Champ; sessionKey?: number; onClose: () => void }) {
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="dsheet glass glass-strong"
        role="dialog"
        aria-modal="true"
        aria-label={d.full}
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        style={{ ['--team' as string]: d.color }}
      >
        <button className="icon-btn dsheet-close" onClick={onClose} aria-label="Chiudi">
          <Icon name="close" />
        </button>
        <div className="dsheet-hero">
          <span className="dsheet-num">{d.num}</span>
          <Headshot driver={d} size={160} />
          <div>
            <div className="eyebrow">{d.team}</div>
            <h2 className="title-lg" style={{ margin: '6px 0' }}>
              {d.first} <span style={{ color: d.color }}>{d.last}</span>
            </h2>
            <div className="muted">
              {flagFor(d.country)} {d.country ?? ''} · #{d.num} · {d.code}
            </div>
          </div>
        </div>
        <DrivingCar color={d.color} number={d.num} team={d.team} />
        <div className="dsheet-stats">
          <div>
            <span className="dim">Mondiale</span>
            <b>{champ ? <>P<CountUp value={champ.pos} duration={0.8} /></> : '—'}</b>
          </div>
          <div>
            <span className="dim">Punti</span>
            <b className="tabular">{champ ? <CountUp value={champ.points} /> : '—'}</b>
          </div>
          <div>
            <span className="dim">Numero</span>
            <b>{d.num}</b>
          </div>
        </div>
        {sessionKey && (
          <Link className="btn btn-primary" to={`/replay/${sessionKey}`} style={{ alignSelf: 'flex-start' }}>
            <Icon name="play" size={15} /> Guarda la sua ultima gara
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function DriversPage() {
  const { year } = useParams();
  const y = Number(year) || currentYear();
  const nav = useNavigate();
  const [open, setOpen] = useState<Driver | null>(null);
  const [view, setView] = useState<'drivers' | 'teams'>('drivers');
  const st = useAsync(async (signal) => {
    const latest = await latestCompletedSession(y, 'Race', signal);
    if (!latest) return { drivers: [] as Driver[], champ: new Map<number, Champ>(), sessionKey: undefined as number | undefined };
    const [drivers, champ] = await Promise.all([
      getDrivers(latest.session.session_key, signal),
      getChampionship(latest.session.session_key, signal),
    ]);
    return {
      drivers,
      champ: new Map(champ.drivers.map((c) => [c.driver_number, { pos: c.position_current, points: c.points_current }])),
      sessionKey: latest.session.session_key,
    };
  }, [y]);
  const demo = useAsync(async (signal) => (st.error ? getDrivers(DEMO_RACE_KEY, signal) : []), [st.error]);
  const drivers = st.data?.drivers.length ? st.data.drivers : (demo.data ?? []);
  const champ = st.data?.champ ?? new Map<number, Champ>();
  const sorted = [...drivers].sort((a, b) => (champ.get(a.num)?.pos ?? 99) - (champ.get(b.num)?.pos ?? 99) || a.team.localeCompare(b.team));
  const teams = [...new Set(sorted.map((d) => d.team))].map((team) => ({ team, drivers: sorted.filter((d) => d.team === team) }));

  return (
    <main className="page">
      <div className="season-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <div className="eyebrow">La griglia</div>
          <h1 className="title-lg" style={{ margin: '6px 0 0' }}>Piloti e monoposto {y}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Segmented label="Vista" value={view} onChange={setView} options={[{ value: 'drivers', label: 'Piloti' }, { value: 'teams', label: 'Team' }]} />
          <Segmented label="Stagione" value={y} onChange={(v) => nav(`/drivers/${v}`)} options={seasons().map((s) => ({ value: s, label: String(s) }))} />
        </div>
      </div>
      {st.error && <ErrorCard error={st.error} onRetry={st.retry} />}
      {st.error && drivers.length > 0 && <p className="dim" style={{ marginTop: -8 }}>Mostro la griglia della demo offline.</p>}
      {st.loading && !drivers.length && (
        <div className="dgrid">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 300 }} />
          ))}
        </div>
      )}
      {view === 'drivers' ? (
        <div className="dgrid">
          {sorted.map((d, i) => (
            <DriverCard key={d.num} d={d} champ={champ.get(d.num)} onOpen={() => setOpen(d)} i={i} />
          ))}
        </div>
      ) : (
        <div className="tgrid">
          {teams.map((t, i) => (
            <motion.article
              key={t.team}
              className="tcard card"
              style={{ ['--team' as string]: t.drivers[0].color }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="tcard-head">
                <h3>{t.team}</h3>
                <span className="dim tabular">{t.drivers.reduce((a, d) => a + (champ.get(d.num)?.points ?? 0), 0)} pt</span>
              </div>
              <motion.div initial={{ x: -80, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.04 }}>
                <CarArt color={t.drivers[0].color} number={t.drivers[0].num} className="tcard-car" title={`Monoposto ${t.team}`} />
              </motion.div>
              <div className="tcard-drivers">
                {t.drivers.map((d) => (
                  <button key={d.num} className="tcard-driver press" onClick={() => setOpen(d)}>
                    <Headshot driver={d} size={40} />
                    <span>
                      <b>{d.last}</b>
                      <span className="dim"> #{d.num}</span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      )}
      <AnimatePresence>
        {open && <DriverSheet d={open} champ={champ.get(open.num)} sessionKey={st.data?.sessionKey} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </main>
  );
}
