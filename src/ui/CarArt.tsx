import { useId } from 'react';
import { COMPOUND_COLORS } from '../model/constants';
import type { Compound } from '../model/types';

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function Wheel({ cx, cy, r, compound, id }: { cx: number; cy: number; r: number; compound: Compound; id: string }) {
  return (
    <g className="wheel">
      <circle cx={cx} cy={cy} r={r} fill="#0a0a0c" />
      <circle cx={cx} cy={cy} r={r - 2} fill={`url(#${id}-tyre)`} />
      <circle cx={cx} cy={cy} r={r * 0.74} fill="none" stroke={COMPOUND_COLORS[compound]} strokeWidth={2.4} opacity={0.95} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill={`url(#${id}-rim)`} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => {
        const a = (k / 10) * Math.PI * 2;
        return (
          <line
            key={k}
            x1={cx + Math.cos(a) * r * 0.16}
            y1={cy + Math.sin(a) * r * 0.16}
            x2={cx + Math.cos(a) * r * 0.58}
            y2={cy + Math.sin(a) * r * 0.58}
            stroke="#3a3a42"
            strokeWidth={2.2}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.16} fill="#55555e" />
      <circle cx={cx} cy={cy} r={r * 0.06} fill="#c7c7cc" />
    </g>
  );
}

/**
 * Stylised side-profile of a ground-effect era Formula 1 car, painted in a
 * team colour. Pure SVG — no external images needed.
 */
export function CarArt({
  color,
  number,
  compound = 'SOFT',
  accent = '#ffffff',
  className,
  style,
  title,
  spinning,
}: {
  spinning?: boolean;
  color: string;
  number?: number | string;
  compound?: Compound;
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const dark = shade(color, -0.45);
  const mid = shade(color, -0.18);
  const light = shade(color, 0.25);
  return (
    <svg viewBox="0 0 660 190" className={`${className ?? ''}${spinning ? ' spin-wheels' : ''}`} style={style} role="img" aria-label={title ?? 'Monoposto'}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}-cover`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.6" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}-carbon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2c33" />
          <stop offset="1" stopColor="#0b0b0e" />
        </linearGradient>
        <radialGradient id={`${id}-tyre`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0.6" stopColor="#1b1b1f" />
          <stop offset="1" stopColor="#060607" />
        </radialGradient>
        <radialGradient id={`${id}-rim`} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#2a2a31" />
          <stop offset="1" stopColor="#0e0e11" />
        </radialGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.75" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="330" cy="176" rx="320" ry="12" fill={`url(#${id}-shadow)`} />

      {/* floor & plank */}
      <path d="M150 156 L575 154 L580 160 L150 162 Z" fill="#08080a" />
      <path d="M170 150 C260 146 470 146 560 150 L560 157 L170 158 Z" fill={`url(#${id}-carbon)`} />

      {/* rear wing */}
      <path d="M574 58 L622 50 L626 138 L580 140 Z" fill={`url(#${id}-carbon)`} />
      <path d="M556 48 L640 36 L642 52 L560 62 Z" fill={`url(#${id}-body)`} />
      <path d="M560 66 L636 56 L637 64 L562 72 Z" fill={dark} />
      <path d="M548 112 L604 108 L605 116 L550 120 Z" fill={`url(#${id}-carbon)`} />
      <rect x="586" y="62" width="34" height="5" rx="2" fill={accent} opacity="0.85" />

      {/* engine cover & shark fin */}
      <path
        d="M300 104 C318 72 344 54 372 50 L396 52 C428 70 486 92 566 112 L566 128 C520 118 470 110 300 108 Z"
        fill={`url(#${id}-cover)`}
      />
      <path d="M396 52 C430 66 500 86 560 102 L556 108 C490 92 430 74 394 60 Z" fill={dark} opacity="0.5" />
      {/* airbox */}
      <path d="M368 52 C372 46 390 44 398 50 L396 64 L370 64 Z" fill="#050506" />

      {/* sidepod & chassis */}
      <path
        d="M168 150 L178 120 C214 110 270 104 300 104 L470 106 C506 110 534 118 566 128 L566 150 Z"
        fill={`url(#${id}-body)`}
      />
      {/* sidepod inlet */}
      <path d="M300 106 C318 106 330 110 336 122 L304 124 Z" fill="#050506" />
      {/* livery sweep */}
      <path d="M318 132 C380 120 460 120 560 134 L560 140 C460 128 382 128 318 140 Z" fill={accent} opacity="0.9" />
      <path d="M180 140 C240 132 300 130 336 132 L336 136 C300 135 240 137 180 146 Z" fill={accent} opacity="0.55" />

      {/* nose */}
      <path d="M20 140 C70 132 130 120 186 114 L190 136 C130 140 70 146 20 150 Z" fill={`url(#${id}-body)`} />
      <path d="M20 140 C70 132 130 120 186 114 L186 118 C130 124 70 136 22 144 Z" fill="#fff" opacity="0.18" />

      {/* cockpit, driver & halo */}
      <path d="M250 104 C262 96 300 92 336 96 L330 106 L254 108 Z" fill="#050506" />
      <circle cx="300" cy="90" r="15" fill={accent} />
      <path d="M287 86 C292 80 308 80 314 86 L314 92 L287 92 Z" fill="#0b0b10" />
      <path d="M287 86 C292 80 308 80 314 86" stroke="#ffd60a" strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M250 104 C268 76 316 70 350 82" stroke="#0e0e12" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M252 102 C270 78 316 72 348 82" stroke="#5a5a64" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M336 96 L340 82" stroke="#0e0e12" strokeWidth="4" strokeLinecap="round" />

      {/* mirror */}
      <path d="M236 98 L252 96 L254 102 L238 104 Z" fill={dark} />

      {/* front wing */}
      <path d="M2 156 L118 150 L120 160 L0 164 Z" fill={`url(#${id}-carbon)`} />
      <path d="M8 148 L112 142 L114 148 L8 154 Z" fill={`url(#${id}-body)`} />
      <path d="M2 134 L16 132 L18 164 L4 164 Z" fill={`url(#${id}-carbon)`} />

      {/* gloss pass */}
      <path
        d="M178 120 C214 110 270 104 300 104 C318 72 344 54 372 50 L396 52 C428 70 486 92 566 112 L566 122 C480 104 410 92 300 108 C260 108 214 114 180 126 Z"
        fill={`url(#${id}-gloss)`}
      />

      {number != null && (
        <text
          x="455"
          y="102"
          fontSize="24"
          fontWeight="800"
          fontStyle="italic"
          fill={accent}
          fontFamily="-apple-system, 'Inter Variable', sans-serif"
          transform="rotate(14 455 102)"
        >
          {number}
        </text>
      )}

      {/* suspension */}
      <path d="M150 128 L210 112 M150 134 L212 126" stroke="#18181c" strokeWidth="3" />
      <path d="M520 128 L470 112 M520 134 L468 128" stroke="#18181c" strokeWidth="3" />

      <Wheel cx={150} cy={134} r={36} compound={compound} id={id} />
      <Wheel cx={520} cy={132} r={38} compound={compound} id={id} />
    </svg>
  );
}

export { shade };
