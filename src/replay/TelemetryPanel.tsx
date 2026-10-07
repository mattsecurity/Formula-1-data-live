import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { sourceForSession } from '../data/sources';
import { loadCarTelemetry, sampleAt, type CarTelemetry } from '../model/carData';
import { COMPOUND_COLORS, COMPOUND_NAME_IT } from '../model/constants';
import { bisect, distanceAt, runningMax, timeAtDistance } from '../model/interp';
import { fmtLapTime, stintAt, type StandingRow } from '../model/standings';
import type { DriverTrack, Lap, SessionData } from '../model/types';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import { CarPosterModal } from '../ui/CarPoster';
import { TopCar } from '../ui/TopCar';
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

const maxCache = new WeakMap<DriverTrack, Float64Array>();
const maxOf = (tr: DriverTrack) => {
  let m = maxCache.get(tr);
  if (!m) maxCache.set(tr, (m = runningMax(tr.d)));
  return m;
};

/** Running lap time and live delta to the personal best at the same point of the lap. */
function lapProgress(data: SessionData, num: number, t: number) {
  const laps = data.lapsByDriver.get(num) ?? [];
  const tr = data.tracks.get(num);
  let cur: Lap | undefined;
  let pb: Lap | undefined;
  let last: Lap | undefined;
  for (const l of laps) {
    if (l.start != null && l.start <= t && (l.end == null || l.end > t)) cur = l;
    if (l.end != null && l.end <= t && l.dur != null) {
      last = l;
      if (!l.pitOut && l.lap > 1 && (!pb || l.dur < pb.dur!)) pb = l;
    }
  }
  let delta: number | null = null;
  const elapsed = cur?.start != null ? t - cur.start : null;
  if (tr && cur && pb && elapsed != null && elapsed > 3 && pb.start != null) {
    const f = distanceAt(tr, t) - (cur.lap - 1);
    if (f > 0.02 && f < 0.995) {
      const at = timeAtDistance(tr, pb.lap - 1 + f, maxOf(tr));
      if (at != null) delta = elapsed - (at - pb.start);
    }
  }
  return { cur, pb, last, elapsed, delta };
}

const SEG_COLOR: Record<number, string> = { 2048: '#ffd60a', 2049: '#30d158', 2051: '#bf5af2', 2064: '#0a84ff' };

