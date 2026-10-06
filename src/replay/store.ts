import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { OrderMode } from '../model/standings';

export const SPEEDS = [0.5, 1, 2, 4, 8, 16, 32, 64, 128];

export interface PlaybackState {
  t: number;
  startT: number;
  endT: number;
  playing: boolean;
  speed: number;
  selected: number[];
  follow: boolean;
  showNames: boolean;
  showDrs: boolean;
  showTrails: boolean;
  showCorners: boolean;
  orderMode: OrderMode;
  gapMode: 'leader' | 'interval';
  rotation: number;
  insightsOpen: boolean;
  set: (p: Partial<PlaybackState>) => void;
  seek: (t: number) => void;
  toggle: () => void;
  select: (num: number, additive: boolean) => void;
  reset: (startT: number, endT: number) => void;
}

const prefs = (() => {
  try {
    return JSON.parse(localStorage.getItem('pitwall:prefs') ?? '{}') as Partial<PlaybackState>;
  } catch {
    return {};
  }
})();

export const usePlayback = create<PlaybackState>((set, get) => ({
  t: 0,
  startT: 0,
  endT: 1,
  playing: false,
  speed: prefs.speed ?? 4,
  selected: [],
  follow: false,
  showNames: prefs.showNames ?? true,
  showDrs: prefs.showDrs ?? true,
  showTrails: prefs.showTrails ?? true,
  showCorners: prefs.showCorners ?? false,
  orderMode: prefs.orderMode ?? 'live',
  gapMode: prefs.gapMode ?? 'interval',
  rotation: 0,
  insightsOpen: false,
  set: (p) => set(p),
  seek: (t) => {
    const { startT, endT } = get();
    set({ t: Math.max(startT, Math.min(endT, t)) });
  },
  toggle: () => {
    const s = get();
    if (!s.playing && s.t >= s.endT - 0.5) set({ t: s.startT, playing: true });
    else set({ playing: !s.playing });
  },
  select: (num, additive) => {
    const sel = get().selected;
    if (additive) set({ selected: sel.includes(num) ? sel.filter((n) => n !== num) : [...sel, num].slice(-3) });
    else {
      const deselect = sel.length === 1 && sel[0] === num;
      set({ selected: deselect ? [] : [num], follow: deselect ? false : get().follow });
    }
  },
  reset: (startT, endT) => set({ t: startT, startT, endT, playing: false, selected: [], follow: false, rotation: 0, insightsOpen: false }),
}));

// persist the user's display preferences
usePlayback.subscribe((s, prev) => {
  if (
    s.speed !== prev.speed ||
    s.showNames !== prev.showNames ||
    s.showDrs !== prev.showDrs ||
    s.showTrails !== prev.showTrails ||
    s.showCorners !== prev.showCorners ||
    s.orderMode !== prev.orderMode ||
    s.gapMode !== prev.gapMode
  ) {
    try {
      const { speed, showNames, showDrs, showTrails, showCorners, orderMode, gapMode } = s;
      localStorage.setItem('pitwall:prefs', JSON.stringify({ speed, showNames, showDrs, showTrails, showCorners, orderMode, gapMode }));
    } catch {
      /* storage unavailable */
    }
  }
});

/** Replay time, re-rendering the caller at most every `ms` milliseconds. */
export function useThrottledTime(ms = 100): number {
  const [t, setT] = useState(() => usePlayback.getState().t);
  useEffect(() => {
    let last = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsub = usePlayback.subscribe((s, prev) => {
      if (s.t === prev.t) return;
      const now = performance.now();
      if (now - last >= ms) {
        last = now;
        setT(s.t);
      } else if (!pending) {
        pending = setTimeout(() => {
          pending = null;
          last = performance.now();
          setT(usePlayback.getState().t);
        }, ms - (now - last));
      }
    });
    return () => {
      unsub();
      if (pending) clearTimeout(pending);
    };
  }, [ms]);
  return t;
}

/** Drives replay time from requestAnimationFrame while playing. */
export function usePlaybackClock() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = usePlayback.getState();
      if (s.playing) {
        const next = s.t + dt * s.speed;
        if (next >= s.endT) usePlayback.setState({ t: s.endT, playing: false });
        else usePlayback.setState({ t: next });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
