import { useId, useMemo } from 'react';
import { outlinePath, type CircuitGeo } from '../data/circuits';

/**
 * Real circuit layout (north up). Optionally draws itself in, shows the
 * start/finish line and animates cars lapping it.
 */
export function CircuitOutline({
  circuit,
  width = 400,
  height = 300,
  stroke = 2.5,
  animate = false,
  cars = [],
  className,
  showStart = true,
  glow = false,
}: {
  circuit: CircuitGeo;
  width?: number;
  height?: number;
  stroke?: number;
  animate?: boolean;
  cars?: { color: string; lap: number; offset?: number }[];
  className?: string;
  showStart?: boolean;
  glow?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const { d, start, pts } = useMemo(() => outlinePath(circuit, width, height, stroke * 4 + 6), [circuit, width, height, stroke]);
  const ang = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) + Math.PI / 2;
  const sl = stroke * 3.4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`Tracciato: ${circuit.name}`}>
      <defs>
        {glow && (
          <filter id={`${id}-g`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={stroke * 2.4} />
          </filter>
        )}
      </defs>
      <path id={`${id}-p`} d={d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke * 4.2} strokeLinejoin="round" />
      {glow && <path d={d} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={stroke * 2} strokeLinejoin="round" filter={`url(#${id}-g)`} />}
      <path
        d={d}
        fill="none"
        stroke="#f5f5f7"
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={animate ? 1 : undefined}
        className={animate ? 'draw-on slow' : undefined}
      />
      {showStart && (
        <line
          x1={start[0] - Math.cos(ang) * sl}
          y1={start[1] - Math.sin(ang) * sl}
          x2={start[0] + Math.cos(ang) * sl}
          y2={start[1] + Math.sin(ang) * sl}
          stroke="#e10600"
          strokeWidth={stroke * 1.2}
          strokeLinecap="round"
        />
      )}
      {cars.map((c, i) => (
        <g key={i}>
          <circle r={stroke * 2.6} fill={c.color} opacity={0.35}>
            <animateMotion dur={`${c.lap}s`} repeatCount="indefinite" begin={`-${c.offset ?? 0}s`} calcMode="paced">
              <mpath href={`#${id}-p`} />
            </animateMotion>
          </circle>
          <circle r={stroke * 1.5} fill={c.color} stroke="#000" strokeWidth={stroke * 0.4}>
            <animateMotion dur={`${c.lap}s`} repeatCount="indefinite" begin={`-${c.offset ?? 0}s`} calcMode="paced">
              <mpath href={`#${id}-p`} />
            </animateMotion>
          </circle>
        </g>
      ))}
    </svg>
  );
}