function MiniSectors({ lap }: { lap?: Lap }) {
  const segs = lap?.segs ?? [];
  const total = segs.reduce((a, s) => a + s.length, 0);
  if (!total) return <div className="ms-empty dim">Minisettori non disponibili</div>;
  return (
    <div className="ms" aria-label="Minisettori dell'ultimo giro">
      {segs.map((sec, si) => (
        <div key={si} className="ms-sec" style={{ flex: sec.length || 1 }}>
          {sec.map((v, i) => (
            <i key={i} style={{ background: v != null ? (SEG_COLOR[v] ?? 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.08)' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Rolling 20-second trace of speed, throttle and brake. */
function LiveTrace({ tel, t, color }: { tel?: CarTelemetry; t: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !tel) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (c.width !== W * dpr) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const span = 20;
    const a = Math.max(0, bisect(tel.t, t - span));
    const b = bisect(tel.t, t);
    if (b <= a) return;
    const X = (tt: number) => W - ((t - tt) / span) * W;
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(0, (H * k) / 4);
      ctx.lineTo(W, (H * k) / 4);
      ctx.stroke();
    }
    // brake strips
    ctx.fillStyle = 'rgba(255,69,58,0.55)';
    for (let i = a; i < b; i++) if (tel.brake[i]) ctx.fillRect(X(tel.t[i]), H - 6, Math.max(1, X(tel.t[i + 1]) - X(tel.t[i])), 6);
    // throttle area
    ctx.beginPath();
    ctx.moveTo(X(tel.t[a]), H - 6);
    for (let i = a; i <= b; i++) ctx.lineTo(X(tel.t[i]), H - 6 - (tel.throttle[i] / 100) * (H - 10) * 0.45);
    ctx.lineTo(X(tel.t[b]), H - 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(48,209,88,0.22)';
    ctx.fill();
    // speed
    ctx.beginPath();
    for (let i = a; i <= b; i++) {
      const y = H - 6 - (tel.speed[i] / 360) * (H - 10);
      if (i === a) ctx.moveTo(X(tel.t[i]), y);
      else ctx.lineTo(X(tel.t[i]), y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }, [tel, t, color]);
  return (
    <div className="trace">
      <canvas ref={ref} aria-label="Andamento di velocità, acceleratore e freno negli ultimi 20 secondi" />
      <div className="trace-legend">
        <span>
          <i style={{ background: color }} /> Velocità
        </span>
        <span>
          <i style={{ background: 'rgba(48,209,88,0.7)' }} /> Gas
        </span>
        <span>
          <i style={{ background: 'rgba(255,69,58,0.8)' }} /> Freno
        </span>
        <span className="dim">ultimi 20 s</span>
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
  const selected = usePlayback((st) => st.selected);
  const { select, set } = usePlayback.getState();
  const lp = lapProgress(data, num, t);
  const isFollowed = follow && selected[0] === num;
  const stint = stintAt(data.stints, num, Math.max(1, row?.lap ?? 1));
  const drsState = !s ? '—' : s.drs >= 10 ? 'OPEN' : s.drs === 8 ? 'ELIG' : 'OFF';
  const rpmF = s ? Math.max(0, Math.min(1, (s.rpm - 4000) / 9000)) : 0;
  const [poster, setPoster] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="tm"
      style={{ ['--team' as string]: d.color }}
    >
      <header className="tm-h">
        <Headshot driver={d} size={44} />
        <div className="tm-id">
          <div className="tm-name">
            <span>{d.first}</span> <b>{d.last.toUpperCase()}</b>
          </div>
          <div className="tm-team">
            <span className="tm-num num">{d.num}</span> {d.team}
          </div>
        </div>
        {row && <div className="tm-pos num">P{row.pos}</div>}
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => select(num, true)} aria-label={`Chiudi ${d.code}`}>
          <Icon name="close" size={14} />
        </button>
      </header>

      <button className="tm-car-btn" onClick={() => setPoster(true)} aria-label={`Scheda della monoposto di ${d.full}`} title="Scheda monoposto">
        <TopCar color={d.color} compound={row?.compound !== 'UNKNOWN' ? row?.compound : undefined} number={d.num} className="tm-car" title={`Monoposto ${d.team}`} />
        <span className="tm-car-hint">Scheda monoposto</span>
      </button>
      <AnimatePresence>{poster && <CarPosterModal d={d} year={data.meta.year} onClose={() => setPoster(false)} />}</AnimatePresence>

      <div className="tm-read">
        <div className="tm-cell tm-speed">
          <span className="label">Velocità</span>
          <b className="num">{s ? Math.round(s.speed) : '—'}</b>
          <span className="unit">km/h</span>
        </div>
        <div className="tm-cell">
          <span className="label">Marcia</span>
          <b className="num">{s ? (s.gear === 0 ? 'N' : s.gear) : '—'}</b>
        </div>
        <div className="tm-cell">
          <span className="label">RPM</span>
          <b className="num small">{s ? Math.round(s.rpm).toLocaleString('it-IT') : '—'}</b>
          <span className="rpm">
            <span style={{ width: `${rpmF * 100}%` }} />
          </span>
        </div>
        <div className="tm-cell">
          <span className="label">DRS</span>
          <b className={`drs drs-${drsState.toLowerCase()}`}>{drsState}</b>
        </div>
      </div>

      <div className="tm-pedals">
        <div>
          <span className="label">Gas</span>
          <span className="pb">
            <span style={{ width: `${s?.throttle ?? 0}%`, background: 'var(--green)' }} />
          </span>
          <span className="num">{s ? Math.round(s.throttle) : 0}%</span>
        </div>
        <div>
          <span className="label">Freno</span>
          <span className="pb">
            <span style={{ width: `${s?.brake ?? 0}%`, background: 'var(--red)' }} />
          </span>
          <span className="num">{s?.brake ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      <LiveTrace tel={tel} t={t} color={d.color} />
      {error && <p className="tm-err">Telemetria non disponibile: {error}</p>}
      {!tel && !error && <p className="tm-err dim">Caricamento telemetria…</p>}

      <div className="tm-lap">
        <div>
          <span className="label">Giro {lp.cur?.lap ?? '—'}</span>
          <b className="num">{lp.elapsed != null ? fmtLapTime(lp.elapsed) : '—'}</b>
        </div>
        <div>
          <span className="label">Δ PB</span>
          <b className={`num ${lp.delta == null ? '' : lp.delta < 0 ? 'good' : 'bad'}`}>
            {lp.delta == null ? '—' : `${lp.delta > 0 ? '+' : '−'}${Math.abs(lp.delta).toFixed(2)}`}
          </b>
        </div>
        <div>
          <span className="label">Ultimo</span>
          <b className="num">{fmtLapTime(lp.last?.dur)}</b>
        </div>
        <div>
          <span className="label">Personale</span>
          <b className="num">{fmtLapTime(lp.pb?.dur)}</b>
        </div>
      </div>
      <MiniSectors lap={lp.last} />

      <div className="tm-tyre">
        {stint ? (
          <>
            <i style={{ borderColor: COMPOUND_COLORS[stint.compound] }} />
            <span>
              <b>{COMPOUND_NAME_IT[stint.compound]}</b> · {row?.tyreAge ?? 0} giri · stint {stint.n}
            </span>
          </>
        ) : (
          <span className="dim">Gomme: dati non disponibili</span>
        )}
        <span className="dim" style={{ marginLeft: 'auto' }}>
          {row?.pits ?? 0} {row?.pits === 1 ? 'sosta' : 'soste'}
        </span>
      </div>

      <button
        className={`btn btn-sm ${isFollowed ? 'btn-primary' : 'btn-secondary'}`}
        style={{ width: '100%' }}
        onClick={() => {
          if (selected[0] !== num) set({ selected: [num, ...selected.filter((n) => n !== num)] });
          set({ follow: !isFollowed });
        }}
      >
        <Icon name="crosshair" size={15} /> {isFollowed ? 'Camera car attiva' : 'Camera car'}
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
