import { motion } from 'framer-motion';
import type { SessionData } from '../model/types';
import type { StandingRow } from '../model/standings';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { TyreBadge } from '../ui/TyreBadge';
import { usePlayback } from './store';
import type { StandingsView } from './useStandings';
import './leaderboard.css';

function StatusPill({ row }: { row: StandingRow }) {
  if (row.status === 'pit') return <span className="lb-pill lb-pill-pit">PIT</span>;
  if (row.status === 'out') return <span className="lb-pill lb-pill-out">RIT</span>;
  if (row.status === 'fin') return <span className="lb-pill lb-pill-fin">🏁</span>;
  return null;
}

export function Leaderboard({ data, view, compact }: { data: SessionData; view: StandingsView; compact?: boolean }) {
  const selected = usePlayback((s) => s.selected);
  const select = usePlayback((s) => s.select);
  const gapMode = usePlayback((s) => s.gapMode);
  const set = usePlayback((s) => s.set);
  const orderMode = usePlayback((s) => s.orderMode);
  const isRace = data.meta.kind === 'race';
  const now = performance.now();

  return (
    <section className={`lb glass ${compact ? 'lb-compact' : ''}`} aria-label="Classifica live">
      <header className="lb-head">
        <div>
          <div className="eyebrow">{isRace ? 'Classifica live' : 'Tempi'}</div>
        </div>
        {isRace && (
          <Segmented
            label="Tipo di distacco"
            value={gapMode}
            onChange={(v) => set({ gapMode: v })}
            options={[
              { value: 'interval', label: 'Intervallo' },
              { value: 'leader', label: 'Leader' },
            ]}
          />
        )}
      </header>
      <ol className="lb-list scroll-y">
        {view.rows.map((r, idx) => {
          const d = data.byNum.get(r.num)!;
          const flash = view.flashes.get(r.num);
          const isSel = selected.includes(r.num);
          const gap = isRace ? (gapMode === 'leader' ? r.gap : r.interval) : r.gap;
          return (
            <motion.li
              key={r.num}
              layout="position"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.8, opacity: { delay: 0.4 + idx * 0.03 }, x: { delay: 0.4 + idx * 0.03 } }}
              className={`lb-row ${isSel ? 'is-sel' : ''} ${r.status === 'out' ? 'is-out' : ''} ${
                flash && flash.until > now ? (flash.dir > 0 ? 'flash-up' : 'flash-down') : ''
              }`}
              style={{ ['--team' as string]: d.color }}
            >
              <button
                className="lb-btn"
                onClick={(e) => select(r.num, e.shiftKey || e.metaKey)}
                aria-pressed={isSel}
                aria-label={`P${r.pos} ${d.full}, ${d.team}`}
              >
                <span className="lb-pos tabular">{r.pos}</span>
                <span className="lb-bar" />
                {!compact && (d.headshot ? <Headshot driver={d} size={24} ring={false} /> : <span />)}
                <span className="lb-code">{d.code}</span>
                <span className="lb-delta tabular" aria-hidden>
                  {isRace && r.delta !== 0 && r.status !== 'grid' && (
                    <span style={{ color: r.delta > 0 ? 'var(--green)' : 'var(--red)' }}>
                      <Icon name={r.delta > 0 ? 'arrowUp' : 'arrowDown'} size={10} strokeWidth={3} />
                      {Math.abs(r.delta)}
                    </span>
                  )}
                </span>
                <StatusPill row={r} />
                <span className="lb-gap tabular">{gap}</span>
                <span className="lb-tyre">
                  {r.compound !== 'UNKNOWN' && <TyreBadge compound={r.compound} size={18} age={compact ? undefined : r.tyreAge} />}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
      <footer className="lb-foot">
        <span className="dim" style={{ fontSize: 11 }}>
          {isRace
            ? orderMode === 'live'
              ? 'Ordine calcolato in tempo reale dalla posizione in pista'
              : 'Ordine dal cronometraggio ufficiale'
            : 'Ordinati per miglior giro'}
        </span>
      </footer>
    </section>
  );
}
