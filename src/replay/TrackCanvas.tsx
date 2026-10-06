import { useEffect, useRef } from 'react';
import { leaderNum, safetyCarAt } from '../model/derive';
import { rotatedBounds } from '../model/geometry';
import { carAt, distanceAt } from '../model/interp';
import type { SessionData } from '../model/types';
import { usePlayback } from './store';
import { buildTrackGeo, drawCarShape, niceScaleBar, speedColor } from './trackArt';
import { liveOrder } from './useStandings';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const FONT = '-apple-system, BlinkMacSystemFont, "Inter Variable", "Segoe UI", sans-serif';
const SECTOR_COLORS = ['#ff453a', '#0a84ff', '#ffd60a'];

export function TrackCanvas({ data, insets }: { data: SessionData; insets: Insets }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ zoom: 1, panX: 0, panY: 0 });
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const screenPos = useRef(new Map<number, { x: number; y: number }>());
  const ripples = useRef<{ num: number; color: string; start: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let W = 0;
    let H = 0;
    let dpr = 1;
    const ref = data.ref;
    const n = ref.x.length;
    const geo = buildTrackGeo(ref);
    const upm = ref.unitsPerMeter || 10;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const st = usePlayback.getState();
      const t = st.t;
      const nowMs = performance.now();
      const ins = insetsRef.current;
      const rot = ref.rotation + st.rotation;
      const a = (rot * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const b = rotatedBounds(ref, rot);
      const bw = b.maxX - b.minX || 1;
      const bh = b.maxY - b.minY || 1;
      const freeW = Math.max(120, W - ins.left - ins.right);
      const freeH = Math.max(120, H - ins.top - ins.bottom);
      const v = view.current;
      const baseScale = Math.min(freeW / bw, freeH / bh) * 0.86;
      let scale = baseScale * v.zoom;
      const cxScreen = ins.left + freeW / 2;
      const cyScreen = ins.top + freeH / 2;
      let wcx = (b.minX + b.maxX) / 2;
      let wcy = (b.minY + b.maxY) / 2;

      const followNum = st.follow ? st.selected[0] : undefined;
      if (followNum != null) {
        const tr = data.tracks.get(followNum);
        const p = tr && carAt(tr, t);
        if (p) {
          if (v.zoom < 3) v.zoom = 4;
          scale = baseScale * v.zoom;
          wcx = p.x * ca - p.y * sa;
          wcy = p.x * sa + p.y * ca;
          v.panX = 0;
          v.panY = 0;
        }
      }

      const sx = (x: number, y: number) => cxScreen + (x * ca - y * sa - wcx) * scale + v.panX;
      const sy = (x: number, y: number) => cyScreen - (x * sa + y * ca - wcy) * scale + v.panY;
      /** screen angle of a world direction */
      const sAngle = (dx: number, dy: number) => Math.atan2(-(dx * sa + dy * ca), dx * ca - dy * sa);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const halfPx = geo.halfWidth * scale; // half track width on screen
      const bandW = Math.max(9, halfPx * 2);
      const detailed = halfPx > 3;
      const offsetPath = (k: number, from = 0, to = n) => {
        const p = new Path2D();
        for (let i = from; i <= to; i++) {
          const j = ((i % n) + n) % n;
          const x = ref.x[j] + geo.nx[j] * k;
          const y = ref.y[j] + geo.ny[j] * k;
          if (i === from) p.moveTo(sx(x, y), sy(x, y));
          else p.lineTo(sx(x, y), sy(x, y));
        }
        return p;
      };
      const center = offsetPath(0);

      // ---- run-off halo
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = bandW + Math.max(14, halfPx * 3);
      ctx.stroke(center);

      // ---- pit lane
      if (ref.pitLane && ref.pitLane.x.length > 3) {
        const pl = ref.pitLane;
        const p = new Path2D();
        for (let i = 0; i < pl.x.length; i++) {
          const X = sx(pl.x[i], pl.y[i]);
          const Y = sy(pl.x[i], pl.y[i]);
          if (i === 0) p.moveTo(X, Y);
          else p.lineTo(X, Y);
        }
        ctx.strokeStyle = '#141419';
        ctx.lineWidth = Math.max(4, bandW * 0.62);
        ctx.stroke(p);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(10,132,255,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke(p);
        ctx.setLineDash([]);
      }

      // ---- asphalt (or speed map)
      if (st.showSpeedMap && ref.speed) {
        ctx.lineCap = 'round';
        ctx.lineWidth = bandW + 2;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          ctx.strokeStyle = speedColor(ref.speed[i]);
          ctx.beginPath();
          ctx.moveTo(sx(ref.x[i], ref.y[i]), sy(ref.x[i], ref.y[i]));
          ctx.lineTo(sx(ref.x[j], ref.y[j]), sy(ref.x[j], ref.y[j]));
          ctx.stroke();
        }
        ctx.lineCap = 'round';
      } else {
        ctx.strokeStyle = '#1b1b21';
        ctx.lineWidth = bandW;
        ctx.stroke(center);
      }

      // ---- track edges
      if (detailed) {
        const e = Math.max(geo.halfWidth, (bandW / 2 - 0.5) / scale);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = Math.min(2, Math.max(0.7, halfPx * 0.08));
        ctx.stroke(offsetPath(e));
        ctx.stroke(offsetPath(-e));
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke(center);
      }

      // ---- kerbs (red/white on the inside of tight corners)
      if (halfPx > 2.2) {
        const kw = Math.max(1.6, halfPx * 0.22);
        for (const k of geo.kerbs) {
          const off = (geo.halfWidth - kw / scale / 2) * k.side;
          const p = offsetPath(off, k.from, k.to);
          ctx.lineCap = 'butt';
          ctx.lineWidth = kw;
          ctx.strokeStyle = '#f5f5f7';
          ctx.stroke(p);
          ctx.setLineDash([Math.max(2.5, 3.2 * upm * scale), Math.max(2.5, 3.2 * upm * scale)]);
          ctx.strokeStyle = '#e10600';
          ctx.stroke(p);
          ctx.setLineDash([]);
          ctx.lineCap = 'round';
        }
      }

      // ---- DRS zones
      if (st.showDrs) {
        ref.drs.forEach(([f0, f1], zi) => {
          const i0 = Math.floor(f0 * n);
          let i1 = Math.floor(f1 * n);
          if (i1 < i0) i1 += n;
          const p = offsetPath(0, i0, i1);
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(48,209,88,0.20)';
          ctx.lineWidth = bandW;
          ctx.stroke(p);
          ctx.setLineDash([2, 7]);
          ctx.lineDashOffset = -(nowMs / 45) % 9;
          ctx.strokeStyle = 'rgba(48,209,88,0.9)';
          ctx.lineWidth = 1.6;
          ctx.stroke(p);
          ctx.setLineDash([]);
          ctx.lineCap = 'round';
          // activation line + label
          const j = i0 % n;
          const ax = ref.x[j];
          const ay = ref.y[j];
          const e = geo.halfWidth * 1.5;
          ctx.strokeStyle = '#30d158';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx(ax + geo.nx[j] * e, ay + geo.ny[j] * e), sy(ax + geo.nx[j] * e, ay + geo.ny[j] * e));
          ctx.lineTo(sx(ax - geo.nx[j] * e, ay - geo.ny[j] * e), sy(ax - geo.nx[j] * e, ay - geo.ny[j] * e));
          ctx.stroke();
          const side = geo.kappa[j] > 0 ? -1 : 1;
          const lx = sx(ax + geo.nx[j] * side * geo.halfWidth, ay + geo.ny[j] * side * geo.halfWidth) + 0;
          const ly = sy(ax + geo.nx[j] * side * geo.halfWidth, ay + geo.ny[j] * side * geo.halfWidth);
          const ox = Math.cos(sAngle(geo.nx[j] * side, geo.ny[j] * side)) * 16;
          const oy = Math.sin(sAngle(geo.nx[j] * side, geo.ny[j] * side)) * 16;
          ctx.font = `700 9.5px ${FONT}`;
          const txt = `DRS ${zi + 1}`;
          const tw = ctx.measureText(txt).width + 10;
          ctx.fillStyle = '#30d158';
          ctx.beginPath();
          ctx.roundRect(lx + ox - tw / 2, ly + oy - 8, tw, 16, 4);
          ctx.fill();
          ctx.fillStyle = '#04140a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, lx + ox, ly + oy + 0.5);
        });
      }

      // ---- direction chevrons
      if (detailed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.4;
        for (const i of geo.chevrons) {
          const X = sx(ref.x[i], ref.y[i]);
          const Y = sy(ref.x[i], ref.y[i]);
          const ang = sAngle(geo.ny[i], -geo.nx[i]);
          const s = Math.min(6, halfPx * 0.5);
          ctx.save();
          ctx.translate(X, Y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(-s * 0.6, -s);
          ctx.lineTo(s * 0.4, 0);
          ctx.lineTo(-s * 0.6, s);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ---- sector boundaries
      const crossTick = (i: number, color: string, label: string) => {
        const j = ((i % n) + n) % n;
        const e = geo.halfWidth + 3 / scale;
        const x0 = ref.x[j] + geo.nx[j] * e;
        const y0 = ref.y[j] + geo.ny[j] * e;
        const x1 = ref.x[j] - geo.nx[j] * e;
        const y1 = ref.y[j] - geo.ny[j] * e;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(sx(x0, y0), sy(x0, y0));
        ctx.lineTo(sx(x1, y1), sy(x1, y1));
        ctx.stroke();
        ctx.lineCap = 'round';
        const side = geo.kappa[j] > 0 ? 1 : -1;
        const lx = ref.x[j] + geo.nx[j] * side * (geo.halfWidth + 16 / scale);
        const ly = ref.y[j] + geo.ny[j] * side * (geo.halfWidth + 16 / scale);
        ctx.font = `700 9.5px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(label, sx(lx, ly), sy(lx, ly));
      };
      if (ref.sectors) {
        crossTick(Math.round(ref.sectors[0] * n), SECTOR_COLORS[1], 'S2');
        crossTick(Math.round(ref.sectors[1] * n), SECTOR_COLORS[2], 'S3');
      }

      // ---- start / finish + grid
      {
        const j = 0;
        const X = sx(ref.x[j], ref.y[j]);
        const Y = sy(ref.x[j], ref.y[j]);
        const ang = sAngle(geo.nx[j], geo.ny[j]);
        ctx.save();
        ctx.translate(X, Y);
        ctx.rotate(ang);
        const half = Math.max(5, halfPx + 2);
        const sq = Math.max(1.5, Math.min(4, half / 4));
        for (let yy = -half, k = 0; yy < half; yy += sq, k++) {
          for (let r = 0; r < 2; r++) {
            ctx.fillStyle = (k + r) % 2 ? '#f5f5f7' : '#0a0a0c';
            ctx.fillRect(yy, -sq + r * sq, sq, sq);
          }
        }
        ctx.restore();
        if (detailed) {
          const side = geo.kappa[j] > 0 ? 1 : -1;
          const e = geo.halfWidth + 24 / scale;
          const lx = ref.x[j] + geo.nx[j] * side * e;
          const ly = ref.y[j] + geo.ny[j] * side * e;
          ctx.font = `700 9px ${FONT}`;
          ctx.fillStyle = 'rgba(235,235,245,0.7)';
          ctx.textAlign = 'center';
          ctx.fillText('START · FINISH', sx(lx, ly), sy(lx, ly));
        }
      }
      if (ref.grid.length && halfPx > 4 && t < data.raceStart + 60) {
        for (const g of ref.grid) {
          const X = sx(g.x, g.y);
          const Y = sy(g.x, g.y);
          const ang = sAngle(Math.cos(g.angle), Math.sin(g.angle));
          ctx.save();
          ctx.translate(X, Y);
          ctx.rotate(ang);
          const L = 3.2 * upm * scale;
          const Wd = 1.6 * upm * scale;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(L * 0.6, -Wd);
          ctx.lineTo(L * 0.6, Wd);
          ctx.moveTo(L * 0.6, -Wd);
          ctx.lineTo(L * 0.2, -Wd);
          ctx.moveTo(L * 0.6, Wd);
          ctx.lineTo(L * 0.2, Wd);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ---- corners
      if (st.showCorners && geo.corners.length) {
        const showNames = halfPx > 2.6;
        for (const c of geo.corners) {
          const j = c.idx;
          const e = geo.halfWidth + 20 / scale;
          const lx = ref.x[j] + geo.nx[j] * c.out * e;
          const ly = ref.y[j] + geo.ny[j] * c.out * e;
          const X = sx(lx, ly);
          const Y = sy(lx, ly);
          ctx.fillStyle = 'rgba(20,20,26,0.92)';
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(X, Y, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = `650 9.5px ${FONT}`;
          ctx.fillStyle = '#f5f5f7';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.num, X, Y + 0.5);
          if (showNames && c.name) {
            ctx.font = `500 10px ${FONT}`;
            ctx.fillStyle = 'rgba(235,235,245,0.55)';
            const dirx = Math.cos(sAngle(geo.nx[j] * c.out, geo.ny[j] * c.out));
            ctx.textAlign = dirx >= 0 ? 'left' : 'right';
            ctx.fillText(c.name, X + (dirx >= 0 ? 13 : -13), Y + 0.5);
          }
        }
      }

      // ---- pit lane label (drawn above the asphalt)
      if (ref.pitLane && ref.pitLane.x.length > 3 && detailed) {
        const pl = ref.pitLane;
        const mid = Math.floor(pl.x.length / 2);
        const pr = { x: pl.x[mid], y: pl.y[mid] };
        // push the label away from the racing line
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < n; i += 3) {
          const d = (ref.x[i] - pr.x) ** 2 + (ref.y[i] - pr.y) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        const dx = pr.x - ref.x[best];
        const dy = pr.y - ref.y[best];
        const len = Math.hypot(dx, dy) || 1;
        const k = 22 / scale;
        const lx = pr.x + (dx / len) * k;
        const ly = pr.y + (dy / len) * k;
        const mx = sx(lx, ly);
        const my = sy(lx, ly);
        ctx.font = `650 9.5px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = 'PIT LANE · 80 km/h';
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(10,40,80,0.85)';
        ctx.beginPath();
        ctx.roundRect(mx - tw / 2, my - 8, tw, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#7cc0ff';
        ctx.fillText(label, mx, my + 0.5);
      }

      // ---- scale bar
      {
        const { metres, px } = niceScaleBar(1 / (scale * upm));
        const x0 = ins.left + 18;
        const y0 = H - ins.bottom - 14;
        ctx.strokeStyle = 'rgba(235,235,245,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - 4);
        ctx.lineTo(x0, y0);
        ctx.lineTo(x0 + px, y0);
        ctx.lineTo(x0 + px, y0 - 4);
        ctx.stroke();
        ctx.font = `600 10px ${FONT}`;
        ctx.fillStyle = 'rgba(235,235,245,0.55)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(metres >= 1000 ? `${metres / 1000} km` : `${metres} m`, x0 + px + 8, y0 + 4);
        ctx.fillText(`${(ref.lengthM / 1000).toFixed(3)} km / giro`, x0, y0 - 8);
      }

      // ---- cars
      const selected = new Set(st.selected);
      const positions = screenPos.current;
      positions.clear();
      const carLenPx = 5.6 * upm * scale;
      const shapes = carLenPx > 16;
      const r = Math.max(4.5, Math.min(7.5, halfPx * 0.75));
      const drawList: { num: number; x: number; y: number; alpha: number; sel: boolean; color: string; code: string; ang: number }[] = [];
      for (const drv of data.drivers) {
        const tr = data.tracks.get(drv.num);
        if (!tr) continue;
        const p = carAt(tr, t);
        if (!p) continue;
        const ret = data.retiredAt.get(drv.num);
        let alpha = 1;
        if (ret != null && t >= ret) {
          alpha = Math.max(0, 0.35 - (t - ret) / 120);
          if (alpha <= 0) continue;
        }
        if (!p.live) alpha *= 0.35;
        if (t < tr.t[0] - 5) continue;
        const X = sx(p.x, p.y);
        const Y = sy(p.x, p.y);
        const q = carAt(tr, t - 0.3);
        const ang = q && (q.x !== p.x || q.y !== p.y) ? sAngle(p.x - q.x, p.y - q.y) : 0;
        positions.set(drv.num, { x: X, y: Y });
        drawList.push({ num: drv.num, x: X, y: Y, alpha, sel: selected.has(drv.num), color: drv.color, code: drv.code, ang });
        if (st.showTrails && p.live && alpha > 0.5 && !shapes) {
          const steps = 10;
          let px = X;
          let py = Y;
          for (let k = 1; k <= steps; k++) {
            const qq = carAt(tr, t - k * 0.18);
            if (!qq || !qq.live) break;
            const cx2 = sx(qq.x, qq.y);
            const cy2 = sy(qq.x, qq.y);
            ctx.strokeStyle = hexToRgba(drv.color, 0.45 * (1 - k / steps) * alpha);
            ctx.lineWidth = 3 * (1 - k / (steps + 2));
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(cx2, cy2);
            ctx.stroke();
            px = cx2;
            py = cy2;
          }
        }
      }
      drawList.sort((a1, b1) => Number(a1.sel) - Number(b1.sel));
      for (const c of drawList) {
        ctx.globalAlpha = c.alpha;
        if (shapes) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.ang);
          const k = upm * scale;
          ctx.scale(k, k);
          drawCarShape(ctx, c.color, c.sel);
          ctx.restore();
        } else {
          if (c.sel) {
            ctx.fillStyle = hexToRgba(c.color, 0.22);
            ctx.beginPath();
            ctx.arc(c.x, c.y, r * 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = c.color;
          ctx.strokeStyle = c.sel ? '#fff' : 'rgba(0,0,0,0.75)';
          ctx.lineWidth = c.sel ? 2 : 1.4;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.sel ? r * 1.2 : r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // labels: broadcast style "P  CODE", de-cluttered
      if (st.showNames) {
        ctx.font = `650 10.5px ${FONT}`;
        ctx.textBaseline = 'middle';
        const placed: [number, number, number, number][] = [];
        const order = [...drawList].sort((a1, b1) => Number(b1.sel) - Number(a1.sel) || (liveOrder.get(a1.num) ?? 99) - (liveOrder.get(b1.num) ?? 99));
        const off = shapes ? Math.max(14, carLenPx * 0.5) : r + 5;
        for (const c of order) {
          if (c.alpha < 0.3 && !c.sel) continue;
          const pos = liveOrder.get(c.num);
          const codeW = ctx.measureText(c.code).width;
          const posTxt = pos != null ? String(pos) : '';
          ctx.font = `700 10px ${FONT}`;
          const posW = posTxt ? Math.max(16, ctx.measureText(posTxt).width + 8) : 0;
          ctx.font = `650 10.5px ${FONT}`;
          const w = posW + codeW + 12;
          const h = 17;
          const bx = c.x + off;
          const by = c.y - h / 2 - (shapes ? 0 : 7);
          const rect: [number, number, number, number] = [bx, by, w, h];
          const hit = placed.some((p) => rect[0] < p[0] + p[2] && rect[0] + rect[2] > p[0] && rect[1] < p[1] + p[3] && rect[1] + rect[3] > p[1]);
          if (hit && !c.sel) continue;
          placed.push(rect);
          ctx.globalAlpha = Math.min(1, c.alpha + 0.15);
          ctx.fillStyle = c.sel ? 'rgba(245,245,247,0.96)' : 'rgba(14,14,18,0.86)';
          ctx.beginPath();
          ctx.roundRect(bx, by, w, h, 4);
          ctx.fill();
          if (posTxt) {
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.roundRect(bx, by, posW, h, [4, 0, 0, 4]);
            ctx.fill();
            ctx.font = `700 10px ${FONT}`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 2;
            ctx.fillText(posTxt, bx + posW / 2, by + h / 2 + 0.5);
            ctx.shadowBlur = 0;
          }
          ctx.font = `650 10.5px ${FONT}`;
          ctx.textAlign = 'left';
          ctx.fillStyle = c.sel ? '#000' : '#f5f5f7';
          ctx.fillText(c.code, bx + posW + 6, by + h / 2 + 0.5);
        }
        ctx.globalAlpha = 1;
      }

      // ---- overtake markers
      ripples.current = ripples.current.filter((rp) => nowMs - rp.start < 1100);
      for (const rp of ripples.current) {
        const pos = positions.get(rp.num);
        if (!pos) continue;
        const k = (nowMs - rp.start) / 1100;
        const ease = 1 - (1 - k) ** 3;
        ctx.strokeStyle = `rgba(48,209,88,${0.85 * (1 - k)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + ease * 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ---- safety car
      const lead = leaderNum(data, t);
      if (lead != null) {
        const sc = safetyCarAt(data, t, distanceAt(data.tracks.get(lead)!, t));
        if (sc && sc.alpha > 0.01) {
          const X = sx(sc.x, sc.y);
          const Y = sy(sc.x, sc.y);
          const pulse = 0.5 + 0.5 * Math.sin(nowMs / 220);
          ctx.globalAlpha = sc.alpha;
          ctx.fillStyle = `rgba(255,159,10,${0.12 + 0.12 * pulse})`;
          ctx.beginPath();
          ctx.arc(X, Y, r * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff9f0a';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(X, Y, r * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          const label = sc.phase === 'deploying' ? 'SAFETY CAR · USCITA' : sc.phase === 'returning' ? 'SAFETY CAR · RIENTRO' : 'SAFETY CAR';
          ctx.font = `700 9.5px ${FONT}`;
          const tw = ctx.measureText(label).width + 12;
          ctx.fillStyle = '#ff9f0a';
          ctx.beginPath();
          ctx.roundRect(X + r + 5, Y - 8, tw, 16, 4);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, X + r + 11, Y + 0.5);
          ctx.globalAlpha = 1;
        }
      }
    };
    raf = requestAnimationFrame(draw);

    // ---- interaction: zoom, pan, pick
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const ins = insetsRef.current;
      const cx = ins.left + Math.max(120, W - ins.left - ins.right) / 2;
      const cy = ins.top + Math.max(120, H - ins.top - ins.bottom) / 2;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nz = Math.max(0.6, Math.min(40, v.zoom * factor));
      const k = nz / v.zoom;
      v.panX = (v.panX - (mx - cx)) * k + (mx - cx);
      v.panY = (v.panY - (my - cy)) * k + (my - cy);
      v.zoom = nz;
      if (usePlayback.getState().follow && nz < 1.4) usePlayback.setState({ follow: false });
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        // hover cursor
        const rect = canvas.getBoundingClientRect();
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
        canvas.style.cursor = hit != null ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (moved && !usePlayback.getState().follow) {
        view.current.panX += dx;
        view.current.panY += dy;
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const pick = (x: number, y: number) => {
      let best: number | null = null;
      let bestD = 16 * 16;
      for (const [num, p] of screenPos.current) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = num;
        }
      }
      return best;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        const rect = canvas.getBoundingClientRect();
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
        if (hit != null) usePlayback.getState().select(hit, e.shiftKey || e.metaKey);
      }
    };
    const onDbl = () => {
      view.current = { zoom: 1, panX: 0, panY: 0 };
      usePlayback.setState({ follow: false });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('dblclick', onDbl);
    const onResetView = () => onDbl();
    window.addEventListener('pitwall:reset-view', onResetView);
    const onZoom = (e: Event) => {
      const k = (e as CustomEvent<number>).detail;
      view.current.zoom = Math.max(0.6, Math.min(40, view.current.zoom * k));
      view.current.panX *= k;
      view.current.panY *= k;
    };
    window.addEventListener('pitwall:zoom', onZoom);
    const onOvertake = (e: Event) => {
      const num = (e as CustomEvent<number>).detail;
      const d = data.byNum.get(num);
      if (d) ripples.current.push({ num, color: d.color, start: performance.now() });
    };
    window.addEventListener('pitwall:overtake', onOvertake);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('dblclick', onDbl);
      window.removeEventListener('pitwall:reset-view', onResetView);
      window.removeEventListener('pitwall:zoom', onZoom);
      window.removeEventListener('pitwall:overtake', onOvertake);
    };
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Mappa del circuito con le posizioni delle monoposto"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' }}
    />
  );
}
