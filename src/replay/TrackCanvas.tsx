import { useEffect, useRef } from 'react';
import { rotatedBounds } from '../model/geometry';
import { carAt } from '../model/interp';
import { leaderNum, safetyCarAt } from '../model/derive';
import { distanceAt } from '../model/interp';
import type { SessionData } from '../model/types';
import { usePlayback } from './store';

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
      const baseScale = Math.min(freeW / bw, freeH / bh) * 0.9;
      let scale = baseScale * v.zoom;
      const cxScreen = ins.left + freeW / 2;
      const cyScreen = ins.top + freeH / 2;
      let wcx = (b.minX + b.maxX) / 2;
      let wcy = (b.minY + b.maxY) / 2;

      // follow the first selected car
      const followNum = st.follow ? st.selected[0] : undefined;
      if (followNum != null) {
        const tr = data.tracks.get(followNum);
        const p = tr && carAt(tr, t);
        if (p) {
          if (v.zoom < 2.2) v.zoom = 2.6;
          scale = baseScale * v.zoom;
          wcx = p.x * ca - p.y * sa;
          wcy = p.x * sa + p.y * ca;
          v.panX = 0;
          v.panY = 0;
        }
      }

      const toScreen = (x: number, y: number) => {
        const xr = x * ca - y * sa;
        const yr = x * sa + y * ca;
        return [cxScreen + (xr - wcx) * scale + v.panX, cyScreen - (yr - wcy) * scale + v.panY] as const;
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // ---- track
      const trackW = Math.max(7, Math.min(30, 150 * scale));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const path = new Path2D();
      for (let i = 0; i <= n; i++) {
        const [sx, sy] = toScreen(ref.x[i % n], ref.y[i % n]);
        if (i === 0) path.moveTo(sx, sy);
        else path.lineTo(sx, sy);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = trackW + 18;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = trackW + 3;
      ctx.stroke(path);
      ctx.strokeStyle = '#1f1f26';
      ctx.lineWidth = trackW;
      ctx.stroke(path);

      // sectors: subtle tint on the kerb line
      if (ref.sectors) {
        const [f1, f2] = ref.sectors;
        const cols = ['rgba(255,69,58,0.55)', 'rgba(10,132,255,0.55)', 'rgba(255,214,10,0.55)'];
        const bounds = [0, f1, f2, 1];
        for (let s = 0; s < 3; s++) {
          const p = new Path2D();
          const i0 = Math.floor(bounds[s] * n);
          const i1 = Math.floor(bounds[s + 1] * n);
          for (let i = i0; i <= i1; i++) {
            const [sx, sy] = toScreen(ref.x[i % n], ref.y[i % n]);
            if (i === i0) p.moveTo(sx, sy);
            else p.lineTo(sx, sy);
          }
          ctx.strokeStyle = cols[s];
          ctx.lineWidth = 1.2;
          ctx.stroke(p);
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke(path);
      }

      // DRS zones
      if (st.showDrs) {
        for (const [f0, f1] of ref.drs) {
          const p = new Path2D();
          const i0 = Math.floor(f0 * n);
          let i1 = Math.floor(f1 * n);
          if (i1 < i0) i1 += n;
          for (let i = i0; i <= i1; i++) {
            const [sx, sy] = toScreen(ref.x[i % n], ref.y[i % n]);
            if (i === i0) p.moveTo(sx, sy);
            else p.lineTo(sx, sy);
          }
          ctx.strokeStyle = 'rgba(48,209,88,0.24)';
          ctx.lineWidth = trackW;
          ctx.lineCap = 'butt';
          ctx.stroke(p);
          // flowing chevrons show the direction of travel
          ctx.setLineDash([3, 9]);
          ctx.lineDashOffset = -(performance.now() / 40) % 12;
          ctx.strokeStyle = 'rgba(48,209,88,0.75)';
          ctx.lineWidth = 2;
          ctx.stroke(p);
          ctx.setLineDash([]);
          ctx.lineCap = 'round';
        }
      }

      // start / finish line
      {
        const [x0, y0] = toScreen(ref.x[0], ref.y[0]);
        const [x1, y1] = toScreen(ref.x[3], ref.y[3]);
        const ang = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
        ctx.save();
        ctx.translate(x0, y0);
        ctx.rotate(ang);
        const half = trackW / 2 + 2;
        const sq = Math.max(2, trackW / 6);
        for (let i = -half, k = 0; i < half; i += sq, k++) {
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (k + j) % 2 ? '#fff' : '#111';
            ctx.fillRect(i, -sq + j * sq, sq, sq);
          }
        }
        ctx.restore();
      }

      // corner numbers
      if (st.showCorners && ref.corners.length) {
        ctx.font = '600 10px -apple-system, "Inter Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const c of ref.corners) {
          const [sx, sy] = toScreen(c.x, c.y);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.arc(sx, sy, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(235,235,245,0.6)';
          ctx.fillText(c.num, sx, sy + 0.5);
        }
      }

      // ---- cars
      const selected = new Set(st.selected);
      const positions = screenPos.current;
      positions.clear();
      const drawList: { num: number; x: number; y: number; alpha: number; sel: boolean; color: string; code: string }[] = [];
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
        const [sx, sy] = toScreen(p.x, p.y);
        positions.set(drv.num, { x: sx, y: sy });
        drawList.push({ num: drv.num, x: sx, y: sy, alpha, sel: selected.has(drv.num), color: drv.color, code: drv.code });

        if (st.showTrails && p.live && alpha > 0.5) {
          const steps = 10;
          let prev: readonly [number, number] = [sx, sy];
          for (let k = 1; k <= steps; k++) {
            const q = carAt(tr, t - k * 0.18);
            if (!q || !q.live) break;
            const cur = toScreen(q.x, q.y);
            ctx.strokeStyle = hexToRgba(drv.color, 0.5 * (1 - k / steps) * alpha);
            ctx.lineWidth = 3.2 * (1 - k / (steps + 2));
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(cur[0], cur[1]);
            ctx.stroke();
            prev = cur;
          }
        }
      }
      // selected cars last so they sit on top
      drawList.sort((a1, b1) => Number(a1.sel) - Number(b1.sel));
      const r = Math.max(4.5, Math.min(8, trackW * 0.42));
      for (const c of drawList) {
        ctx.globalAlpha = c.alpha;
        if (c.sel) {
          ctx.fillStyle = hexToRgba(c.color, 0.25);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = c.color;
        ctx.strokeStyle = c.sel ? '#fff' : 'rgba(0,0,0,0.65)';
        ctx.lineWidth = c.sel ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.sel ? r * 1.25 : r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // labels
      if (st.showNames) {
        ctx.font = '650 11px -apple-system, "Inter Variable", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        // greedy de-cluttering: selected cars first, then the rest; skip overlapping labels
        const placed: [number, number, number, number][] = [];
        const order = [...drawList].sort((a1, b1) => Number(b1.sel) - Number(a1.sel));
        for (const c of order) {
          if (c.alpha < 0.3 && !c.sel) continue;
          const lw = ctx.measureText(c.code).width + 14;
          const rect: [number, number, number, number] = [c.x + r + 4, c.y - 9, lw, 18];
          const hit = placed.some((p) => rect[0] < p[0] + p[2] && rect[0] + rect[2] > p[0] && rect[1] < p[1] + p[3] && rect[1] + rect[3] > p[1]);
          if (hit && !c.sel) continue;
          placed.push(rect);
          ctx.globalAlpha = Math.min(1, c.alpha + 0.1);
          const tw = ctx.measureText(c.code).width;
          const bx = c.x + r + 4;
          const by = c.y - 9;
          const h = 18;
          ctx.fillStyle = c.sel ? 'rgba(255,255,255,0.95)' : 'rgba(18,18,22,0.82)';
          ctx.beginPath();
          ctx.roundRect(bx, by, tw + 14, h, 6);
          ctx.fill();
          ctx.fillStyle = c.color;
          ctx.fillRect(bx + 4, by + 4, 2.5, h - 8);
          ctx.fillStyle = c.sel ? '#000' : '#f5f5f7';
          ctx.fillText(c.code, bx + 9, by + h / 2 + 0.5);
        }
      }
      ctx.globalAlpha = 1;

      // ---- overtake shockwaves
      const nowMs = performance.now();
      ripples.current = ripples.current.filter((rp) => nowMs - rp.start < 1100);
      for (const rp of ripples.current) {
        const pos = positions.get(rp.num);
        if (!pos) continue;
        const k = (nowMs - rp.start) / 1100;
        const ease = 1 - (1 - k) ** 3;
        ctx.strokeStyle = hexToRgba(rp.color, 0.9 * (1 - k));
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + ease * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(48,209,88,${0.6 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + ease * 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // selected cars breathe
      for (const c of drawList) {
        if (!c.sel) continue;
        const k = (Math.sin(nowMs / 380) + 1) / 2;
        ctx.strokeStyle = hexToRgba(c.color, 0.5 * (1 - k));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * (1.8 + k * 1.6), 0, Math.PI * 2);
        ctx.stroke();
      }

      // ---- safety car
      const lead = leaderNum(data, t);
      if (lead != null) {
        const sc = safetyCarAt(data, t, distanceAt(data.tracks.get(lead)!, t));
        if (sc && sc.alpha > 0.01) {
          const [sx, sy] = toScreen(sc.x, sc.y);
          const pulse = sc.phase === 'on_track' ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 160);
          ctx.globalAlpha = sc.alpha;
          ctx.fillStyle = `rgba(255,159,10,${0.18 + 0.2 * pulse})`;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff9f0a';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = '800 10px -apple-system, "Inter Variable", sans-serif';
          ctx.fillStyle = '#000';
          ctx.textAlign = 'center';
          ctx.fillText('SC', sx, sy + 0.5);
          const label = sc.phase === 'deploying' ? 'SC IN PISTA' : sc.phase === 'returning' ? 'SC RIENTRA' : '';
          if (label) {
            ctx.font = '700 10px -apple-system, "Inter Variable", sans-serif';
            ctx.fillStyle = '#ff9f0a';
            ctx.fillText(label, sx, sy - r * 3.4);
          }
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
      const nz = Math.max(0.6, Math.min(12, v.zoom * factor));
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
      view.current.zoom = Math.max(0.6, Math.min(12, view.current.zoom * k));
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
