import { describe, expect, it } from 'vitest';
import { DemoSource, DEMO_QUALI_KEY, DEMO_RACE_KEY } from '../src/api/demo';
import { buildSectorFlags, flagStateAt, marshalRange, sectorFlags } from '../src/model/flags';
import { loadSession } from '../src/model/loadSession';
import type { RaceControlMsg } from '../src/model/types';

const msg = (t: number, flag: string | null, scope: string | null, sector: number | null, message = ''): RaceControlMsg => ({
  t, flag, scope, sector, message, category: 'Flag', lap: null, driver: null,
});

describe('sector flags from race control', () => {
  it('opens and clears per sector', () => {
    const f = buildSectorFlags(
      [msg(10, 'YELLOW', 'Sector', 4), msg(20, 'DOUBLE YELLOW', 'Sector', 7), msg(30, 'CLEAR', 'Sector', 4), msg(60, 'GREEN', 'Track', null)],
      1000,
    );
    expect(f).toEqual([
      { sector: 4, kind: 'YELLOW', start: 10, end: 30 },
      { sector: 7, kind: 'DOUBLE YELLOW', start: 20, end: 60 },
    ]);
  });

  it('caps a yellow that is never cleared', () => {
    const f = buildSectorFlags([msg(0, 'YELLOW', 'Sector', 2)], 5000);
    expect(f[0].end).toBe(180);
  });
});

describe('demo flags', async () => {
  const race = await loadSession(new DemoSource(), DEMO_RACE_KEY);
  const quali = await loadSession(new DemoSource(), DEMO_QUALI_KEY);

  it('uses official-style marshal sectors', () => {
    expect(race.ref.marshal).toHaveLength(18);
    expect(race.ref.marshalEstimated).toBe(false);
    const r = marshalRange(race, 18)!;
    expect(r[1]).toBeGreaterThan(r[0]);
  });

  it('shows yellow and double yellow during the race', () => {
    const flags = sectorFlags(race);
    expect(flags.some((f) => f.kind === 'YELLOW' && f.sector === 14)).toBe(true);
    const dy = flags.find((f) => f.kind === 'DOUBLE YELLOW')!;
    expect(dy).toBeDefined();
    expect(flagStateAt(race, dy.start + 1).flag).toBe('double-yellow');
  });

  it('shows the red flag in qualifying', () => {
    const red = quali.periods.find((p) => p.kind === 'RED')!;
    expect(red).toBeDefined();
    expect(flagStateAt(quali, red.start + 5).flag).toBe('red');
    expect(flagStateAt(quali, red.end + 5).flag).toBe('green');
  });

  it('has an elevation profile', () => {
    expect(race.ref.z).not.toBeNull();
  });
});
