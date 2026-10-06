import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sourceForSession } from '../data/sources';
import { fastestLap } from '../model/analysis';
import { loadCarWindow, type CarTelemetry } from '../model/carData';
import { flagFor } from '../model/constants';
import { projectS, rotatedBounds } from '../model/geometry';
import { bisect, carAt } from '../model/interp';
import { fmtLapTime } from '../model/standings';
import type { Lap, SessionData } from '../model/types';
import { useSession } from '../replay/useSession';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import { LineChart, type Series } from '../ui/LineChart';
import { LoadingScreen } from '../ui/LoadingScreen';
import './lab.css';

interface Pick {
  driver: number;
  lap: number;
}

interface LapTrace {
  pick: Pick;
  lap: Lap;
  color: string;
  code: string;
  /** distance (m) per telemetry sample */
  dist: Float64Array;
  /** time since lap start per sample */
  time: Float64Array;
  tel: CarTelemetry;
  /** lap fraction per sample (for the track map) */
  frac: Float64Array;
}

const SECONDARY = ['#ffffff', '#ffd60a', '#40c8e0'];

function useTraces(data: SessionData, picks: Pick[]) {
  const [traces, setTraces] = useState<LapTrace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = picks.map((p) => `${p.driver}:${p.lap}`).join(',');
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const src = sourceForSession(data.meta.key);
    const usedColors = new Set<string>();
    Promise.all(
      picks.map(async (pick, i): Promise<LapTrace | null> => {
        const lap = data.lapsByDriver.get(pick.driver)?.find((l) => l.lap === pick.lap);
        if (!lap || lap.start == null || lap.dur == null) return null;
        const tel = await loadCarWindow(src, data, pick.driver, lap.start - 0.5, lap.start + lap.dur + 0.5);
        const d = data.byNum.get(pick.driver)!;
        // teammates share a colour: give the second one a contrasting tone
        const color = usedColors.has(d.color) ? SECONDARY[i % SECONDARY.length] : d.color;
        usedColors.add(d.color);
        const n = tel.t.length;
        const dist = new Float64Array(n);
        const time = new Float64Array(n);
        const frac = new Float64Array(n);
        const tr = data.tracks.get(pick.driver);
        for (let k = 0; k < n; k++) {
          time[k] = tel.t[k] - lap.start;
          if (k > 0) dist[k] = dist[k - 1] + ((tel.speed[k] + tel.speed[k - 1]) / 2 / 3.6) * (tel.t[k] - tel.t[k - 1]);
          const p = tr && carAt(tr, tel.t[k]);
          frac[k] = p ? projectS(data.ref, p.x, p.y).s / data.ref.length : k / n;
        }
        // keep the samples inside the lap
        const a = Math.max(0, bisect(tel.t, lap.start));
        const b = Math.min(n - 1, bisect(tel.t, lap.start + lap.dur) + 1);
        const off = dist[a];
        const sl = <T extends Float64Array | Float32Array | Uint8Array>(arr: T) => arr.slice(a, b + 1) as T;
        const distS = sl(dist).map((v) => v - off);
        return {
          pick,
          lap,
          color,
          code: d.code,
          dist: distS,
          time: sl(time),
          frac: sl(frac),
          tel: { t: sl(tel.t), speed: sl(tel.speed), rpm: sl(tel.rpm), gear: sl(tel.gear), throttle: sl(tel.throttle), brake: sl(tel.brake), drs: sl(tel.drs) },
        };
      }),
    ).then(
      (res) => {
        if (!alive) return;
        setTraces(res.filter((x): x is LapTrace => x != null && x.dist.length > 5));
        setLoading(false);
      },
      (e: Error) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key]);
  return { traces, loading, error };
}

/** time at a given distance (linear) */
function timeAtDist(tr: LapTrace, d: number): number {
  const i = bisect(tr.dist, d);
  if (i < 0) return tr.time[0];
  if (i >= tr.dist.length - 1) return tr.time[tr.dist.length - 1];
  const u = (d - tr.dist[i]) / (tr.dist[i + 1] - tr.dist[i] || 1);
  return tr.time[i] + (tr.time[i + 1] - tr.time[i]) * u;
}

