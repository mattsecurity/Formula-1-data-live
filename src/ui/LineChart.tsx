import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface Series {
  id: string;
  label: string;
  color: string;
  points: [number, number][];
  width?: number;
  dash?: string;
  /** optional per-point dot colours (e.g. tyre compound) */
  dotColors?: (string | null)[];
  opacity?: number;
}

export interface Band {
  x0: number;
  x1: number;
  color: string;
  label?: string;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function LineChart({
  series,
  height = 280,
  xDomain,
  yDomain,
  invertY,
  xFormat = (v) => String(Math.round(v)),
  yFormat = (v) => String(+v.toFixed(2)),
  bands = [],
  marker,
  xLabel,
  yLabel,
  yTicks,
  highlight,
  step,
  xInteger,
}: {
  xInteger?: boolean;
  series: Series[];
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  invertY?: boolean;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  bands?: Band[];
  marker?: number;
  xLabel?: string;
  yLabel?: string;
  yTicks?: number[];
  highlight?: string[];
  step?: boolean;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const clipId = `clip-${useId().replace(/:/g, '')}`;
  const pad = { l: 52, r: 16, t: 12, b: 30 };
  const innerW = Math.max(10, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;

  const [x0, x1, y0, y1] = useMemo(() => {
    let a = Infinity;
    let b = -Infinity;
    let c = Infinity;
    let d = -Infinity;
    for (const s of series)
      for (const [x, y] of s.points) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < a) a = x;
        if (x > b) b = x;
        if (y < c) c = y;
        if (y > d) d = y;
      }
    if (!Number.isFinite(a)) return [0, 1, 0, 1];
    const [xa, xb] = xDomain ?? [a, b];
    let [ya, yb] = yDomain ?? [c, d];
    if (!yDomain) {
      const m = (yb - ya) * 0.06 || 1;
      ya -= m;
      yb += m;
    }
    return [xa, xb === xa ? xa + 1 : xb, ya, yb === ya ? ya + 1 : yb];
  }, [series, xDomain, yDomain]);

  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * innerW;
  const sy = (y: number) => {
    const f = (y - y0) / (y1 - y0);
    return pad.t + (invertY ? f : 1 - f) * innerH;
  };
  let xt = niceTicks(x0, x1, Math.max(3, Math.floor(innerW / 90)));
  if (xInteger) xt = [...new Set(xt.map((v) => Math.round(v)))].filter((v) => v >= x0 && v <= x1);
  const yt = yTicks ?? niceTicks(y0, y1, Math.max(3, Math.floor(innerH / 46)));
  const hl = highlight && highlight.length ? new Set(highlight) : null;

  const hoverRows = useMemo(() => {
    if (hoverX == null) return null;
    const rows: { s: Series; y: number }[] = [];
    for (const s of series) {
      let best: [number, number] | null = null;
      for (const p of s.points) if (Number.isFinite(p[1]) && (!best || Math.abs(p[0] - hoverX) < Math.abs(best[0] - hoverX))) best = p;
      if (best && Math.abs(best[0] - hoverX) <= (x1 - x0) / 40 + 1e-9) rows.push({ s, y: best[1] });
    }
    rows.sort((a, b) => (invertY ? a.y - b.y : b.y - a.y));
    return rows.slice(0, 12);
  }, [hoverX, series, invertY, x0, x1]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = e.clientX - r.left;
          if (px < pad.l || px > pad.l + innerW) return setHoverX(null);
          setHoverX(x0 + ((px - pad.l) / innerW) * (x1 - x0));
        }}
        onPointerLeave={() => setHoverX(null)}
        role="img"
        aria-label={yLabel ? `Grafico: ${yLabel}` : 'Grafico'}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={pad.l} y={pad.t - 4} width={innerW} height={innerH + 8} />
          </clipPath>
        </defs>
        {bands.map((b, i) => (
          <g key={i}>
            <rect x={sx(b.x0)} y={pad.t} width={Math.max(1, sx(b.x1) - sx(b.x0))} height={innerH} fill={b.color} />
            {b.label && (
              <text x={sx(b.x0) + 4} y={pad.t + 12} fontSize={10} fontWeight={700} fill="rgba(255,255,255,0.55)">
                {b.label}
              </text>
            )}
          </g>
        ))}
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={pad.l} x2={pad.l + innerW} y1={sy(v)} y2={sy(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={pad.l - 8} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize={10.5} fill="rgba(235,235,245,0.45)" className="tabular">
              {yFormat(v)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={`x${v}`} x={sx(v)} y={height - 10} textAnchor="middle" fontSize={10.5} fill="rgba(235,235,245,0.45)" className="tabular">
            {xFormat(v)}
          </text>
        ))}
        {xLabel && (
          <text x={pad.l + innerW} y={height - 10} textAnchor="end" fontSize={10} fill="rgba(235,235,245,0.3)" dy={-12}>
            {xLabel}
          </text>
        )}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => {
            if (!s.points.length) return null;
            const dim = hl && !hl.has(s.id);
            let d = '';
            let prevY: number | null = null;
            s.points.forEach(([x, y], i) => {
              if (!Number.isFinite(y)) {
                prevY = null;
                return;
              }
              const X = sx(x);
              const Y = sy(y);
              if (i === 0 || prevY == null) d += `M${X},${Y}`;
              else if (step) d += `H${X}V${Y}`;
              else d += `L${X},${Y}`;
              prevY = Y;
            });
            return (
              <g key={s.id} opacity={dim ? 0.14 : (s.opacity ?? 1)}>
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 1.8}
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={s.dash ? undefined : 1}
                  className={s.dash ? undefined : 'draw-on'}
                  style={{ transition: 'stroke-width 0.25s ease' }}
                />
                {s.dotColors &&
                  s.points.map(([x, y], i) =>
                    s.dotColors![i] && Number.isFinite(y) ? (
                      <circle key={i} cx={sx(x)} cy={sy(y)} r={2.6} fill={s.dotColors![i]!} stroke="rgba(0,0,0,0.5)" strokeWidth={0.6} />
                    ) : null,
                  )}
              </g>
            );
          })}
        </g>
        {marker != null && marker >= x0 && marker <= x1 && (
          <line x1={sx(marker)} x2={sx(marker)} y1={pad.t} y2={pad.t + innerH} stroke="rgba(255,255,255,0.7)" strokeDasharray="3 3" />
        )}
        {hoverX != null && (
          <line x1={sx(hoverX)} x2={sx(hoverX)} y1={pad.t} y2={pad.t + innerH} stroke="rgba(255,255,255,0.35)" />
        )}
      </svg>
      {hoverX != null && hoverRows && hoverRows.length > 0 && (
        <div
          className="chart-tip"
          style={{
            left: Math.min(width - 190, Math.max(0, sx(hoverX) + 12)),
            top: 8,
          }}
        >
          <div className="chart-tip-x">{xFormat(hoverX)}</div>
          {hoverRows.map(({ s, y }) => (
            <div key={s.id} className="chart-tip-row">
              <span className="chart-tip-dot" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b className="tabular">{yFormat(y)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
