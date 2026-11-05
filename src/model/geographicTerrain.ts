import { fitEnvironment } from './environmentAlignment';
import { createTerrainQuery } from './terrainHeight';
import type { ReferencePath } from './types';

export interface GeographicTerrainData {
  origin: number[];
  outline: number[][];
  /** [west, south, east, north] in longitude/latitude degrees. */
  bbox: number[];
  width: number;
  height: number;
  /** Absolute source DEM metres, west-to-east rows ordered north-to-south. */
  heights: (number | null)[];
  source?: string;
  license?: string;
}

/** Build a bilinear geographic sampler; invalid/absent/outside data returns null. */
export function createElevationGridSampler(data: GeographicTerrainData): ((lon: number, lat: number) => number | null) | null {
  const { width, height, bbox, heights } = data;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2
    || !Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)
    || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]
    || !Array.isArray(heights) || heights.length !== width * height
    || heights.some((h) => h !== null && !Number.isFinite(h))
    || !heights.some((h) => h !== null)) return null;
  const [west, south, east, north] = bbox;
  return (lon, lat) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < west || lon > east || lat < south || lat > north) return null;
    const col = (lon - west) / (east - west) * (width - 1);
    const row = (north - lat) / (north - south) * (height - 1);
    const x = Math.min(width - 2, Math.floor(col)), y = Math.min(height - 2, Math.floor(row));
    const tx = col - x, ty = row - y;
    const indices = [y * width + x, y * width + x + 1, (y + 1) * width + x, (y + 1) * width + x + 1];
    const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
    let total = 0, weight = 0;
    for (let i = 0; i < 4; i++) {
      const h = heights[indices[i]];
      if (h !== null && weights[i] > 0) { total += h * weights[i]; weight += weights[i]; }
    }
    return weight ? total / weight : null;
  };
}

/**
 * Align geographic DEM relief with a telemetry lap. DEMs may include buildings,
 * vegetation and bathymetry; this is not a bare-earth survey of today's circuit.
 * A median vertical offset reconciles different telemetry/source height datums.
 * The measured road height is retained within 20 m and blended to DEM by 60 m.
 */
export function createGeographicTerrain(data: GeographicTerrainData, ref: ReferencePath, cx: number, cy: number, zmin: number): {
  heightAt: (x: number, z: number) => number;
  alignmentRms: number;
  verticalOffset: number;
} | null {
  const grid = createElevationGridSampler(data);
  if (!grid || !Array.isArray(data.origin) || data.origin.length !== 2 || !data.origin.every(Number.isFinite)
    || !Array.isArray(data.outline) || !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(zmin)) return null;
  const fit = fitEnvironment(data.outline, ref);
  if (!fit.accepted) return null;
  const origin = fit.project(0, 0), east = fit.project(1, 0), north = fit.project(0, 1);
  const a = east[0] - origin[0], b = north[0] - origin[0];
  const c = east[1] - origin[1], d = north[1] - origin[1];
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
  const longitudeScale = 111320 * Math.cos(data.origin[1] * Math.PI / 180);
  if (Math.abs(longitudeScale) < 1) return null;
  const sampleWorld = (x: number, y: number) => {
    const dx = x - origin[0], dy = y - origin[1];
    const localX = (d * dx - b * dy) / determinant;
    const localY = (-c * dx + a * dy) / determinant;
    return grid(data.origin[0] + localX / longitudeScale, data.origin[1] + localY / 111320);
  };
  const offsets: number[] = [];
  for (let i = 0; i < ref.x.length; i++) {
    if (ref.z && !Number.isFinite(ref.z[i])) continue;
    const dem = sampleWorld(ref.x[i], ref.y[i]);
    if (dem !== null) offsets.push((ref.z ? (ref.z[i] - zmin) / ref.unitsPerMeter : 0) - dem);
  }
  if (!offsets.length) return null;
  offsets.sort((x, y) => x - y);
  const mid = Math.floor(offsets.length / 2);
  const verticalOffset = offsets.length % 2 ? offsets[mid] : (offsets[mid - 1] + offsets[mid]) / 2;
  const roadAt = createTerrainQuery(ref, cx, cy, zmin);
  return {
    alignmentRms: fit.rms,
    verticalOffset,
    heightAt: (x, z) => {
      const road = roadAt(x, z);
      if (road.distance <= 20) return road.height;
      const dem = sampleWorld(cx + x * ref.unitsPerMeter, cy - z * ref.unitsPerMeter);
      if (dem === null) return road.height;
      const t = Math.max(0, Math.min(1, (road.distance - 20) / 40));
      const blend = t * t * (3 - 2 * t);
      return road.height + (dem + verticalOffset - road.height) * blend;
    },
  };
}
