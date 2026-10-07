import { useId } from 'react';
import { COMPOUND_COLORS } from '../model/constants';
import type { Compound } from '../model/types';

function mix(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

/**
 * Plan view of a current-generation Formula 1 car in the style of a
 * technical drawing, painted in the team colour. Points to the right.
 */
export function TopCar({
  color,
  compound,
  className,
  style,
  title,
  detail = true,
  number,
  accent,
}: {
  color: string;
  compound?: Compound;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  detail?: boolean;
  /** Race number painted on the engine cover and nose. */
  number?: number;
  /** Second livery colour for the centre stripe. */
  accent?: string;
}) {
  const id = useId().replace(/:/g, '');
  const tyre = compound ? COMPOUND_COLORS[compound] : '#3a3a40';
  const dark = mix(color, -0.55);
  const light = mix(color, 0.35);
  return (
    <svg viewBox="0 0 220 84" className={className} style={style} role="img" aria-label={title ?? 'Monoposto vista dall’alto'}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark} />
          <stop offset="0.38" stopColor={color} />
          <stop offset="0.5" stopColor={light} />
          <stop offset="0.62" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#202026" />
          <stop offset="0.5" stopColor="#2c2c33" />
          <stop offset="1" stopColor="#141418" />
        </linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c0c0e" />
          <stop offset="0.5" stopColor="#25252a" />
          <stop offset="1" stopColor="#0c0c0e" />
        </linearGradient>
      </defs>

      {/* floor */}
      <path d="M20 24 L150 27 L158 34 L158 50 L150 57 L20 60 Z" fill="#0d0d10" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />

      {/* suspension */}
      <g stroke="#55555c" strokeWidth="1.3" strokeLinecap="round">
        <path d="M44 14 L76 26 M44 14 L66 34 M44 70 L76 58 M44 70 L66 50" />
        <path d="M166 13 L142 32 M166 13 L150 36 M166 71 L142 52 M166 71 L150 48" />
      </g>

      {/* tyres */}
      {[
        [28, 2, 34, 20],
        [28, 62, 34, 20],
        [152, 3, 28, 17],
        [152, 64, 28, 17],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx={4} fill={`url(#${id}-t)`} />
          {detail && <rect x={x + 3} y={i % 2 ? y + h - 2.6 : y + 0.8} width={w - 6} height={1.8} rx={0.9} fill={tyre} opacity={0.95} />}
          {detail && <path d={`M${x + 6} ${y + h / 2} H${x + w - 6}`} stroke="rgba(255,255,255,0.06)" strokeWidth={h * 0.7} />}
        </g>
      ))}

      {/* rear wing */}
      <rect x="4" y="10" width="16" height="64" rx="2" fill={`url(#${id}-c)`} />
      <rect x="6" y="12" width="5" height="60" rx="1.5" fill={color} />
      <rect x="2" y="9" width="20" height="3" rx="1" fill="#0b0b0e" />
      <rect x="2" y="72" width="20" height="3" rx="1" fill="#0b0b0e" />

      {/* body: engine cover, sidepods, cockpit, nose */}
      <path
        d="M22 31 C38 29 54 22 70 20 L114 21 C124 22 130 28 134 31 L148 33 L192 38 C196 39 196 45 192 46 L148 51 L134 53 C130 56 124 62 114 63 L70 64 C54 62 38 55 22 53 Z"
        fill={`url(#${id}-b)`}
        stroke="rgba(0,0,0,0.6)"
        strokeWidth="0.8"
      />
      {/* sidepod inlets & undercut shading */}
      <path d="M112 22 C120 23 125 27 127 30 L114 30 Z M112 62 C120 61 125 57 127 54 L114 54 Z" fill="#050506" />
      <path d="M70 21 C60 23 46 29 30 32 M70 63 C60 61 46 55 30 52" stroke="rgba(0,0,0,0.35)" strokeWidth="2" fill="none" />

      {/* livery centre line */}
      {detail && <path d="M30 42 L196 42" stroke={accent ?? 'rgba(255,255,255,0.55)'} strokeWidth={accent ? 2.4 : 1.2} />}
      {number != null && (
        <g fontFamily="-apple-system, 'Inter Variable', sans-serif" fontWeight="850" fontStyle="italic" fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="0.4">
          <text x="84" y="47" fontSize="14" textAnchor="middle">
            {number}
          </text>
          <text x="168" y="44.6" fontSize="6.5" textAnchor="middle">
            {number}
          </text>
        </g>
      )}

      {/* airbox, cockpit, driver, halo */}
      <ellipse cx="110" cy="42" rx="7" ry="4.2" fill="#060607" />
      <ellipse cx="128" cy="42" rx="11" ry="6.4" fill="#060607" />
      <circle cx="126" cy="42" r="4.6" fill="#f2f2f2" />
      <path d="M123 39.5 h5 v5 h-5 z" fill="#111" opacity="0.8" />
      <path d="M116 35 C126 33 136 36 141 42 C136 48 126 51 116 49" fill="none" stroke="#1a1a1e" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M141 42 L148 42" stroke="#1a1a1e" strokeWidth="2.2" strokeLinecap="round" />

      {/* front wing */}
      <path d="M198 6 L210 8 L212 76 L198 78 Z" fill={`url(#${id}-c)`} />
      <path d="M202 9 L208 10 L209 74 L202 75 Z" fill={color} />
      <rect x="196" y="4" width="16" height="4" rx="1.4" fill="#0b0b0e" />
      <rect x="196" y="76" width="16" height="4" rx="1.4" fill="#0b0b0e" />
      <path d="M192 38 L202 39.5 C205 40.5 205 43.5 202 44.5 L192 46 Z" fill={dark} />
    </svg>
  );
}
