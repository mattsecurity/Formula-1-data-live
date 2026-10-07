import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { raceLapAt } from '../model/derive';
import type { Period, SessionData } from '../model/types';
import { useThrottledTime } from './store';
import './neutralisation.css';

type Kind = 'SC' | 'VSC';
type Cue = { id: number; kind: 'SC_IN' | 'VSC_END' };

/** Safety car seen from above, nose to the right, with a roof light bar. */
function SafetyCarTop() {
  return (
    <svg className="nx-car" viewBox="0 0 220 96" aria-hidden>
      <defs>
        <linearGradient id="nxBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d44" />
          <stop offset="0.5" stopColor="#1c1e23" />
          <stop offset="1" stopColor="#2c2f35" />
        </linearGradient>
        <linearGradient id="nxGlass" x1="0" x2="1">
          <stop offset="0" stopColor="#0b0c10" />
          <stop offset="1" stopColor="#262a33" />
        </linearGradient>
      </defs>
      {/* tyres */}
      {[
        [42, 6],
        [42, 78],
        [160, 6],
        [160, 78],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="30" height="12" rx="4" fill="#0a0a0c" />
      ))}
      {/* body */}
      <path
        d="M14 30 C14 18 26 12 46 12 L150 12 C178 12 200 22 210 38 C213 44 213 52 210 58 C200 74 178 84 150 84 L46 84 C26 84 14 78 14 66 Z"
        fill="url(#nxBody)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
      {/* livery stripes */}
      <path d="M46 40 L196 40 M46 56 L196 56" stroke="#ffd60a" strokeWidth="3" opacity="0.85" />
      {/* bonnet vents */}
      <path d="M168 34 L188 38 M168 62 L188 58" stroke="#0d0e12" strokeWidth="3" strokeLinecap="round" />
      {/* cabin */}
      <path d="M70 22 L132 22 C142 22 150 30 152 48 C150 66 142 74 132 74 L70 74 C62 74 58 66 58 48 C58 30 62 22 70 22 Z" fill="url(#nxGlass)" />
      <rect x="80" y="27" width="40" height="42" rx="6" fill="#30333b" />
      {/* light bar: left / centre / right */}
      <rect x="92" y="26" width="16" height="14" rx="3" className="nx-lb nx-lb-a" />
      <rect x="92" y="41" width="16" height="14" rx="3" fill="#15161a" />
      <rect x="92" y="56" width="16" height="14" rx="3" className="nx-lb nx-lb-b" />
      {/* headlights */}
      <path d="M200 30 L208 40 M200 66 L208 56" stroke="#e8f1ff" strokeWidth="3" strokeLinecap="round" />
      {/* tail lights */}
      <path d="M16 30 L16 40 M16 56 L16 66" stroke="#ff3b30" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const GLYPHS: Record<string, string[]> = {
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
};

/** The LED panels marshals light up around the circuit. */
function LedPanel({ text }: { text: string }) {
  const cell = 7;
  const cols = text.length * 6 - 1;
  const off: JSX.Element[] = [];
  const on: JSX.Element[] = [];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < cols; c++) {
      const g = GLYPHS[text[Math.floor(c / 6)]];
      const lit = c % 6 < 5 && g?.[r][c % 6] === '1';
      const cx = c * cell + cell / 2;
      const cy = r * cell + cell / 2;
      off.push(<circle key={`${r}-${c}`} cx={cx} cy={cy} r={2.6} fill="#1c1608" />);
      if (lit)
        on.push(
          <g key={`${r}-${c}`}>
            <circle cx={cx} cy={cy} r={4.2} fill="#ffb800" opacity={0.28} />
            <circle cx={cx} cy={cy} r={2.7} fill="#ffc933" />
          </g>,
        );
    }
  return (
    <div className="nx-led">
      <svg viewBox={`0 0 ${cols * cell} ${7 * cell}`} width={cols * cell * 1.5} height={7 * cell * 1.5} aria-hidden>
        {off}
        <g className="nx-on">{on}</g>
      </svg>
    </div>
  );
}

