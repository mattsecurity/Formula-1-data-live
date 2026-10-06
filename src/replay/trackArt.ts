import { projectS } from '../model/geometry';
import type { ReferencePath } from '../model/types';

/** World-space geometry derived once per session for the detailed map. */
export interface TrackGeo {
  n: number;
  nx: Float32Array;
  ny: Float32Array;
  /** signed curvature (1/m), positive = turning left */
  kappa: Float32Array;
  halfWidth: number; // world units
  kerbs: { from: number; to: number; side: 1 | -1 }[];
  chevrons: number[];
  corners: { num: string; name?: string; x: number; y: number; idx: number; out: 1 | -1 }[];
}

export function buildTrackGeo(ref: ReferencePath): TrackGeo {
  const n = ref.x.length;
  const upm = ref.unitsPerMeter || 10;
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const ang = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 2 + n) % n;
    const b = (i + 2) % n;
    const dx = ref.x[b] - ref.x[a];
    const dy = ref.y[b] - ref.y[a];
    const len = Math.hypot(dx, dy) || 1;
    nx[i] = -dy / len;
    ny[i] = dx / len;
    ang[i] = Math.atan2(dy, dx);
  }
  const ds = ref.length / n / upm; // metres per vertex
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let d = ang[(i + 3) % n] - ang[(i - 3 + n) % n];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    raw[i] = d / (6 * ds);
  }
  const kappa = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -4; k <= 4; k++) acc += raw[(i + k + n) % n];
    kappa[i] = acc / 9;
  }
  // kerbs on the inside of tight corners (radius < 150 m)
  const kerbs: TrackGeo['kerbs'] = [];
  let st = -1;
  for (let i = 0; i <= n; i++) {
    const k = kappa[i % n];
    const tight = i < n && Math.abs(k) > 1 / 150;
    if (tight && st < 0) st = i;
    if ((!tight || (st >= 0 && Math.sign(k) !== Math.sign(kappa[st % n]))) && st >= 0) {
      if (i - st >= 2) kerbs.push({ from: Math.max(0, st - 2), to: i + 1, side: kappa[st % n] > 0 ? 1 : -1 });
      st = tight ? i : -1;
    }
  }
  // direction chevrons on straights, roughly every 650 m
  const chevrons: number[] = [];
  const step = Math.max(10, Math.round(650 / ds));
  for (let i = Math.round(step / 2); i < n; i += step) {
    let j = i;
    while (j < Math.min(n, i + step / 2) && Math.abs(kappa[j]) > 1 / 600) j++;
    if (j < n && Math.abs(kappa[j]) <= 1 / 600) chevrons.push(j);
  }
  const corners = ref.corners.map((c) => {
    const p = projectS(ref, c.x, c.y);
    const k = kappa[p.idx];
    return { ...c, idx: p.idx, out: (k > 0 ? -1 : 1) as 1 | -1 };
  });
  // chicanes share a name: label it once
  for (let i = corners.length - 1; i > 0; i--) if (corners[i].name && corners[i].name === corners[i - 1].name) corners[i] = { ...corners[i], name: undefined };
  return { n, nx, ny, kappa, halfWidth: 7 * upm, kerbs, chevrons, corners };
}

const SPEED_STOPS: [number, [number, number, number]][] = [
  [70, [94, 92, 230]],
  [140, [10, 132, 255]],
  [210, [48, 209, 88]],
  [270, [255, 214, 10]],
  [330, [255, 69, 58]],
];

export function speedColor(v: number): string {
  if (v <= SPEED_STOPS[0][0]) return `rgb(${SPEED_STOPS[0][1].join(',')})`;
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    const [b, cb] = SPEED_STOPS[i];
    const [a, ca] = SPEED_STOPS[i - 1];
    if (v <= b) {
      const u = (v - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * u)).join(',')})`;
    }
  }
  return `rgb(${SPEED_STOPS[SPEED_STOPS.length - 1][1].join(',')})`;
}

export const SPEED_LEGEND = SPEED_STOPS.map(([v, c]) => ({ v, color: `rgb(${c.join(',')})` }));

/** Car outline in metres (pointing +x), used when zoomed in. */
export function drawCarShape(ctx: CanvasRenderingContext2D, color: string, selected: boolean) {
  // floor/body
  ctx.fillStyle = color;
  ctx.strokeStyle = selected ? '#fff' : 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(-2.6, -0.55);
  ctx.bezierCurveTo(-1.6, -0.6, -0.9, -0.85, -0.2, -0.85);
  ctx.lineTo(0.8, -0.8);
  ctx.lineTo(1.2, -0.3);
  ctx.lineTo(2.75, -0.12);
  ctx.lineTo(2.75, 0.12);
  ctx.lineTo(1.2, 0.3);
  ctx.lineTo(0.8, 0.8);
  ctx.lineTo(-0.2, 0.85);
  ctx.bezierCurveTo(-0.9, 0.85, -1.6, 0.6, -2.6, 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // wings
  ctx.fillStyle = '#18181c';
  ctx.fillRect(-2.85, -0.75, 0.32, 1.5);
  ctx.fillRect(2.55, -0.95, 0.3, 1.9);
  // tyres
  ctx.fillStyle = '#0a0a0c';
  for (const [x, y, w, h] of [
    [-2.2, -1.02, 0.75, 0.38],
    [-2.2, 0.64, 0.75, 0.38],
    [1.45, -0.98, 0.62, 0.34],
    [1.45, 0.64, 0.62, 0.34],
  ])
    ctx.fillRect(x, y, w, h);
  // cockpit
  ctx.fillStyle = '#050506';
  ctx.beginPath();
  ctx.ellipse(0.55, 0, 0.32, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function niceScaleBar(metresPerPx: number): { metres: number; px: number } {
  const options = [25, 50, 100, 200, 250, 500, 1000, 2000];
  for (const m of options) {
    const px = m / metresPerPx;
    if (px >= 60) return { metres: m, px };
  }
  return { metres: 2000, px: 2000 / metresPerPx };
}
