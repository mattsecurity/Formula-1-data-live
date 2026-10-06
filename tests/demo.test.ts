import { describe, expect, it } from 'vitest';
import { DemoSource, DEMO_QUALI_KEY, DEMO_RACE_KEY } from '../src/api/demo';
import { loadSession } from '../src/model/loadSession';
import { computeStandings } from '../src/model/standings';

describe('demo race end-to-end', async () => {
  const data = await loadSession(new DemoSource(), DEMO_RACE_KEY);

  it('builds a closed reference path', () => {
    expect(data.ref.x.length).toBeGreaterThan(500);
    expect(data.ref.length).toBeGreaterThan(1000);
    expect(data.drivers).toHaveLength(20);
    expect(data.totalLaps).toBe(18);
  });

  it('calibrates race distance to lap numbers', () => {
    for (const lap of data.laps.slice(0, 200)) {
      if (lap.start == null) continue;
      const tr = data.tracks.get(lap.driver)!;
      const i = tr.t.findIndex((t) => t >= lap.start!);
      expect(Math.abs(tr.d[i] - (lap.lap - 1))).toBeLessThan(0.05);
    }
  });

  it('live order matches official classification at the flag', () => {
    const rows = computeStandings(data, data.endT - 1);
    const official = data.results.map((r) => r.driver);
    expect(rows.map((r) => r.num)).toEqual(official);
    expect(rows.at(-1)!.status).toBe('out');
  });

  it('detects safety car and DRS zones', () => {
    expect(data.periods.some((p) => p.kind === 'SC')).toBe(true);
    expect(data.ref.drs.length).toBeGreaterThan(0);
    expect(data.ref.sectors).not.toBeNull();
  });

  it('mid-race order follows the official timing feed closely', () => {
    let agree = 0;
    let total = 0;
    for (let t = data.raceStart + 120; t < data.endT - 200; t += 37) {
      const rows = computeStandings(data, t);
      const off = computeStandings(data, t, [], 'official');
      rows.forEach((r, i) => {
        total++;
        if (off[i].num === r.num) agree++;
      });
    }
    expect(agree / total).toBeGreaterThan(0.85);
  });
});

describe('demo qualifying', async () => {
  const data = await loadSession(new DemoSource(), DEMO_QUALI_KEY);
  it('orders by best lap', () => {
    const rows = computeStandings(data, data.endT);
    expect(rows[0].best).not.toBeNull();
    for (let i = 1; i < rows.length; i++) expect(rows[i].best!).toBeGreaterThanOrEqual(rows[i - 1].best!);
    expect(rows.map((r) => r.num)).toEqual(data.results.map((r) => r.driver));
  });
});