function MiniMap({ data, traces, tau }: { data: SessionData; traces: LapTrace[]; tau: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // dominance: which trace is quickest through each of 30 mini-sectors (by lap fraction)
  const dominance = useMemo(() => {
    const N = 30;
    const out: (string | null)[] = new Array(N).fill(null);
    if (traces.length < 2) return out;
    for (let s = 0; s < N; s++) {
      let best: string | null = null;
      let bestT = Infinity;
      for (const tr of traces) {
        const ta = timeAtFrac(tr, s / N);
        const tb = timeAtFrac(tr, (s + 1) / N);
        if (ta == null || tb == null) continue;
        if (tb - ta < bestT) {
          bestT = tb - ta;
          best = tr.color;
        }
      }
      out[s] = best;
    }
    return out;
  }, [traces]);

  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth;
    const H = c.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const r = data.ref;
    const rot = (r.rotation * Math.PI) / 180;
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    const b = rotatedBounds(r, r.rotation);
    const scale = Math.min((W - 40) / (b.maxX - b.minX), (H - 40) / (b.maxY - b.minY));
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const P = (x: number, y: number) => [W / 2 + (x * ca - y * sa - cx) * scale, H / 2 - (x * sa + y * ca - cy) * scale] as const;
    const n = r.x.length;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = P(r.x[i % n], r.y[i % n]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    const N = dominance.length;
    for (let s = 0; s < N; s++) {
      const col = dominance[s] ?? 'rgba(255,255,255,0.35)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      const i0 = Math.floor((s / N) * n);
      const i1 = Math.floor(((s + 1) / N) * n);
      for (let i = i0; i <= i1; i++) {
        const [x, y] = P(r.x[i % n], r.y[i % n]);
        if (i === i0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // start line
    const [sx, sy] = P(r.x[0], r.y[0]);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    // ghost cars
    for (const tr of traces) {
      const t = tr.lap.start! + Math.min(tau, tr.lap.dur!);
      const p = data.tracks.get(tr.pick.driver) && carAt(data.tracks.get(tr.pick.driver)!, t);
      if (!p) continue;
      const [x, y] = P(p.x, p.y);
      ctx.fillStyle = tr.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '700 11px -apple-system, "Inter Variable", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(tr.code, x + 10, y - 8);
    }
  }, [data, traces, tau, dominance]);

  return <canvas ref={ref} className="lab-map" aria-label="Mappa del giro con le auto fantasma e i mini-settori più veloci" />;
}

function timeAtFrac(tr: LapTrace, f: number): number | null {
  // lap fractions wrap around the start line: unwrap near both ends of the lap
  const n = tr.frac.length;
  for (let i = 0; i < n; i++) {
    let fr = tr.frac[i];
    if (i < n * 0.2 && fr > 0.8) fr -= 1;
    if (i > n * 0.8 && fr < 0.2) fr += 1;
    if (fr >= f) return tr.time[i];
  }
  return null;
}

function LapLab({ data }: { data: SessionData }) {
  const bestBy = useMemo(() => {
    const m = new Map<number, Lap>();
    for (const d of data.drivers) {
      const l = fastestLap(data, d.num);
      if (l) m.set(d.num, l);
    }
    return m;
  }, [data]);
  const ranking = [...bestBy.entries()].sort((a, b) => a[1].dur! - b[1].dur!);
  const [picks, setPicks] = useState<Pick[]>(() => ranking.slice(0, 2).map(([driver, l]) => ({ driver, lap: l.lap })));
  const { traces, loading, error } = useTraces(data, picks);
  const [tau, setTau] = useState(0);
  const [playing, setPlaying] = useState(false);
  const maxDur = Math.max(1, ...traces.map((t) => t.lap.dur!));

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTau((v) => {
        const nv = v + dt;
        if (nv >= maxDur) {
          setPlaying(false);
          return maxDur;
        }
        return nv;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxDur]);

  const toggleDriver = (num: number) => {
    setPicks((p) => {
      if (p.some((x) => x.driver === num)) return p.filter((x) => x.driver !== num);
      const l = bestBy.get(num);
      if (!l) return p;
      return [...p, { driver: num, lap: l.lap }].slice(-3);
    });
    setTau(0);
  };

  const chart = (pick: (t: LapTrace, i: number) => number): Series[] =>
    traces.map((t) => ({
      id: `${t.pick.driver}-${t.pick.lap}`,
      label: `${t.code} G${t.pick.lap}`,
      color: t.color,
      width: 1.8,
      points: Array.from(t.dist, (d, i) => [d, pick(t, i)] as [number, number]),
    }));

  const delta: Series[] = useMemo(() => {
    if (traces.length < 2) return [];
    const ref = traces[0];
    const end = ref.dist[ref.dist.length - 1];
    return traces.slice(1).map((t) => {
      const pts: [number, number][] = [];
      for (let d = 0; d <= end; d += end / 400) pts.push([d, timeAtDist(t, d) - timeAtDist(ref, d)]);
      return { id: `d${t.pick.driver}`, label: `${t.code} vs ${ref.code}`, color: t.color, width: 2, points: pts };
    });
  }, [traces]);

  const marker = traces[0] ? traces[0].dist[Math.max(0, bisect(traces[0].time, tau))] : undefined;
  const fmtM = (v: number) => `${Math.round(v)} m`;

  return (
    <div className="lab">
      <header className="lab-head">
        <Link to={`/meeting/${data.meta.meetingKey}`} className="icon-btn glass" aria-label="Torna al weekend" style={{ width: 46, height: 46 }}>
          <Icon name="chevronLeft" />
        </Link>
        <div>
          <div className="eyebrow">
            {flagFor(data.meta.countryCode)} {data.meta.meetingName} {data.meta.year} · {data.meta.name}
          </div>
          <h1 className="title-md" style={{ margin: 0 }}>
            Lap Lab
          </h1>
        </div>
        <div style={{ flex: 1 }} />
        <Link className="btn btn-secondary btn-sm" to={`/replay/${data.meta.key}`}>
          <Icon name="play" size={14} /> Replay della sessione
        </Link>
      </header>

      <section className="lab-top">
        <div className="lab-map-card card">
          <MiniMap data={data} traces={traces} tau={tau} />
          <div className="lab-ghost">
            <button className="icon-btn" onClick={() => (tau >= maxDur ? (setTau(0), setPlaying(true)) : setPlaying((p) => !p))} aria-label={playing ? 'Pausa' : 'Avvia confronto'}>
              <Icon name={playing ? 'pause' : 'play'} />
            </button>
            <input type="range" min={0} max={maxDur} step={0.01} value={tau} onChange={(e) => (setPlaying(false), setTau(Number(e.target.value)))} aria-label="Tempo nel giro" style={{ flex: 1 }} />
            <span className="tabular" style={{ fontSize: 13, minWidth: 64, textAlign: 'right' }}>{fmtLapTime(tau)}</span>
          </div>
          {traces.length > 1 && (
            <p className="dim" style={{ margin: '0 16px 14px', fontSize: 12 }}>
              Il tracciato è colorato con il pilota più veloce in ciascuno dei 30 mini-settori.
            </p>
          )}
        </div>
        <div className="lab-picks card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Scegli fino a 3 piloti</div>
          <div className="lab-rank scroll-y">
            {ranking.map(([num, lap], i) => {
              const d = data.byNum.get(num)!;
              const sel = picks.find((p) => p.driver === num);
              const trace = traces.find((t) => t.pick.driver === num);
              return (
                <div key={num} className={`lab-row ${sel ? 'is-sel' : ''}`} style={{ ['--team' as string]: trace?.color ?? d.color }}>
                  <button className="lab-row-btn" onClick={() => toggleDriver(num)} aria-pressed={!!sel}>
                    <span className="tabular dim" style={{ width: 20, textAlign: 'right' }}>{i + 1}</span>
                    <Headshot driver={d} size={30} />
                    <b>{d.code}</b>
                    <span className="tabular">{fmtLapTime(lap.dur)}</span>
                    <span className="tabular dim" style={{ fontSize: 12 }}>{i ? `+${(lap.dur! - ranking[0][1].dur!).toFixed(3)}` : ''}</span>
                  </button>
                  {sel && (
                    <select
                      aria-label={`Giro di ${d.code}`}
                      value={sel.lap}
                      onChange={(e) => setPicks((p) => p.map((x) => (x.driver === num ? { ...x, lap: Number(e.target.value) } : x)))}
                    >
                      {(data.lapsByDriver.get(num) ?? [])
                        .filter((l) => l.dur != null && l.start != null)
                        .map((l) => (
                          <option key={l.lap} value={l.lap}>
                            Giro {l.lap} · {fmtLapTime(l.dur)}
                            {l.lap === lap.lap ? ' ★' : ''}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {error && <p style={{ color: 'var(--orange)' }}>Telemetria non disponibile: {error}</p>}
      {loading && <div className="skeleton" style={{ height: 300, marginTop: 16 }} />}
      {!loading && traces.length > 0 && (
        <motion.section className="lab-charts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="lab-legend">
            {traces.map((t) => (
              <span key={t.pick.driver}>
                <i style={{ background: t.color }} /> {t.code} · giro {t.pick.lap} · <b className="tabular">{fmtLapTime(t.lap.dur)}</b>
              </span>
            ))}
          </div>
          {delta.length > 0 && (
            <div className="card lab-chart">
              <h3>Delta tempo <span className="dim">rispetto a {traces[0].code} — sopra lo zero è più lento</span></h3>
              <LineChart series={delta} height={180} xFormat={fmtM} yFormat={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}s`} marker={marker} />
            </div>
          )}
          <div className="card lab-chart">
            <h3>Velocità <span className="dim">km/h</span></h3>
            <LineChart series={chart((t, i) => t.tel.speed[i])} height={240} xFormat={fmtM} yFormat={(v) => `${Math.round(v)}`} marker={marker} />
          </div>
          <div className="lab-split">
            <div className="card lab-chart">
              <h3>Acceleratore <span className="dim">%</span></h3>
              <LineChart series={chart((t, i) => t.tel.throttle[i])} height={160} yDomain={[-5, 105]} xFormat={fmtM} yFormat={(v) => `${Math.round(v)}`} marker={marker} />
            </div>
            <div className="card lab-chart">
              <h3>Freno</h3>
              <LineChart series={chart((t, i) => (t.tel.brake[i] ? 1 : 0))} height={160} yDomain={[-0.1, 1.1]} yTicks={[0, 1]} xFormat={fmtM} yFormat={(v) => (v > 0.5 ? 'ON' : 'OFF')} marker={marker} step />
            </div>
          </div>
          <div className="lab-split">
            <div className="card lab-chart">
              <h3>Marcia</h3>
              <LineChart series={chart((t, i) => t.tel.gear[i])} height={160} yDomain={[0.5, 8.5]} yTicks={[1, 2, 3, 4, 5, 6, 7, 8]} xFormat={fmtM} yFormat={(v) => `${Math.round(v)}`} marker={marker} step />
            </div>
            <div className="card lab-chart">
              <h3>Giri motore <span className="dim">rpm</span></h3>
              <LineChart series={chart((t, i) => t.tel.rpm[i])} height={160} xFormat={fmtM} yFormat={(v) => `${(v / 1000).toFixed(0)}k`} marker={marker} />
            </div>
          </div>
        </motion.section>
      )}
    </div>
  );
}

export default function LapLabPage() {
  const { key } = useParams();
  const { data, error, label, progress, retry } = useSession(Number(key));
  useEffect(() => {
    if (data) document.title = `Lap Lab · ${data.meta.meetingName} — Pitwall`;
  }, [data]);
  if (!data) return <LoadingScreen label={label} progress={progress} error={error} onRetry={retry} title="Preparazione del Lap Lab" />;
  return <LapLab data={data} />;
}
