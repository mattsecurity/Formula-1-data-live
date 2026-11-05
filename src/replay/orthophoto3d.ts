import * as THREE from 'three';

export interface OrthophotoSource {
  url: string;
  bbox3857: [number, number, number, number];
  attribution: string;
  licenseUrl: string;
  sourceUrl: string;
  capture: string;
  description: string;
  /** Preserve the indicative layout when the photograph predates construction. */
  showTrackOverlay?: boolean;
}

const EARTH_RADIUS = 6378137;
/** Preserve the source image's Mercator UVs while positioning in the OSM local frame. */
export function orthophotoPoint(x: number, y: number, origin: readonly number[]): [number, number] {
  const lon = x / EARTH_RADIUS * 180 / Math.PI;
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI;
  return [(lon - origin[0]) * 111320 * Math.cos(origin[1] * Math.PI / 180), -(lat - origin[1]) * 111320];
}

export function validOrthophoto(value: unknown): value is OrthophotoSource {
  if (!value || typeof value !== 'object') return false;
  const s = value as OrthophotoSource;
  return typeof s.url === 'string' && typeof s.attribution === 'string'
    && typeof s.description === 'string' && typeof s.capture === 'string'
    && typeof s.licenseUrl === 'string' && typeof s.sourceUrl === 'string'
    && Array.isArray(s.bbox3857) && s.bbox3857.length === 4 && s.bbox3857.every(Number.isFinite)
    && s.bbox3857[0] < s.bbox3857[2] && s.bbox3857[1] < s.bbox3857[3];
}

export async function createOrthophoto(options: {
  id: string; origin: readonly number[]; placement: THREE.Matrix4;
  renderer: THREE.WebGLRenderer; signal: AbortSignal;
}) {
  const { id, origin, placement, renderer, signal } = options;
  const response = await fetch(`${import.meta.env.BASE_URL}orthophotos/manifest.json`, { signal });
  if (!response.ok) return null;
  const manifest = await response.json();
  const source: unknown = manifest.version === 1 ? manifest.circuits?.[id] : undefined;
  if (!validOrthophoto(source)) return null;
  const url = new URL(source.url, new URL(import.meta.env.BASE_URL, document.baseURI));
  if (url.origin !== location.origin) throw new Error('Orthophoto must be a bundled asset');
  const imageResponse = await fetch(url, { signal });
  if (!imageResponse.ok) throw new Error('Photograph unavailable');
  const bitmap = await createImageBitmap(await imageResponse.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  if (signal.aborted) { bitmap.close(); throw new DOMException('Aborted', 'AbortError'); }
  const texture = new THREE.Texture(bitmap);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const [west, south, east, north] = source.bbox3857;
  const segments = 16;
  for (let row = 0; row <= segments; row++) for (let col = 0; col <= segments; col++) {
    const u = col / segments, v = row / segments;
    const [x, z] = orthophotoPoint(west + (east - west) * u, south + (north - south) * v, origin);
    positions.push(x, 0.15, z);
    uv.push(u, v);
    if (row < segments && col < segments) {
      const a = row * (segments + 1) + col, b = a + 1, c = a + segments + 1;
      indices.push(a, b, c, b, c + 1, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.name = 'Official aerial photograph';
  group.add(new THREE.Mesh(geometry, material));
  group.applyMatrix4(placement);
  return { group, attribution: source.attribution, description: source.description, source,
    dispose() { geometry.dispose(); material.dispose(); texture.dispose(); bitmap.close(); },
  };
}
