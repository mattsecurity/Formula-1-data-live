import { describe, expect, it } from 'vitest';
import { orthophotoPoint, validOrthophoto } from '../src/replay/orthophoto3d';

describe('photographic ground georeferencing', () => {
  const mercator = (lon: number, lat: number) => [6378137 * lon * Math.PI / 180,
    6378137 * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
  it('places the geographic origin at zero and north at negative scene Z', () => {
    const origin = [4.54, 52.39];
    const [x, y] = mercator(...origin as [number, number]);
    const point = orthophotoPoint(x, y, origin);
    expect(point[0]).toBeCloseTo(0, 6);
    expect(point[1]).toBeCloseTo(0, 6);
    const north = mercator(origin[0], origin[1] + 0.001);
    expect(orthophotoPoint(north[0], north[1], origin)[1]).toBeCloseTo(-111.32, 5);
    const east = mercator(origin[0] + 0.001, origin[1]);
    expect(orthophotoPoint(east[0], east[1], origin)[0]).toBeCloseTo(111.32 * Math.cos(origin[1] * Math.PI / 180), 5);
  });
  it('rejects inverted and nonfinite image extents before loading', () => {
    const source = { url: 'orthophotos/test.jpg', bbox3857: [0, 0, 100, 100],
      attribution: 'Provider', licenseUrl: 'https://example.org/license', sourceUrl: 'https://example.org',
      capture: '2025', description: 'Aerial photograph' };
    expect(validOrthophoto(source)).toBe(true);
    expect(validOrthophoto({ ...source, bbox3857: [100, 0, 0, 100] })).toBe(false);
    expect(validOrthophoto({ ...source, bbox3857: [0, 0, Infinity, 100] })).toBe(false);
  });
});
