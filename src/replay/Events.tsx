import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtLapTime } from '../model/standings';
import type { SessionData } from '../model/types';
import { Headshot } from '../ui/Headshot';
import { usePlayback, useThrottledTime } from './store';
import type { OvertakeEvent } from './useStandings';
import './events.css';

// ---------------------------------------------------------------- start lights

export function StartLights({ onDone }: { onDone: () => void }) {
  const [lit, setLit] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => setLit(i), 450 + i * 750));
    const hold = 450 + 5 * 750 + 500 + Math.random() * 900;
    timers.push(setTimeout(() => setOut(true), hold));
    timers.push(setTimeout(onDone, hold + 1500));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  return (
    <motion.div className="lights-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
      <motion.div
        className="lights glass glass-strong"
        initial={{ y: -40, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        role="img"
        aria-label={out ? 'Luci spente, via!' : `${lit} luci accese`}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="light-col">
            {[0, 1].map((r) => (
              <span key={r} className={`light ${!out && lit > i ? 'on' : ''}`} />
            ))}
          </div>
        ))}
      </motion.div>
      <AnimatePresence>
        {out && (
          <motion.div
            className="lights-go"
            initial={{ scale: 0.6, opacity: 0, filter: 'blur(12px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            Luci spente — <span className="gradient-text">via!</span>
          </motion.div>
        )}
      </AnimatePresence>
      <button className="btn btn-secondary btn-sm lights-skip" onClick={onDone}>
        Salta
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------- chequered flag

function Confetti({ colors }: { colors: string[] }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.4 + Math.random() * 2,
        rot: Math.random() * 720 - 360,
        drift: Math.random() * 200 - 100,
        color: colors[i % colors.length],
        w: 6 + Math.random() * 6,
      })),
    [colors],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            height: p.w * 0.45,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ['--rot' as string]: `${p.rot}deg`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

function CheckeredFlag() {
  const cols = 12;
  const rows = 8;
  return (
    <div className="flag" aria-hidden>
      {Array.from({ length: cols }, (_, c) => (
        <div key={c} className="flag-col" style={{ animationDelay: `${-c * 0.09}s` }}>
          {Array.from({ length: rows }, (_, r) => (
            <span key={r} style={{ background: (c + r) % 2 ? '#f5f5f7' : '#0b0b0e' }} />
          ))}
        </div>
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
    const id = setTimeout(() => setShow(false), 7000);
    return () => clearTimeout(id);
  }, [show]);
  return (
    <AnimatePresence>
      {show && winner && (
        <motion.div className="cheq-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShow(false)}>
          <Confetti colors={[winner.color, '#ffffff', '#ffd60a', winner.color]} />
          <motion.div initial={{ y: -60, rotate: -8, opacity: 0 }} animate={{ y: 0, rotate: -4, opacity: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 14 }}>
            <CheckeredFlag />
          </motion.div>
          <motion.div
            className="cheq-card glass glass-strong"
            style={{ ['--team' as string]: winner.color }}
            initial={{ y: 60, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.35 }}
          >
            <Headshot driver={winner} size={84} />
            <div>
              <div className="eyebrow">Bandiera a scacchi · Vincitore</div>
              <div className="cheq-name">
                {winner.first} <b>{winner.last}</b>
              </div>
              <div className="muted">{winner.team}</div>
            </div>
            <span className="cheq-p1">P1</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- track status banner

type BannerKind = 'SC' | 'VSC' | 'RED' | 'GREEN';
const BANNER: Record<BannerKind, { text: string; cls: string }> = {
  SC: { text: 'Safety Car', cls: 'b-sc' },
  VSC: { text: 'Virtual Safety Car', cls: 'b-vsc' },
  RED: { text: 'Bandiera rossa', cls: 'b-red' },
  GREEN: { text: 'Pista libera', cls: 'b-green' },
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
          className={`status-banner ${BANNER[banner.kind].cls}`}
          initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          exit={{ clipPath: 'inset(0 0 0 100%)' }}
          transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
          role="alert"
        >
          <motion.span initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.25, duration: 0.5 }}>
            {BANNER[banner.kind].text}
          </motion.span>
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
