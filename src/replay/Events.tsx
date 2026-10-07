import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { fmtLapTime } from '../model/standings';
import type { SessionData } from '../model/types';
import { Headshot } from '../ui/Headshot';
import { usePlayback, useThrottledTime } from './store';
import type { OvertakeEvent } from './useStandings';
import './events.css';

// ---------------------------------------------------------------- start lights

const LIGHT_STEP = 0.85; // seconds between columns, close to the real 1 s
const LIGHT_FIRST = 1.0;

/** One pod of the gantry: two dark upper lamps and the two red ones used for the start. */
function LightPod({ i, on, out }: { i: number; on: boolean; out: boolean }) {
  return (
    <motion.div
      className={`sl-pod ${on ? 'on' : ''}`}
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 + i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
    >
      {[0, 1, 2, 3].map((r) => {
        const red = r >= 2;
        return (
          <span key={r} className={`sl-lamp ${red ? 'red' : ''} ${red && on ? 'on' : ''}`}>
            <i className="sl-led" />
            <AnimatePresence>
              {red && on && (
                <motion.i
                  key="ring"
                  className="sl-ring"
                  initial={{ scale: 0.6, opacity: 0.9 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>
          </span>
        );
      })}
      <span className={`sl-num ${on ? 'on' : ''} ${out ? 'out' : ''}`}>{i + 1}</span>
    </motion.div>
  );
}

export function StartLights({ onDone }: { onDone: () => void }) {
  const [lit, setLit] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => setLit(i), (LIGHT_FIRST + (i - 1) * LIGHT_STEP) * 1000));
    // like the real start, the hold after the fifth light is random
    const hold = (LIGHT_FIRST + 4 * LIGHT_STEP + 0.7 + Math.random() * 1.6) * 1000;
    timers.push(setTimeout(() => setOut(true), hold));
    timers.push(setTimeout(onDone, hold + 1700));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  const glow = out ? 0 : lit / 5;
  return (
    <motion.div
      className="lights-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)', transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } }}
    >
      {/* red spill on the scene, growing with every light */}
      <motion.div className="sl-spill" animate={{ opacity: glow }} transition={{ duration: out ? 0.08 : 0.35 }} />
      <motion.div
        className="sl-kicker"
        initial={{ opacity: 0, y: 8, letterSpacing: '0.5em' }}
        animate={{ opacity: out ? 0 : 1, y: 0, letterSpacing: '0.32em' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        Partenza
      </motion.div>
      <motion.div
        className="sl-gantry"
        initial={{ y: -120, opacity: 0, rotateX: 25 }}
        animate={out ? { y: -16, opacity: 1, rotateX: 0 } : { y: 0, opacity: 1, rotateX: 0 }}
        transition={{ type: 'spring', stiffness: 140, damping: 16 }}
        role="img"
        aria-label={out ? 'Luci spente, via!' : `${lit} luci accese`}
      >
        <div className="sl-beam" />
        <div className="sl-pods">
          {[0, 1, 2, 3, 4].map((i) => (
            <LightPod key={i} i={i} on={!out && lit > i} out={out} />
          ))}
        </div>
        <motion.div className="sl-floor" animate={{ opacity: glow }} transition={{ duration: out ? 0.08 : 0.35 }} />
      </motion.div>
      <div className="sl-go-wrap">
        <AnimatePresence>
          {out && (
            <>
              <motion.div
                key="flash"
                className="sl-flash"
                initial={{ opacity: 0.55, scale: 0.4 }}
                animate={{ opacity: 0, scale: 2.2 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
              <motion.div key="go" className="lights-go" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.035 } } }}>
                {'Luci spente'.split('').map((ch, k) => (
                  <motion.span
                    key={k}
                    variants={{
                      hidden: { opacity: 0, x: -24, filter: 'blur(8px)' },
                      show: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 380, damping: 26 } },
                    }}
                  >
                    {ch === ' ' ? '\u00a0' : ch}
                  </motion.span>
                ))}
              </motion.div>
              <motion.div
                key="sub"
                className="sl-go-sub"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.25, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              >
                Via!
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <button className="btn btn-secondary btn-sm lights-skip" onClick={onDone}>
        Salta
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------- chequered flag

function CheckerStrip() {
  return (
    <div className="checker" aria-hidden>
      {Array.from({ length: 24 }, (_, c) => (
        <span key={c}>
          <i style={{ background: c % 2 ? '#f5f5f7' : '#0a0a0c' }} />
          <i style={{ background: c % 2 ? '#0a0a0c' : '#f5f5f7' }} />
        </span>
      ))}
    </div>
  );
}

export function Chequered({ data }: { data: SessionData }) {
  const t = useThrottledTime(200);
  const first = data.finishAt.size ? Math.min(...data.finishAt.values()) : null;
  const winnerNum = [...data.finishAt.entries()].find(([, v]) => v === first)?.[0];
  const winner = winnerNum != null ? data.byNum.get(winnerNum) : undefined;
  const [show, setShow] = useState(false);
  const prev = useRef(t);
  useEffect(() => {
    if (first != null && prev.current < first && t >= first && t - prev.current < 60) setShow(true);
    prev.current = t;
  }, [t, first]);
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(false), 8000);
    return () => clearTimeout(id);
  }, [show]);
  return (
    <AnimatePresence>
      {show && winner && (
        <motion.div
          className="cheq glass glass-strong"
          style={{ ['--team' as string]: winner.color }}
          initial={{ y: -30, opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          onClick={() => setShow(false)}
          role="status"
        >
          <CheckerStrip />
          <div className="cheq-body">
            <Headshot driver={winner} size={56} />
            <div>
              <div className="label">Bandiera a scacchi · Vincitore</div>
              <div className="cheq-name">
                {winner.first} <b>{winner.last.toUpperCase()}</b>
              </div>
              <div className="cheq-team">{winner.team}</div>
            </div>
            <span className="cheq-p1 num">P1</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- track status banner

type BannerKind = 'SC' | 'VSC' | 'RED' | 'GREEN';
const BANNER: Record<BannerKind, { text: string; sub: string; cls: string }> = {
  SC: { text: 'Safety Car', sub: 'Safety Car in pista · sorpassi vietati', cls: 'b-sc' },
  VSC: { text: 'Virtual Safety Car', sub: 'Delta di velocità obbligatorio', cls: 'b-vsc' },
  RED: { text: 'Bandiera rossa', sub: 'Sessione sospesa', cls: 'b-red' },
  GREEN: { text: 'Pista libera', sub: 'Bandiera verde · si torna a correre', cls: 'b-green' },
};

export function StatusBanner({ data }: { data: SessionData }) {
  const t = useThrottledTime(150);
  const prev = useRef(t);
  const [banner, setBanner] = useState<{ id: number; kind: BannerKind } | null>(null);
  useEffect(() => {
    const a = prev.current;
    prev.current = t;
    if (!(t > a && t - a < 60)) return;
    for (const p of data.periods) {
      if (a < p.start && t >= p.start) setBanner({ id: p.start, kind: p.kind });
      else if (a < p.end && t >= p.end && p.end < data.endT - 1) setBanner({ id: p.end + 0.5, kind: 'GREEN' });
    }
  }, [t, data]);
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 3800);
    return () => clearTimeout(id);
  }, [banner]);
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          className={`status-banner glass glass-strong ${BANNER[banner.kind].cls}`}
          initial={{ opacity: 0, y: -14, clipPath: 'inset(0 100% 0 0 round 14px)' }}
          animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0 round 14px)' }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
          role="alert"
        >
          <span className="sb-flag" />
          <span className="sb-text">
            <b>{BANNER[banner.kind].text}</b>
            <span>{BANNER[banner.kind].sub}</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- event feed

interface FeedItem {
  id: string;
  kind: 'overtake' | 'fastest' | 'pit' | 'out';
  at: number;
  render: () => React.ReactNode;
}

export function EventFeed({ data, overtakes }: { data: SessionData; overtakes: OvertakeEvent[] }) {
  const t = useThrottledTime(150);
  const speed = usePlayback((s) => s.speed);
  const prev = useRef(t);
  const best = useRef<number>(Infinity);
  const [items, setItems] = useState<FeedItem[]>([]);
  const isRace = data.meta.kind === 'race';

  useEffect(() => {
    const a = prev.current;
    prev.current = t;
    if (!(t > a && t - a < 60)) {
      // seeking: recompute the best lap so far silently
      best.current = Infinity;
      for (const l of data.laps) if (l.end != null && l.end <= t && l.dur != null && !l.pitOut && l.lap > 1) best.current = Math.min(best.current, l.dur);
      return;
    }
    const now = performance.now();
    const fresh: FeedItem[] = [];
    for (const l of data.laps) {
      if (l.end == null || l.dur == null || l.pitOut || l.lap < 2 || !(l.end > a && l.end <= t)) continue;
      if (l.dur < best.current) {
        const hadBest = Number.isFinite(best.current);
        best.current = l.dur;
        const d = data.byNum.get(l.driver);
        if (d && hadBest)
          fresh.push({
            id: `f${l.driver}-${l.lap}`,
            kind: 'fastest',
            at: now,
            render: () => (
              <>
                <span className="feed-badge purple">Giro veloce</span>
                <b style={{ color: d.color }}>{d.code}</b>
                <span className="tabular">{fmtLapTime(l.dur)}</span>
              </>
            ),
          });
      }
    }
    if (isRace && speed <= 32) {
      for (const p of data.pits) {
        if (!(p.t > a && p.t <= t)) continue;
        const d = data.byNum.get(p.driver);
        if (d)
          fresh.push({
            id: `p${p.driver}-${p.lap}`,
            kind: 'pit',
            at: now,
            render: () => (
              <>
                <span className="feed-badge blue">Box</span>
                <b style={{ color: d.color }}>{d.code}</b>
                <span className="dim">ai box · giro {p.lap}</span>
              </>
            ),
          });
      }
    }
    for (const [num, rt] of data.retiredAt) {
      if (!(rt > a && rt <= t)) continue;
      const d = data.byNum.get(num);
      if (d)
        fresh.push({
          id: `o${num}`,
          kind: 'out',
          at: now,
          render: () => (
            <>
              <span className="feed-badge red">Ritiro</span>
              <b style={{ color: d.color }}>{d.code}</b>
              <span className="dim">{d.full}</span>
            </>
          ),
        });
    }
    if (fresh.length) setItems((list) => [...fresh, ...list].slice(0, 6));
  }, [t, data, isRace, speed]);

  // expire old items
  useEffect(() => {
    const id = setInterval(() => setItems((list) => list.filter((i) => performance.now() - i.at < 5200)), 500);
    return () => clearInterval(id);
  }, []);

  const all: FeedItem[] = [
    ...overtakes.map((o) => {
      const a = data.byNum.get(o.by);
      const b = data.byNum.get(o.on);
      return {
        id: `ov${o.id}`,
        kind: 'overtake' as const,
        at: o.at,
        render: () => (
          <>
            <span className="feed-badge green">P{o.pos}</span>
            <b style={{ color: a?.color }}>{a?.code}</b>
            <span className="dim">supera</span>
            <b style={{ color: b?.color }}>{b?.code}</b>
          </>
        ),
      };
    }),
    ...items,
  ]
    .sort((x, y) => y.at - x.at)
    .slice(0, 4);

  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {all.map((e) => (
          <motion.div
            key={e.id}
            layout
            className={`toast glass feed-${e.kind}`}
            initial={{ opacity: 0, y: -16, scale: 0.85, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            {e.render()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
