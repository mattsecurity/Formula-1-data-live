import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sourceForSession } from '../data/sources';
import { loadCarTelemetry, sampleAt, type CarTelemetry } from '../model/carData';
import { fmtLapTime, type StandingRow } from '../model/standings';
import type { SessionData } from '../model/types';
import { CarArt } from '../ui/CarArt';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import { TyreBadge } from '../ui/TyreBadge';
import { usePlayback, useThrottledTime } from './store';
import './telemetry.css';

function useTelemetry(data: SessionData, num: number) {
  const [state, setState] = useState<{ tel?: CarTelemetry; error?: string }>({});
  useEffect(() => {
    let alive = true;
    setState({});
    loadCarTelemetry(sourceForSession(data.meta.key), data, num).then(
      (tel) => alive && setState({ tel }),
      (e: Error) => alive && setState({ error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [data, num]);
  return state;
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="tm-bar" aria-label={`${label} ${Math.round(value)}`}>
      <span className="tm-bar-label">{label}</span>
      <span className="tm-bar-track">
        <span className="tm-bar-fill" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </span>
      <span className="tm-bar-val tabular">{Math.round(value)}</span>
    </div>
  );
}

/** Steering-wheel style shift lights: green → red → blue as revs climb. */
function ShiftLights({ rpm }: { rpm: number }) {
  const n = 15;
  const lit = Math.round(Math.max(0, Math.min(1, (rpm - 9000) / 3200)) * n);
  const flash = lit >= n;
  return (
    <div className={`shift ${flash ? 'flash' : ''}`} aria-label={`Giri motore ${Math.round(rpm)}`}>
      {Array.from({ length: n }, (_, i) => {
        const color = i < 5 ? '#30d158' : i < 10 ? '#ff453a' : '#0a84ff';
        return <i key={i} style={{ background: i < lit ? color : undefined, boxShadow: i < lit ? `0 0 8px ${color}` : undefined }} />;
      })}
    </div>
  );
}

function SpeedGauge({ speed, color }: { speed: number | null; color: string }) {
  const r = 34;
  const arc = Math.PI * 1.5 * r; // 270°
  const f = speed == null ? 0 : Math.max(0, Math.min(1, speed / 360));
  return (
    <div className="gauge">
      <svg viewBox="0 0 88 88" width="88" height="88" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeDasharray={`${arc} 999`} strokeLinecap="round" transform="rotate(135 44 44)" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${arc * f} 999`}
          strokeLinecap="round"
          transform="rotate(135 44 44)"
          style={{ transition: 'stroke-dasharray 0.12s linear', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="gauge-val">
        <b className="tabular">{speed == null ? '—' : Math.round(speed)}</b>
        <span>km/h</span>
      </div>
    </div>
  );
}

function DriverCard({ data, num, row }: { data: SessionData; num: number; row?: StandingRow }) {
  const d = data.byNum.get(num)!;
  const t = useThrottledTime(66);
  const { tel, error } = useTelemetry(data, num);
  const s = tel ? sampleAt(tel, t) : null;
  const follow = usePlayback((st) => st.follow);
  const playing = usePlayback((st) => st.playing);
  const selected = usePlayback((st) => st.selected);
  const { select, set } = usePlayback.getState();
  const laps = data.lapsByDriver.get(num) ?? [];
  const done = laps.filter((l) => l.end != null && l.end <= t && l.dur != null);
  const last = done.at(-1);
  const best = done.filter((l) => !l.pitOut).reduce<number | null>((m, l) => (m == null || l.dur! < m ? l.dur! : m), null);
  const isFollowed = follow && selected[0] === num;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="tm-card"
      style={{ ['--team' as string]: d.color }}
    >
      <div className="tm-head">
        <Headshot driver={d} size={46} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tm-name">
            {d.first} <b>{d.last}</b>
          </div>
          <div className="tm-team dim">
            {d.team} · #{d.num}
          </div>
        </div>
        {row && <div className="tm-pos tabular">P{row.pos}</div>}
        <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => select(num, true)} aria-label={`Chiudi ${d.code}`}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <CarArt color={d.color} number={d.num} compound={row?.compound ?? 'SOFT'} className="tm-car" spinning={playing && !!s && s.speed > 5} title={`Monoposto ${d.team}`} />
      <div className="tm-grid">
        <SpeedGauge speed={s ? s.speed : null} color={d.color} />
        <div className="tm-gear" aria-label={`Marcia ${s?.gear ?? ''}`}>
          <span className="dim">Marcia</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.b
              key={s ? s.gear : 'x'}
              className="tabular"
              initial={{ y: 14, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -14, opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            >
              {s ? (s.gear === 0 ? 'N' : s.gear) : '—'}
            </motion.b>
          </AnimatePresence>
        </div>
        <div className={`tm-drs ${s?.drs ? 'on' : ''}`}>DRS</div>
      </div>
      <Bar label="Gas" value={s?.throttle ?? 0} max={100} color="var(--green)" />
      <Bar label="Freno" value={s?.brake ?? 0} max={100} color="var(--red)" />
      <ShiftLights rpm={s?.rpm ?? 0} />
      {error && <p className="tm-err">Telemetria non disponibile: {error}</p>}
      {!tel && !error && <p className="tm-err dim">Caricamento telemetria…</p>}
      <div className="tm-stats">
        <div>
          <span className="dim">Giro</span>
          <b className="tabular">{row?.lap || '—'}</b>
        </div>
        <div>
          <span className="dim">Ultimo</span>
          <b className="tabular">{fmtLapTime(last?.dur)}</b>
        </div>
        <div>
          <span className="dim">Migliore</span>
          <b className="tabular">{fmtLapTime(best)}</b>
        </div>
        <div>
          <span className="dim">Gomma</span>
          <b>{row && row.compound !== 'UNKNOWN' ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '—'}</b>
        </div>
      </div>
      <button
        className={`btn btn-sm ${isFollowed ? 'btn-primary' : 'btn-secondary'}`}
        style={{ width: '100%' }}
        onClick={() => {
          if (selected[0] !== num) set({ selected: [num, ...selected.filter((n) => n !== num)] });
          set({ follow: !isFollowed });
        }}
      >
        <Icon name="crosshair" size={16} /> {isFollowed ? 'Segui: attivo' : 'Segui in camera car'}
      </button>
    </motion.article>
  );
}

export function TelemetryPanel({ data, rows }: { data: SessionData; rows: StandingRow[] }) {
  const selected = usePlayback((s) => s.selected);
  const byNum = new Map(rows.map((r) => [r.num, r]));
  return (
    <div className="tm-panel scroll-y" aria-live="polite">
      <AnimatePresence initial={false}>
        {selected.map((num) => (
          <DriverCard key={num} data={data} num={num} row={byNum.get(num)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
