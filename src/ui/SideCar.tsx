import { useId } from 'react';
import { COMPOUND_COLORS } from '../model/constants';
import type { Compound } from '../model/types';
import { mixColor } from './livery';

/**
 * Side elevation of a current-generation Formula 1 car, nose to the right,
 * painted in the team livery. A vector illustration: no sponsor marks.
 */
export function SideCar({
  color,
  accent,
  number,
  name,
  compound,
  className,
  title,
}: {
  color: string;
  accent: string;
  number?: number;
  name?: string;
  compound?: Compound;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const dark = mixColor(color, -0.55);
  const light = mixColor(color, 0.3);
  const tyreBand = compound ? COMPOUND_COLORS[compound] : '#d6d6dc';
  const wheel = (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-tyre)`} />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={tyreBand} strokeWidth={r * 0.06} opacity={0.9} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="#121216" />
      <circle cx={cx} cy={cy} r={r * 0.56} fill={`url(#${id}-rim)`} />
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        return <line key={k} x1={cx + Math.cos(a) * r * 0.18} y1={cy + Math.sin(a) * r * 0.18} x2={cx + Math.cos(a) * r * 0.52} y2={cy + Math.sin(a) * r * 0.52} stroke="#2c2c33" strokeWidth={r * 0.06} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.16} fill={accent} />
      <circle cx={cx} cy={cy} r={r * 0.07} fill="#0a0a0c" />
    </g>
  );
  return (
    <svg viewBox="0 0 620 170" className={className} role="img" aria-label={title ?? 'Monoposto vista di lato'}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.35" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}-carbon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a31" />
          <stop offset="1" stopColor="#0b0b0e" />
        </linearGradient>
        <radialGradient id={`${id}-tyre`}>
          <stop offset="0.6" stopColor="#1a1a1e" />
          <stop offset="0.92" stopColor="#0c0c0e" />
          <stop offset="1" stopColor="#25252a" />
        </radialGradient>
        <radialGradient id={`${id}-rim`} cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#4a4a52" />
          <stop offset="1" stopColor="#141418" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="320" cy="156" rx="290" ry="7" fill="rgba(0,0,0,0.35)" />

      {/* rear wing: endplate, main plane + flap, beam wing */}
      <path d="M18 26 L74 26 L80 104 L26 104 Z" fill={`url(#${id}-carbon)`} />
      <path d="M14 22 L80 22 L80 32 L14 34 Z" fill={color} />
      <path d="M14 36 L80 35 L80 42 L14 44 Z" fill="#0d0d10" />
      <path d="M22 50 L70 50" stroke={accent} strokeWidth="3" opacity="0.9" />
      <path d="M40 92 L96 94 L96 100 L40 99 Z" fill="#0d0d10" />

      {/* wing pylon down to the gearbox */}
      <path d="M50 42 L62 42 L70 100 L56 100 Z" fill="#141418" />
      {/* floor and diffuser */}
      <path d="M70 128 L470 124 L478 132 L70 138 Z" fill="#09090b" />
      <path d="M60 116 L100 116 L96 132 L56 130 Z" fill="#111114" />

      {/* rear suspension */}
      <g stroke="#3a3a42" strokeWidth="3" strokeLinecap="round">
        <path d="M120 100 L160 106 M118 120 L160 116" />
      </g>

      {/* main body */}
      <path d={BODY} fill={`url(#${id}-body)`} stroke="rgba(0,0,0,0.55)" strokeWidth="1" />
      <g clipPath={`url(#${id}-clip)`}>
        {/* dark lower livery */}
        <path d="M60 118 C140 112 200 108 260 112 C330 116 380 112 430 110 L600 112 L600 140 L60 140 Z" fill={dark} opacity="0.9" />
        {/* accent sweep */}
        <path d="M150 92 C220 74 300 70 360 78 C420 86 470 98 560 104 L560 110 C470 104 420 94 360 86 C300 80 220 84 150 100 Z" fill={accent} opacity="0.95" />
        {/* top highlight */}
        <path d="M90 92 C160 82 220 64 268 52 L300 52 L300 58 C240 66 170 86 90 98 Z" fill={`url(#${id}-shine)`} opacity="0.7" />
      </g>

      {/* sidepod inlet and undercut */}
      <path d="M318 86 C326 84 334 86 338 90 L336 108 C330 106 322 106 316 108 Z" fill="#050506" />
      <path d="M200 124 C250 118 300 116 336 114" stroke="rgba(0,0,0,0.45)" strokeWidth="5" fill="none" />

      {/* airbox and roll hoop */}
      <path d="M262 46 L300 44 L306 60 L268 62 Z" fill="#060607" />
      <path d="M270 40 L298 38 L300 46 L266 48 Z" fill={color} stroke="rgba(0,0,0,0.5)" />
      <rect x="282" y="31" width="10" height="8" rx="2" fill="#111" />

      {/* driver: helmet */}
      <circle cx="336" cy="66" r="12" fill={accent} />
      <path d="M327 63 C333 59 342 59 347 63 L347 68 L327 68 Z" fill="#0a0a0c" />
      <path d="M326 72 C334 76 342 76 348 72" stroke={color} strokeWidth="3" fill="none" />

      {/* halo */}
      <path d="M300 64 C316 46 360 46 392 76" fill="none" stroke="#141418" strokeWidth="6" strokeLinecap="round" />
      <path d="M385 68 L388 80" stroke="#141418" strokeWidth="5" strokeLinecap="round" />

      {/* mirror */}
      <path d="M372 84 L392 82 L392 89 L372 90 Z" fill={color} stroke="rgba(0,0,0,0.5)" />
      <path d="M378 90 L380 98" stroke="#141418" strokeWidth="2" />

      {/* front suspension */}
      <g stroke="#3a3a42" strokeWidth="3" strokeLinecap="round">
        <path d="M430 100 L478 108 M430 114 L478 116" />
      </g>

      {/* front wing: endplate + elements */}
      <path d="M498 126 L604 122 L606 134 L500 138 Z" fill={`url(#${id}-carbon)`} />
      <path d="M520 124 L604 120 L604 124 L520 128 Z" fill={color} />
      <path d="M586 104 L604 104 L608 136 L584 136 Z" fill={`url(#${id}-carbon)`} />
      <path d="M590 108 L600 108 L602 132 L590 132 Z" fill={accent} opacity="0.9" />

      {/* wheels */}
      {wheel(140, 114, 40)}
      {wheel(478, 116, 37)}

      {/* race number on the engine cover */}
      {number != null && (
        <text x="208" y="100" fontSize="30" fontWeight="850" fontStyle="italic" fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="1" fontFamily="-apple-system, 'Inter Variable', sans-serif">
          {number}
        </text>
      )}
      {/* driver name by the cockpit */}
      {name && (
        <text x="356" y="104" fontSize="9" fontWeight="750" letterSpacing="1" fill="#fff" opacity="0.9" fontFamily="-apple-system, 'Inter Variable', sans-serif">
          {name.toUpperCase()}
        </text>
      )}
    </svg>
  );
}

const BODY =
  'M58 118 L58 98 C110 94 190 70 262 54 L300 52 L312 62 L330 70 C350 74 372 76 394 78 C440 84 500 96 556 104 L574 108 L576 114 L556 118 C500 118 450 118 410 118 L338 120 C300 124 240 126 200 126 C170 126 150 122 120 120 Z';
