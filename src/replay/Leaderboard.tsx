import { motion } from 'framer-motion';
import { fmtLapTime, type StandingRow } from '../model/standings';
import type { SessionData } from '../model/types';
import { COMPOUND_COLORS, COMPOUND_LETTER } from '../model/constants';
import { usePlayback } from './store';
import type { StandingsView } from './useStandings';
import './leaderboard.css';

const COLS = [
  { id: 'interval', label: 'Int' },
  { id: 'leader', label: 'Gap' },
  { id: 'last', label: 'Ultimo' },
  { id: 'best', label: 'Best' },
] as const;

function Status({ row }: { row: StandingRow }) {
  if (row.status === 'pit') return <span className="tw-tag tw-pit">PIT</span>;
  if (row.status === 'out') return <span className="tw-tag tw-out">OUT</span>;
  if (row.status === 'fin') return <span className="tw-tag tw-fin">FIN</span>;
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
  const fastest = view.rows.reduce<StandingRow | null>((m, r) => (r.best != null && (m == null || r.best < m.best!) ? r : m), null);
  const cols = isRace ? COLS : COLS.filter((c) => c.id !== 'interval');
  const mode = !isRace && gapMode === 'interval' ? 'leader' : gapMode;

  const value = (r: StandingRow) => {
    if (r.status === 'out') return 'OUT';
    if (mode === 'last') return fmtLapTime(r.lastLap);
    if (mode === 'best') return fmtLapTime(r.best);
    if (!isRace) return r.gap;
    return mode === 'leader' ? r.gap : r.interval;
  };

  return (
    <section className={`tw glass ${compact ? 'tw-compact' : ''}`} aria-label="Classifica live">
      <header className="tw-head">
        <span className="label">{isRace ? (orderMode === 'live' ? 'Live' : 'Ufficiale') : 'Tempi'}</span>
        <div className="tw-cols" role="group" aria-label="Colonna dati">
          {cols.map((c) => (
            <button key={c.id} aria-pressed={mode === c.id} onClick={() => set({ gapMode: c.id })}>
              {c.label}
            </button>
          ))}
        </div>
      </header>
      <ol className="tw-list scroll-y">
        {view.rows.map((r, idx) => {
          const d = data.byNum.get(r.num)!;
          const flash = view.flashes.get(r.num);
          const isSel = selected.includes(r.num);
          const isFastest = fastest?.num === r.num;
          return (
            <motion.li
              key={r.num}
              layout="position"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 560, damping: 46, opacity: { delay: 0.25 + idx * 0.02 }, x: { delay: 0.25 + idx * 0.02 } }}
              className={`tw-row ${isSel ? 'is-sel' : ''} ${r.status === 'out' ? 'is-out' : ''} ${
                flash && flash.until > now ? (flash.dir > 0 ? 'up' : 'down') : ''
              }`}
              style={{ ['--team' as string]: d.color }}
            >
              <button className="tw-btn" onClick={(e) => select(r.num, e.shiftKey || e.metaKey)} aria-pressed={isSel} aria-label={`P${r.pos} ${d.full}, ${d.team}`}>
                <span className="tw-pos num">{r.pos}</span>
                <span className="tw-bar" />
                <span className="tw-code">{d.code}</span>
                <span className="tw-delta num" aria-hidden>
                  {isRace && r.delta !== 0 && r.status !== 'grid' ? (
                    <span className={r.delta > 0 ? 'pos' : 'neg'}>
                      {r.delta > 0 ? '▲' : '▼'}
                      {Math.abs(r.delta)}
                    </span>
                  ) : null}
                </span>
                <span className="tw-flags">
                  <Status row={r} />
                  {isFastest && <span className="tw-fl" title="Giro più veloce" />}
                </span>
                <span className={`tw-val num ${mode === 'best' && isFastest ? 'purple' : ''}`}>{value(r)}</span>
                {!compact && (
                  <span className="tw-tyre" title={`${r.compound} · ${r.tyreAge} giri`}>
                    {r.compound !== 'UNKNOWN' && (
                      <>
                        <i style={{ borderColor: COMPOUND_COLORS[r.compound] }}>{COMPOUND_LETTER[r.compound]}</i>
                        <span className="num">{r.tyreAge}</span>
                      </>
                    )}
                  </span>
                )}
                {!compact && isRace && <span className="tw-pits num" title="Soste">{r.pits || ''}</span>}
              </button>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
