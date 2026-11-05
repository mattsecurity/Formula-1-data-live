import type { ReferencePath } from './types';

interface Segment {
  index: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  length2: number;
  height: number;
  rise: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  left?: Bounds;
  right?: Bounds;
  segments?: Segment[];
}

function buildIndex(segments: Segment[]): Bounds {
  const node: Bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const s of segments) {
    node.minX = Math.min(node.minX, s.minX);
    node.maxX = Math.max(node.maxX, s.maxX);
    node.minZ = Math.min(node.minZ, s.minZ);
    node.maxZ = Math.max(node.maxZ, s.maxZ);
  }
  if (segments.length <= 8) {
    node.segments = segments;
  } else {
    const splitX = node.maxX - node.minX >= node.maxZ - node.minZ;
    segments.sort((a, b) => splitX
      ? (a.minX + a.maxX) - (b.minX + b.maxX)
      : (a.minZ + a.maxZ) - (b.minZ + b.maxZ));
    const mid = Math.floor(segments.length / 2);
    node.left = buildIndex(segments.slice(0, mid));
    node.right = buildIndex(segments.slice(mid));
  }
  return node;
}

function distanceToBounds(node: Bounds, x: number, z: number): number {
  const dx = Math.max(node.minX - x, 0, x - node.maxX);
  const dz = Math.max(node.minZ - z, 0, z - node.maxZ);
  return dx * dx + dz * dz;
}

/**
 * Extend measured road heights into surrounding terrain using the nearest
 * segment of the closed reference lap. Queries/results use scene metres;
 * cx, cy and zmin use the reference path's coordinate units.
 * A segment BVH avoids scanning the entire lap for every landscape vertex.
 * This is inferred relief, not surveyed terrain: horizontal crossings cannot
 * distinguish bridge levels, and equal-distance segments use reference order.
 */
export function createTerrainSampler(ref: ReferencePath, cx: number, cy: number, zmin: number): (x: number, z: number) => number {
  if (!ref.z) return () => 0;
  const query = createTerrainQuery(ref, cx, cy, zmin);
  return (x, z) => query(x, z).height;
}

/** Nearest measured road height and horizontal distance, both in scene metres. */
export function createTerrainQuery(ref: ReferencePath, cx: number, cy: number, zmin: number): (x: number, z: number) => { height: number; distance: number } {
  if (!ref.x.length || !Number.isFinite(cx) || !Number.isFinite(cy)) return () => ({ height: 0, distance: Infinity });
  const upm = Number.isFinite(ref.unitsPerMeter) && ref.unitsPerMeter > 0 ? ref.unitsPerMeter : 10;
  const baseline = Number.isFinite(zmin) ? zmin : 0;
  const points = Array.from(ref.x, (x, i) => ({
    x: (x - cx) / upm,
    z: -(ref.y[i] - cy) / upm,
    height: ref.z && Number.isFinite(ref.z[i]) ? (ref.z[i] - baseline) / upm : 0,
  }));
  const segments: Segment[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (![a.x, a.z, b.x, b.z].every(Number.isFinite)) continue;
    const dx = b.x - a.x, dz = b.z - a.z;
    segments.push({
      index: i, x: a.x, z: a.z, dx, dz, length2: dx * dx + dz * dz,
      height: a.height, rise: b.height - a.height,
      minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
      minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z),
    });
  }
  if (!segments.length) return () => ({ height: 0, distance: Infinity });
  const root = buildIndex(segments);
  return (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { height: 0, distance: Infinity };
    let distance = Infinity, height = 0, index = Infinity;
    const visit = (node: Bounds, bound: number): void => {
      if (bound > distance) return;
      if (node.segments) {
        for (const s of node.segments) {
          const t = s.length2 > 0 ? Math.max(0, Math.min(1, ((x - s.x) * s.dx + (z - s.z) * s.dz) / s.length2)) : 0;
          const dx = x - s.x - t * s.dx, dz = z - s.z - t * s.dz;
          const d = dx * dx + dz * dz;
          if (d < distance || (d === distance && s.index < index)) {
            distance = d;
            index = s.index;
            height = s.height + s.rise * t;
          }
        }
      } else {
        const left = node.left!, right = node.right!;
        const dl = distanceToBounds(left, x, z), dr = distanceToBounds(right, x, z);
        if (dl <= dr) { visit(left, dl); visit(right, dr); }
        else { visit(right, dr); visit(left, dl); }
      }
    };
    visit(root, distanceToBounds(root, x, z));
    return { height, distance: Math.sqrt(distance) };
  };
}
