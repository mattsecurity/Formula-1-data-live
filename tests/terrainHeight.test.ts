import { describe, expect, it } from 'vitest';
import { buildReference } from '../src/model/geometry';
import { createTerrainQuery, createTerrainSampler } from '../src/model/terrainHeight';

function reference(points: number[][], heights: number[] | null = points.map(() => 0)) {
  const ref = buildReference([0, 100, 100, 0], [0, 0, 100, 100]);
  ref.x = Float32Array.from(points, (p) => p[0]);
  ref.y = Float32Array.from(points, (p) => p[1]);
  ref.z = heights && Float32Array.from(heights);
  ref.unitsPerMeter = 10;
  return ref;
}

describe('terrain elevation sampler', () => {
  it('reports horizontal road distance even when elevation is unavailable', () => {
    const query = createTerrainQuery(reference([[0, 0], [1000, 0], [1000, 1000], [0, 1000]], null), 0, 0, 0);
    expect(query(50, 25)).toEqual({ height: 0, distance: 25 });
    expect(query(50, 0)).toEqual({ height: 0, distance: 0 });
  });

  it('converts centred telemetry to scene metres and interpolates measured heights', () => {
    const ref = reference([[100, 200], [1100, 200], [1100, 1200], [100, 1200]], [50, 250, 350, 150]);
    const height = createTerrainSampler(ref, 100, 200, 50);
    expect(height(0, 0)).toBe(0);
    expect(height(100, 0)).toBe(20);
    expect(height(25, 0)).toBe(5);
    expect(height(100, -50)).toBe(25);
    expect(height(0, -100)).toBe(10);
  });

  it('projects off-track points to segments, including the closing segment', () => {
    const height = createTerrainSampler(reference([[0, 0], [1000, 0], [1000, 1000], [0, 1000]], [0, 200, 400, 100]), 0, 0, 0);
    expect(height(25, 30)).toBe(5);
    expect(height(-30, -50)).toBe(5);
    expect(height(140, -75)).toBe(35);
  });

  it('matches a full nearest-segment search across an indexed uneven circuit', () => {
    const points = Array.from({ length: 211 }, (_, i) => {
      const angle = i / 211 * Math.PI * 2;
      return [1000 * Math.cos(angle) + 200 * Math.cos(3 * angle), 800 * Math.sin(angle)];
    });
    const ref = reference(points, points.map((_, i) => 70 + 60 * Math.sin(i * 0.17)));
    const height = createTerrainSampler(ref, 0, 0, 20);
    for (let k = 0; k < 500; k++) {
      const x = 180 * Math.sin(k * 9.3), z = 150 * Math.cos(k * 7.1);
      let best = Infinity, expected = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const ax = ref.x[i] / 10, az = -ref.y[i] / 10;
        const dx = ref.x[j] / 10 - ax, dz = -ref.y[j] / 10 - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        const d = (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2;
        if (d < best) { best = d; expected = (ref.z![i] + (ref.z![j] - ref.z![i]) * t - 20) / 10; }
      }
      expect(height(x, z)).toBeCloseTo(expected, 10);
    }
  });

  it('handles missing, zero and invalid elevation and degenerate geometry safely', () => {
    expect(createTerrainSampler(reference([[0, 0]], null), 0, 0, 0)(5, 5)).toBe(0);
    expect(createTerrainSampler(reference([], []), 0, 0, 0)(5, 5)).toBe(0);
    expect(createTerrainSampler(reference([[0, 0], [100, 0]], [0, 0]), 0, 0, 0)(5, 5)).toBe(0);
    expect(createTerrainSampler(reference([[0, 0]], [60]), 0, 0, 10)(5, 5)).toBe(5);
    expect(createTerrainSampler(reference([[0, 0], [0, 0]], [60, 90]), 0, 0, 10)(5, 5)).toBe(5);
    const height = createTerrainSampler(reference([[0, 0], [100, 0]], [NaN, 100]), 0, 0, 0);
    expect(height(5, 0)).toBe(5);
    expect(height(NaN, 0)).toBe(0);
    expect(createTerrainSampler(reference([[NaN, 0]], [60]), 0, 0, 0)(0, 0)).toBe(0);
  });

  it('uses the earliest segment at a horizontal crossing with ambiguous levels', () => {
    // Repeated loops put equally near segments in separate BVH leaves.
    const crossing = [[-100, -100], [100, 100], [-100, 100], [100, -100]];
    const points = Array.from({ length: 32 }, (_, i) => crossing[i % 4]);
    const elevations = points.map((_, i) => [0, 0, 200, 200][i % 4] + Math.floor(i / 4) * 1000);
    const height = createTerrainSampler(reference(points, elevations), 0, 0, 0);
    expect(height(0, 0)).toBe(0);
  });
});
