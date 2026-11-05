import { describe, expect, it } from 'vitest';
import { buildReference } from '../src/model/geometry';
import { createElevationGridSampler, createGeographicTerrain, type GeographicTerrainData } from '../src/model/geographicTerrain';

const grid: GeographicTerrainData = {
  origin: [0, 0], outline: [], bbox: [-1, -1, 1, 1], width: 2, height: 2,
  heights: [100, 200, 300, 400],
};

describe('geographic DEM terrain', () => {
  it('samples north-to-south rows and bilinear heights including edges', () => {
    const sample = createElevationGridSampler(grid)!;
    expect(sample(-1, 1)).toBe(100);
    expect(sample(1, 1)).toBe(200);
    expect(sample(-1, -1)).toBe(300);
    expect(sample(1, -1)).toBe(400);
    expect(sample(0, 0)).toBe(250);
    expect(sample(-0.5, 0.5)).toBe(175);
    expect(sample(2, 0)).toBeNull();
    expect(sample(NaN, 0)).toBeNull();
  });

  it('preserves missing samples and rejects invalid grids', () => {
    const sample = createElevationGridSampler({ ...grid, heights: [null, 200, 300, 400] })!;
    expect(sample(-1, 1)).toBeNull();
    expect(sample(0, 0)).toBe(300);
    for (const change of [{ width: 1 }, { heights: [] }, { heights: [NaN, 0, 0, 0] }, { heights: [null, null, null, null] }, { bbox: [1, 0, 0, 1] }]) {
      expect(createElevationGridSampler({ ...grid, ...change })).toBeNull();
    }
  });

  it('inverts rotated telemetry alignment, calibrates the datum and preserves the road', () => {
    const outline = [[0, 0], [900, 0], [1000, 100], [950, 450], [700, 600], [620, 420], [350, 750], [-100, 500], [-50, 50]];
    const angle = 0.7, units = 10, cx = 3000, cy = -5000;
    const transform = ([x, y]: number[]) => [cx + units * (Math.cos(angle) * x - Math.sin(angle) * y), cy + units * (Math.sin(angle) * x + Math.cos(angle) * y)];
    const points = outline.map(transform);
    const ref = buildReference(points.map((p) => p[0]), points.map((p) => p[1]));
    ref.x = Float32Array.from(points, (p) => p[0]);
    ref.y = Float32Array.from(points, (p) => p[1]);
    ref.z = new Float32Array(points.length).fill(100);
    const data = { ...grid, outline, bbox: [-2000 / 111320, -2000 / 111320, 2000 / 111320, 2000 / 111320], heights: [100, 140, 100, 140] };
    const terrain = createGeographicTerrain(data, ref, cx, cy, 100)!;
    expect(terrain).not.toBeNull();
    const trackPoint = points[1];
    expect(terrain.heightAt((trackPoint[0] - cx) / units, -(trackPoint[1] - cy) / units)).toBeCloseTo(0, 6);
    const point = transform([1500, 0]);
    // Median source elevation at track vertices is 126.2 m; DEM at x=1500 is 135 m.
    expect(terrain.verticalOffset).toBeCloseTo(-126.2, 2);
    expect(terrain.heightAt((point[0] - cx) / units, -(point[1] - cy) / units)).toBeCloseTo(8.8, 2);
    expect(createGeographicTerrain({ ...data, outline: [] }, ref, cx, cy, 100)).toBeNull();
  });
});
