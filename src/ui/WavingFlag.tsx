import { useId } from 'react';
import type { TrackFlag } from '../model/flags';
import './waving-flag.css';

const W = 44;
const H = 30;
const SLICES = 16;

function Cloth({ kind }: { kind: TrackFlag }) {
  if (kind === 'chequered') {
    const cols = 8;
    const rows = 6;
    const cw = W / cols;
    const rh = H / rows;
    return (
      <>
        {Array.from({ length: cols * rows }, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          return <rect key={i} x={c * cw} y={r * rh} width={cw + 0.2} height={rh + 0.2} fill={(c + r) % 2 ? '#f5f5f7' : '#0a0a0c'} />;
        })}
      </>
    );
  }
  const color =
    kind === 'red' ? '#e10600' : kind === 'green' ? '#1fae4b' : kind === 'yellow' || kind === 'double-yellow' || kind === 'sc' || kind === 'vsc' ? '#ffd60a' : '#8e8e93';
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill={color} />
      {(kind === 'sc' || kind === 'vsc') && (
        <text x={W / 2} y={H / 2 + 5} textAnchor="middle" fontSize={kind === 'sc' ? 15 : 12} fontWeight={850} fill="#0a0a0c" fontFamily="-apple-system, 'Inter Variable', sans-serif">
          {kind === 'sc' ? 'SC' : 'VSC'}
        </text>
      )}
    </>
  );
}

/** A flag waving on its pole. Each vertical slice of the cloth moves with a phase delay. */
function OneFlag({ kind, x = 0 }: { kind: TrackFlag; x?: number }) {
  const id = useId().replace(/:/g, '');
  const sw = W / SLICES;
  return (
    <g transform={`translate(${x} 0)`}>
      <defs>
        {Array.from({ length: SLICES }, (_, i) => (
          <clipPath key={i} id={`${id}-c${i}`}>
            <rect x={i * sw - 0.15} y={-2} width={sw + 0.3} height={H + 4} />
          </clipPath>
        ))}
        <linearGradient id={`${id}-pole`} x1="0" x2="1">
          <stop offset="0" stopColor="#8e8e93" />
          <stop offset="0.5" stopColor="#f2f2f7" />
          <stop offset="1" stopColor="#636366" />
        </linearGradient>
      </defs>
      <rect x={0} y={2} width={2.4} height={H + 14} rx={1.2} fill={`url(#${id}-pole)`} />
      <circle cx={1.2} cy={2.2} r={2} fill="#d1d1d6" />
      <g transform="translate(2.4 4)">
        {Array.from({ length: SLICES }, (_, i) => (
          <g key={i} clipPath={`url(#${id}-c${i})`}>
            <g className="wf-slice" style={{ ['--i' as string]: i, ['--amp' as string]: `${(i / SLICES) * 3.2}px` }}>
              <Cloth kind={kind} />
            </g>
          </g>
        ))}
      </g>
    </g>
  );
}

export function WavingFlag({ kind, size = 1 }: { kind: TrackFlag; size?: number }) {
  if (kind === 'none') return null;
  const double = kind === 'double-yellow';
  const vw = double ? W * 2 + 14 : W + 6;
  return (
    <svg className="wf" width={vw * 0.7 * size} height={(H + 18) * 0.7 * size} viewBox={`0 0 ${vw} ${H + 18}`} aria-hidden>
      <OneFlag kind={kind} />
      {double && <OneFlag kind={kind} x={W + 10} />}
    </svg>
  );
}
