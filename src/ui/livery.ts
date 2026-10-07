/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
export function mixColor(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

/** Second livery colour of each team, used for stripes, helmet and details. */
const ACCENTS: [string, string][] = [
  ['ferrari', '#f5f5f7'],
  ['mclaren', '#1c1c20'],
  ['red bull', '#ffcc00'],
  ['mercedes', '#c8ccd2'],
  ['aston martin', '#cedc00'],
  ['alpine', '#ff87bc'],
  ['williams', '#f5f5f7'],
  ['racing bulls', '#f5f5f7'],
  ['rb', '#f5f5f7'],
  ['sauber', '#1c1c20'],
  ['audi', '#c8ccd2'],
  ['haas', '#e6002b'],
  ['cadillac', '#1c1c20'],
];

export function teamAccent(team: string | null | undefined, color: string): string {
  const k = (team ?? '').toLowerCase();
  for (const [name, c] of ACCENTS) if (k.includes(name)) return c;
  return mixColor(color, 0.6);
}
