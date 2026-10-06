import { useEffect, useState } from 'react';
import { sourceForSession } from '../data/sources';
import { loadSession } from '../model/loadSession';
import type { SessionData } from '../model/types';

const memo = new Map<number, Promise<SessionData>>();
const progressListeners = new Map<number, Set<(l: string, f: number) => void>>();
const lastProgress = new Map<number, { label: string; f: number }>();

function load(key: number): Promise<SessionData> {
  let p = memo.get(key);
  if (!p) {
    p = loadSession(sourceForSession(key), key, {
      onProgress: (label, f) => {
        lastProgress.set(key, { label, f });
        progressListeners.get(key)?.forEach((cb) => cb(label, f));
      },
    });
    memo.set(key, p);
    p.catch(() => memo.delete(key));
    // keep memory bounded: only the 3 most recent sessions
    if (memo.size > 3) memo.delete(memo.keys().next().value!);
  }
  return p;
}

export interface SessionLoadState {
  data?: SessionData;
  error?: Error;
  label: string;
  progress: number;
  retry: () => void;
}

export function useSession(key: number): SessionLoadState {
  const [state, setState] = useState<Omit<SessionLoadState, 'retry'>>(() => ({
    label: lastProgress.get(key)?.label ?? 'Connessione a OpenF1',
    progress: lastProgress.get(key)?.f ?? 0,
  }));
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    const cb = (label: string, progress: number) => alive && setState((s) => ({ ...s, label, progress }));
    if (!progressListeners.has(key)) progressListeners.set(key, new Set());
    progressListeners.get(key)!.add(cb);
    setState({ label: lastProgress.get(key)?.label ?? 'Connessione a OpenF1', progress: lastProgress.get(key)?.f ?? 0 });
    load(key).then(
      (data) => alive && setState({ data, label: 'Pronto', progress: 1 }),
      (error: Error) => alive && setState({ error, label: 'Errore', progress: 0 }),
    );
    return () => {
      alive = false;
      progressListeners.get(key)?.delete(cb);
    };
  }, [key, nonce]);
  return { ...state, retry: () => setNonce((n) => n + 1) };
}
