import { useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/** Runs an abortable async loader whenever `deps` change. */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setState((s) => ({ data: s.data, error: undefined, loading: true }));
    fn(ctl.signal).then(
      (data) => !ctl.signal.aborted && setState({ data, error: undefined, loading: false }),
      (error: Error) => !ctl.signal.aborted && error.name !== 'AbortError' && setState({ data: undefined, error, loading: false }),
    );
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { ...state, retry: () => setNonce((n) => n + 1) };
}
