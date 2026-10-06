import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { flagFor } from '../model/constants';
import {
  STATUS_COLOR,
  STATUS_LABEL,
  fmtClock,
  localTimeOfDay,
  raceLapAt,
  trackStatus,
  weatherAt,
} from '../model/derive';
import type { SessionData } from '../model/types';
import { Icon } from '../ui/Icon';
import { LoadingScreen } from '../ui/LoadingScreen';
import { Segmented } from '../ui/Segmented';
import { ControlDock } from './ControlDock';
import { InsightsSheet } from './Insights';
import { Leaderboard } from './Leaderboard';
import { SPEEDS, usePlayback, usePlaybackClock, useThrottledTime } from './store';
import { TelemetryPanel } from './TelemetryPanel';
import { TrackCanvas } from './TrackCanvas';
import { useSession } from './useSession';
import { useStandings } from './useStandings';
import { Chequered, EventFeed, StartLights, StatusBanner } from './Events';
import './replay.css';

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

function TopHud({ data, onSettings, settingsOpen }: { data: SessionData; onSettings: () => void; settingsOpen: boolean }) {
  const t = useThrottledTime(250);
  const status = trackStatus(data, t);
  const w = weatherAt(data, t);
  const isRace = data.meta.kind === 'race';
  const lap = isRace ? raceLapAt(data, t) : 0;
  const remaining = !isRace ? Math.max(0, data.endT - t) : 0;
  return (
    <motion.header
      className="hud-top"
      initial={{ y: -30, opacity: 0, filter: 'blur(8px)' }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.15 }}
    >
      <div className="hud-left">
        <Link to={`/meeting/${data.meta.meetingKey}`} className="icon-btn glass hud-circle" aria-label="Torna al weekend">
          <Icon name="chevronLeft" />
        </Link>
        <div className="hud-title">
          <div className="eyebrow">
            {flagFor(data.meta.countryCode)} {data.meta.meetingName} {data.meta.year}
          </div>
          <div className="hud-session">
            {data.meta.name}
            {data.source === 'demo' && <span className="chip" style={{ marginLeft: 8, height: 22 }}>Dati simulati</span>}
          </div>
        </div>
      </div>

      <div className="hud-center glass" aria-live="off">
        {isRace ? (
          <div className="hud-lap">
            <span className="dim">Giro</span>
            <b className="tabular">{t < data.raceStart ? '—' : lap}</b>
            <span className="dim tabular">/ {data.totalLaps || '—'}</span>
          </div>
        ) : (
          <div className="hud-lap">
            <span className="dim">Fine tra</span>
            <b className="tabular">{fmtClock(remaining)}</b>
          </div>
        )}
        <span className="hud-sep" />
        <div className="hud-status" style={{ ['--st' as string]: STATUS_COLOR[status] }}>
          <i className={status === 'sc' || status === 'vsc' || status === 'red' ? 'pulse' : ''} />
          {STATUS_LABEL[status]}
        </div>
        <span className="hud-sep hide-sm" />
        <div className="hud-clock hide-sm tabular dim">{localTimeOfDay(data, t)} ora locale</div>
      </div>

      <div className="hud-right">
        {w && (
          <div className="hud-weather glass hide-sm" title="Meteo in pista">
            <span>
              <Icon name="thermometer" size={16} /> {w.air.toFixed(0)}° <span className="dim">aria</span>
            </span>
            <span>
              {w.track.toFixed(0)}° <span className="dim">pista</span>
            </span>
            <span>
              <Icon name={w.rain ? 'rain' : 'drop'} size={16} /> {Math.round(w.humidity)}%
            </span>
          </div>
        )}
        <button
          className="icon-btn glass hud-circle"
          onClick={onSettings}
          aria-label="Opzioni di visualizzazione"
          aria-expanded={settingsOpen}
        >
          <Icon name="settings" />
        </button>
      </div>
    </motion.header>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="tg">
      <span>
        {label}
        {hint && <small className="dim">{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="tg-ui" aria-hidden />
    </label>
  );
}

function SettingsPopover({ data, onClose }: { data: SessionData; onClose: () => void }) {
  const s = usePlayback();
  return (
    <motion.div
      className="settings glass glass-strong"
      initial={{ opacity: 0, scale: 0.92, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      role="dialog"
      aria-label="Opzioni di visualizzazione"
    >
      <div className="settings-head">
        <b>Visualizzazione</b>
        <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Chiudi">
          <Icon name="close" size={16} />
        </button>
      </div>
      <Toggle label="Nomi dei piloti" hint="L" checked={s.showNames} onChange={(v) => s.set({ showNames: v })} />
      <Toggle label="Zone DRS" hint="D" checked={s.showDrs} onChange={(v) => s.set({ showDrs: v })} />
      <Toggle label="Scie delle monoposto" hint="T" checked={s.showTrails} onChange={(v) => s.set({ showTrails: v })} />
      <Toggle
        label="Numeri delle curve"
        hint={data.ref.corners.length ? 'C' : 'non disponibili'}
        checked={s.showCorners}
        onChange={(v) => s.set({ showCorners: v })}
      />
      {data.meta.kind === 'race' && (
        <div className="settings-row">
          <span>Ordine classifica</span>
          <Segmented
            label="Ordine classifica"
            value={s.orderMode}
            onChange={(v) => s.set({ orderMode: v })}
            options={[
              { value: 'live', label: 'Live in pista' },
              { value: 'official', label: 'Ufficiale' },
            ]}
          />
        </div>
      )}
      <div className="settings-row">
        <span>Vista</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" aria-label="Ruota il circuito" title="Ruota di 15°" onClick={() => s.set({ rotation: s.rotation + 15 })}>
            <Icon name="rotate" />
          </button>
          <button className="icon-btn" aria-label="Zoom avanti" onClick={() => window.dispatchEvent(new CustomEvent('pitwall:zoom', { detail: 1.25 }))}>
            <Icon name="zoomIn" />
          </button>
          <button className="icon-btn" aria-label="Zoom indietro" onClick={() => window.dispatchEvent(new CustomEvent('pitwall:zoom', { detail: 0.8 }))}>
            <Icon name="zoomOut" />
          </button>
          <button
            className="icon-btn"
            aria-label="Ripristina vista"
            onClick={() => {
              s.set({ rotation: 0 });
              window.dispatchEvent(new Event('pitwall:reset-view'));
            }}
          >
            <Icon name="fullscreen" />
          </button>
        </div>
      </div>
      <div className="settings-keys dim">
        <b>Scorciatoie</b> Spazio play/pausa · ←/→ ±10s · ↑/↓ velocità · 1–9 velocità diretta · R ricomincia · I analisi · F segui
        pilota · Esc deseleziona · Click su un'auto o in classifica per selezionarla, Shift+click per confrontarne fino a 3.
      </div>
    </motion.div>
  );
}

function RaceControlTicker({ data }: { data: SessionData }) {
  const t = useThrottledTime(300);
  const [shown, setShown] = useState<{ id: number; msg: string; flag: string | null; at: number } | null>(null);
  const lastIdx = useRef(-1);
  useEffect(() => {
    let idx = -1;
    for (let i = 0; i < data.raceControl.length; i++) if (data.raceControl[i].t <= t) idx = i;
    if (idx !== lastIdx.current) {
      const jumped = Math.abs(idx - lastIdx.current) > 3;
      lastIdx.current = idx;
      if (idx >= 0 && !jumped) {
        const m = data.raceControl[idx];
        setShown({ id: idx, msg: m.message, flag: m.flag, at: performance.now() });
      }
    }
  }, [t, data]);
  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(id);
  }, [shown]);
  return (
    <div className="rc-ticker" aria-live="polite">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            className="rc-toast glass"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <span className="eyebrow" style={{ color: 'var(--text-2)' }}>
              <Icon name="flag" size={12} /> Direzione gara
            </span>
            <span className="rc-toast-msg">{shown.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useKeyboard(data: SessionData) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const s = usePlayback.getState();
      const idx = SPEEDS.indexOf(s.speed);
      switch (e.key) {
        case ' ':
          e.preventDefault();
          s.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.seek(s.t - 10 * Math.max(1, s.speed / 4));
          break;
        case 'ArrowRight':
          e.preventDefault();
          s.seek(s.t + 10 * Math.max(1, s.speed / 4));
          break;
        case 'ArrowUp':
          e.preventDefault();
          s.set({ speed: SPEEDS[Math.min(SPEEDS.length - 1, idx + 1)] });
          break;
        case 'ArrowDown':
          e.preventDefault();
          s.set({ speed: SPEEDS[Math.max(0, idx - 1)] });
          break;
        case 'r':
        case 'R':
          s.seek(s.startT);
          break;
        case 'd':
        case 'D':
          s.set({ showDrs: !s.showDrs });
          break;
        case 'l':
        case 'L':
          s.set({ showNames: !s.showNames });
          break;
        case 't':
        case 'T':
          s.set({ showTrails: !s.showTrails });
          break;
        case 'c':
        case 'C':
          s.set({ showCorners: !s.showCorners });
          break;
        case 'i':
        case 'I':
          s.set({ insightsOpen: !s.insightsOpen });
          break;
        case 'f':
        case 'F':
          if (s.selected.length) s.set({ follow: !s.follow });
          break;
        case 'Escape':
          if (s.insightsOpen) s.set({ insightsOpen: false });
          else s.set({ selected: [], follow: false });
          break;
        default:
          if (/^[1-9]$/.test(e.key)) s.set({ speed: SPEEDS[Number(e.key) - 1] });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data]);
}

function ReplayView({ data }: { data: SessionData }) {
  usePlaybackClock();
  useKeyboard(data);
  const view = useStandings(data);
  const selected = usePlayback((s) => s.selected);
  const wide = useMedia('(min-width: 980px)');
  const [lbOpen, setLbOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showLb = wide || lbOpen;
  // F1-style start sequence before lights out
  const [showLights, setShowLights] = useState(() => data.meta.kind === 'race' && data.raceStart > data.startT + 1);
  useEffect(() => {
    if (!showLights) return;
    usePlayback.setState({ t: data.raceStart - 1, playing: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lightsDone = useCallback(() => {
    setShowLights(false);
    usePlayback.setState({ playing: true });
  }, []);

  const insets = useMemo(
    () => ({
      top: 84,
      bottom: wide ? 104 : 150,
      left: wide && showLb ? 372 : 16,
      right: wide && selected.length ? 352 : 16,
    }),
    [wide, showLb, selected.length],
  );

  return (
    <div className="replay">
      <div className="replay-bg" />
      <TrackCanvas data={data} insets={insets} />
      <TopHud data={data} onSettings={() => setSettingsOpen((o) => !o)} settingsOpen={settingsOpen} />
      <AnimatePresence>{settingsOpen && <SettingsPopover data={data} onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
      <EventFeed data={data} overtakes={view.overtakes} />
      <StatusBanner data={data} />
      <Chequered data={data} />
      <AnimatePresence>{showLights && <StartLights onDone={lightsDone} />}</AnimatePresence>

      <motion.div
        className="replay-left"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1], delay: 0.3 }}
      >
        {!wide && (
          <button className="btn btn-secondary btn-sm glass" onClick={() => setLbOpen((o) => !o)} aria-expanded={lbOpen}>
            <Icon name="list" size={16} /> Classifica
          </button>
        )}
        {showLb && <Leaderboard data={data} view={view} compact={!wide} />}
      </motion.div>

      <div className="replay-right">
        <TelemetryPanel data={data} rows={view.rows} />
        <RaceControlTicker data={data} />
      </div>

      <InsightsSheet data={data} rows={view.rows} />
      <motion.div
        className="replay-dock"
        initial={{ y: 60, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.45 }}
      >
        <ControlDock data={data} />
      </motion.div>
    </div>
  );
}

export default function ReplayPage() {
  const { key } = useParams();
  const sessionKey = Number(key);
  const { data, error, label, progress, retry } = useSession(sessionKey);
  const reset = usePlayback((s) => s.reset);
  const [ready, setReady] = useState<SessionData | null>(null);

  useEffect(() => {
    if (!data) return;
    reset(data.startT, data.endT);
    usePlayback.setState({ playing: !(data.meta.kind === 'race' && data.raceStart > data.startT + 1) });
    setReady(data);
    document.title = `${data.meta.meetingName} · ${data.meta.name} — Pitwall`;
    return () => usePlayback.setState({ playing: false });
  }, [data, reset]);

  if (!ready || ready.meta.key !== sessionKey)
    return <LoadingScreen label={label} progress={progress} error={error} onRetry={retry} title="Preparazione del replay" />;
  return <ReplayView data={ready} />;
}
