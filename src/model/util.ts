/** Parse an OpenF1 ISO timestamp (up to microsecond precision) to epoch ms. */
export function parseDate(s: string | null | undefined): number {
  if (!s) return NaN;
  // Safari is strict about >3 fractional digits.
  const dot = s.indexOf('.');
  if (dot > 0) {
    let end = dot + 1;
    while (end < s.length && s.charCodeAt(end) >= 48 && s.charCodeAt(end) <= 57) end++;
    if (end - dot - 1 > 3) s = s.slice(0, dot + 4) + s.slice(end);
  }
  return Date.parse(s);
}

export function parseGmtOffset(s: string | null | undefined): number {
  if (!s) return 0;
  const m = /^(-)?(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] ? -mins : mins;
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function groupBy<T, K>(arr: T[], key: (v: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const v of arr) {
    const k = key(v);
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  }
  return m;
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
