import { useMemo, useRef, useState } from 'react';
import { fmtClock, leaderLapStarts } from '../model/derive';
import type { SessionData } from '../model/types';
import { Icon } from '../ui/Icon';
import { SPEEDS, usePlayback, useThrottledTime } from './store';
import './dock.css';

function Timeline({ data }: { data: SessionData }) {
  const t = useThrottledTime(50);
  const { startT, endT, seek, selected } = usePlayback();
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const span = endT - startT || 1;
  const pct = (v: number) => `${((Math.max(startT, Math.min(endT, v)) - startT) / span) * 100}%`;
  const laps = useMemo(() => (data.meta.kind === 'race' ? leaderLapStarts(data) : []), [data]);
  const lapAt = (time: number) => {
    let lap = 0;
    for (const l of laps) if (l.t <= time) lap = l.lap;
    return lap;
  };

  const timeFromEvent = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return { x: clientX - r.left, t: startT + f * span };
  };

  const dragging = useRef(false);
  const label = (time: number) =>
    data.meta.kind === 'race' && time >= data.raceStart ? `Giro ${Math.max(1, lapAt(time))}` : fmtClock(time - startT);

  return (
    <div
      className="tl"
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label="Linea temporale della sessione"
      aria-valuemin={0}
      aria-valuemax={Math.round(span)}
      aria-valuenow={Math.round(t - startT)}
      aria-valuetext={label(t)}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        seek(timeFromEvent(e.clientX).t);
      }}
      onPointerMove={(e) => {
        const h = timeFromEvent(e.clientX);
        setHover(h);
        if (dragging.current) seek(h.t);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') seek(t - 10);
        if (e.key === 'ArrowRight') seek(t + 10);
      }}
    >
      <div className="tl-track">
        {data.periods.map((p, i) => (
          <span
            key={i}
            className={`tl-band tl-${p.kind.toLowerCase()}`}
            style={{ left: pct(p.start), width: `calc(${pct(p.end)} - ${pct(p.start)})` }}
            title={p.kind === 'RED' ? 'Bandiera rossa' : p.kind}
          />
        ))}
        <span className="tl-fill" style={{ width: pct(t) }} />
        {laps.map((l) =>
          l.lap > 1 ? (
            <span key={l.lap} className={`tl-tick ${l.lap % 10 === 0 ? 'major' : ''}`} style={{ left: pct(l.t) }} />
          ) : null,
        )}
        {[...data.retiredAt.entries()].map(([num, rt]) => (
          <span key={num} className="tl-dot tl-dnf" style={{ left: pct(rt) }} title={`Ritiro ${data.byNum.get(num)?.code}`} />
        ))}
        {data.pits
          .filter((p) => selected.includes(p.driver))
          .map((p, i) => (
            <span
              key={i}
              className="tl-dot tl-pit"
              style={{ left: pct(p.t), background: data.byNum.get(p.driver)?.color }}
              title={`Pit stop ${data.byNum.get(p.driver)?.code} — giro ${p.lap}`}
            />
          ))}
      </div>
      <span className="tl-knob" style={{ left: pct(t) }} />
      {hover && (
        <span className="tl-hover" style={{ left: hover.x }}>
          {label(hover.t)}
        </span>
      )}
    </div>
  );
}

export function ControlDock({ data }: { data: SessionData }) {
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const insightsOpen = usePlayback((s) => s.insightsOpen);
  const { toggle, seek, set } = usePlayback.getState();
  const t = useThrottledTime(250);
  const startT = usePlayback((s) => s.startT);
  const endT = usePlayback((s) => s.endT);
  const idx = SPEEDS.indexOf(speed);
  const step = (dir: number) => set({ speed: SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (idx < 0 ? 3 : idx) + dir))] });

  return (
    <div className="dock glass" role="toolbar" aria-label="Controlli di riproduzione">
      <div className="dock-buttons">
        <button className="icon-btn" onClick={() => seek(startT)} aria-label="Ricomincia (R)" title="Ricomincia (R)">
          <Icon name="restart" />
        </button>
        <button className="icon-btn" onClick={() => seek(usePlayback.getState().t - 10 * Math.max(1, speed / 4))} aria-label="Indietro" title="Indietro (←)">
          <Icon name="back10" />
        </button>
        <button className="icon-btn dock-play" onClick={toggle} aria-label={playing ? 'Pausa' : 'Riproduci'} title="Spazio">
          <Icon name={playing ? 'pause' : 'play'} size={22} />
        </button>
        <button className="icon-btn" onClick={() => seek(usePlayback.getState().t + 10 * Math.max(1, speed / 4))} aria-label="Avanti" title="Avanti (→)">
          <Icon name="fwd10" />
        </button>
      </div>
      <div className="dock-tl">
        <span className="dock-time tabular">{fmtClock(t - startT)}</span>
        <Timeline data={data} />
        <span className="dock-time tabular dim">{fmtClock(endT - startT)}</span>
      </div>
      <div className="dock-buttons">
        <div className="speed" role="group" aria-label="Velocità di riproduzione">
          <button className="icon-btn sm" onClick={() => step(-1)} aria-label="Più lento (↓)">
            −
          </button>
          <span className="speed-val tabular">{speed}×</span>
          <button className="icon-btn sm" onClick={() => step(1)} aria-label="Più veloce (↑)">
            +
          </button>
        </div>
        <button
          className="icon-btn"
          aria-pressed={insightsOpen}
          onClick={() => set({ insightsOpen: !insightsOpen })}
          aria-label="Analisi (I)"
          title="Analisi (I)"
        >
          <Icon name="chart" />
        </button>
      </div>
    </div>
  );
}