/** A delta readout that settles like the on-board VSC delta. */
function DeltaReadout() {
  const [v, setV] = useState(1.2);
  useEffect(() => {
    const id = setInterval(() => setV((x) => Math.max(0.1, x * 0.82 + (Math.random() - 0.5) * 0.05)), 120);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="nx-delta">
      <span>Delta</span>
      <b className="num">+{v.toFixed(1)}</b>
    </div>
  );
}

function Title({ text }: { text: string }) {
  return (
    <motion.div className="nx-title" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.028, delayChildren: 0.25 } } }}>
      {text.split(' ').map((word, w) => (
        <span key={w} className="nx-word">
          {word.split('').map((ch, i) => (
            <motion.span
              key={i}
              variants={{
                h: { opacity: 0, y: 14, filter: 'blur(6px)' },
                s: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 420, damping: 28 } },
              }}
            >
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.div>
  );
}

function Intro({ kind, lap }: { kind: Kind; lap: number }) {
  const sc = kind === 'SC';
  return (
    <motion.div className={`nx-intro ${sc ? 'is-sc' : 'is-vsc'}`} initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div className="nx-flash" />
      <motion.div
        className="nx-hazard top"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        exit={{ scaleX: 0, transition: { duration: 0.35 } }}
        transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }}
      />
      <motion.div
        className="nx-hazard bottom"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        exit={{ scaleX: 0, transition: { duration: 0.35 } }}
        transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1], delay: 0.08 }}
      />
      <motion.div
        className="nx-card"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.55, y: -260, transition: { duration: 0.55, ease: [0.6, 0, 0.3, 1] } }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="nx-stage">
          {sc ? (
            <>
              <div className="nx-speedlines">
                {[0, 1, 2, 3].map((i) => (
                  <motion.i
                    key={i}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: [0, 1, 0], opacity: [0, 0.8, 0] }}
                    transition={{ duration: 0.75, delay: 0.05 + i * 0.06, ease: 'easeOut' }}
                  />
                ))}
              </div>
              <motion.div
                initial={{ x: -420, filter: 'blur(10px)' }}
                animate={{ x: 0, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 120, damping: 15, mass: 0.9 }}
              >
                <SafetyCarTop />
              </motion.div>
            </>
          ) : (
            <motion.div initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
              <LedPanel text="VSC" />
            </motion.div>
          )}
        </div>
        <div className="nx-copy">
          <div className="nx-kicker">{lap > 0 ? `Giro ${lap} · ` : ''}Direzione gara</div>
          <Title text={sc ? 'Safety Car' : 'Virtual Safety Car'} />
          <motion.div className="nx-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            {sc ? 'In pista · sorpassi vietati · gruppo compatto dietro la vettura di sicurezza' : 'Velocità ridotta in tutto il tracciato · tempo delta obbligatorio'}
          </motion.div>
          {!sc && <DeltaReadout />}
        </div>
      </motion.div>
    </motion.div>
  );
}

const CUE_TEXT: Record<Cue['kind'], { title: string; sub: string }> = {
  SC_IN: { title: 'Safety Car in this lap', sub: 'La Safety Car rientra ai box a fine giro · luci spente' },
  VSC_END: { title: 'VSC ending', sub: 'Fine della Virtual Safety Car · bandiera verde tra pochi secondi' },
};

/**
 * Broadcast-style graphics for neutralisations: a full-screen intro when the
 * Safety Car or VSC is deployed, an amber frame while it lasts, the "in this
 * lap" / "ending" cues and a green sweep when racing resumes.
 */
export function NeutralisationFx({ data }: { data: SessionData }) {
  const t = useThrottledTime(120);
  const prev = useRef(t);
  const [intro, setIntro] = useState<{ id: number; kind: Kind; lap: number } | null>(null);
  const [cue, setCue] = useState<Cue | null>(null);
  const [sweep, setSweep] = useState<number | null>(null);
  const active: Period | undefined = data.periods.find((p) => (p.kind === 'SC' || p.kind === 'VSC') && t >= p.start && t < p.end);

  useEffect(() => {
    const a = prev.current;
    prev.current = t;
    if (!(t > a && t - a < 60)) return; // only while playing, not when seeking
    for (const p of data.periods) {
      if (p.kind !== 'SC' && p.kind !== 'VSC') continue;
      if (a < p.start && t >= p.start) setIntro({ id: p.start, kind: p.kind, lap: raceLapAt(data, p.start) });
      const cueAt = p.kind === 'SC' ? p.inLap : p.end - 10;
      if (cueAt != null && cueAt > p.start + 5 && a < cueAt && t >= cueAt) setCue({ id: cueAt, kind: p.kind === 'SC' ? 'SC_IN' : 'VSC_END' });
      if (a < p.end && t >= p.end && p.end < data.endT - 1) setSweep(p.end);
    }
  }, [t, data]);

  useEffect(() => {
    if (!intro) return;
    const id = setTimeout(() => setIntro(null), 3600);
    return () => clearTimeout(id);
  }, [intro]);
  useEffect(() => {
    if (!cue) return;
    const id = setTimeout(() => setCue(null), 4200);
    return () => clearTimeout(id);
  }, [cue]);
  useEffect(() => {
    if (sweep == null) return;
    const id = setTimeout(() => setSweep(null), 1600);
    return () => clearTimeout(id);
  }, [sweep]);

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div
            key={`edge-${active.kind}`}
            className={`nx-edge ${active.kind === 'SC' ? 'is-sc' : 'is-vsc'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{intro && <Intro key={intro.id} kind={intro.kind} lap={intro.lap} />}</AnimatePresence>
      <AnimatePresence>
        {cue && (
          <motion.div
            key={cue.id}
            className="nx-cue glass glass-strong"
            initial={{ opacity: 0, y: -14, clipPath: 'inset(0 100% 0 0 round 14px)' }}
            animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0 round 14px)' }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
            role="alert"
          >
            <span className="nx-cue-lights">
              <i />
              <i />
            </span>
            <span className="nx-cue-text">
              <b>{CUE_TEXT[cue.kind].title}</b>
              <span>{CUE_TEXT[cue.kind].sub}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sweep != null && (
          <motion.div key={sweep} className="nx-sweep" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.i initial={{ x: '-30vw' }} animate={{ x: '130vw' }} transition={{ duration: 1.1, ease: [0.5, 0, 0.3, 1] }} />
            <motion.b initial={{ x: '130vw' }} animate={{ x: '-30vw' }} transition={{ duration: 1.1, ease: [0.5, 0, 0.3, 1] }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
