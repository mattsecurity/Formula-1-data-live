import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Circuit models built with Blender (see blender/circuit.py), keyed by circuit dataset id.
const CIRCUIT_MODELS: Record<string, string> = {
  'it-1922': 'models/circuits/monza.glb',
};
const CAR_MODEL = 'models/car.glb';

const cache = new Map<string, Promise<GLTF>>();
function load(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export const hasCircuitModel = (id?: string) => !!id && id in CIRCUIT_MODELS;
export const loadCircuitModel = (id: string) => load(CIRCUIT_MODELS[id]);
export const loadCarModel = () => load(CAR_MODEL);

// ---------------------------------------------------------------- alignment
/** 2D similarity (optionally mirrored) on the ground plane: X' = a·x + b·z + tx, Z' = c·x + d·z + tz. */
export interface GroundFit {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  tz: number;
  scale: number;
  mirrored: boolean;
  /** residual distance between the two centerlines, metres */
  rms: number;
}

type Pts = Float64Array; // interleaved x,z

function resampleLoop(p: Pts, m: number): Pts {
  const n = p.length / 2;
  const cum = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const j = i % n;
    cum[i] = cum[i - 1] + Math.hypot(p[2 * j] - p[2 * i - 2], p[2 * j + 1] - p[2 * i - 1]);
  }
  const out = new Float64Array(2 * m);
  let k = 0;
  for (let i = 0; i < m; i++) {
    const s = (i / m) * cum[n];
    while (k < n - 1 && cum[k + 1] < s) k++;
    const f = (s - cum[k]) / (cum[k + 1] - cum[k] || 1);
    const j = (k + 1) % n;
    out[2 * i] = p[2 * k] + (p[2 * j] - p[2 * k]) * f;
    out[2 * i + 1] = p[2 * k + 1] + (p[2 * j + 1] - p[2 * k + 1]) * f;
  }
  return out;
}

/** Closed-form least squares similarity mapping src → dst (paired points), treating x,z as complex numbers. */
function similarity(src: Pts, dst: Pts, mirrored: boolean, pairs?: Int32Array): GroundFit {
  const m = src.length / 2;
  const at = (i: number) => (pairs ? pairs[i] : i);
  let px = 0, pz = 0, qx = 0, qz = 0;
  for (let i = 0; i < m; i++) {
    px += src[2 * i];
    pz += mirrored ? -src[2 * i + 1] : src[2 * i + 1];
    qx += dst[2 * at(i)];
    qz += dst[2 * at(i) + 1];
  }
  px /= m;
  pz /= m;
  qx /= m;
  qz /= m;
  // z = Σ q · conj(p),  s·e^{iθ} = z / Σ|p|²
  let re = 0, im = 0, pp = 0;
  for (let i = 0; i < m; i++) {
    const x = src[2 * i] - px;
    const y = (mirrored ? -src[2 * i + 1] : src[2 * i + 1]) - pz;
    const u = dst[2 * at(i)] - qx;
    const v = dst[2 * at(i) + 1] - qz;
    re += u * x + v * y;
    im += v * x - u * y;
    pp += x * x + y * y;
  }
  const cr = re / (pp || 1);
  const ci = im / (pp || 1);
  // (cr + i·ci)(x + i·y'), y' = ±z
  const sgn = mirrored ? -1 : 1;
  const a = cr;
  const b = -ci * sgn;
  const c = ci;
  const d = cr * sgn;
  const tx = qx - (cr * px - ci * pz);
  const tz = qz - (ci * px + cr * pz);
  let err = 0;
  for (let i = 0; i < m; i++) {
    const X = a * src[2 * i] + b * src[2 * i + 1] + tx;
    const Z = c * src[2 * i] + d * src[2 * i + 1] + tz;
    err += (X - dst[2 * at(i)]) ** 2 + (Z - dst[2 * at(i) + 1]) ** 2;
  }
  return { a, b, c, d, tx, tz, scale: Math.hypot(cr, ci), mirrored, rms: Math.sqrt(err / m) };
}

/**
 * Finds the transform that lays the model's centerline (ground-plane x,z) onto the session's
 * reference lap. Both loops run in the racing direction; the start offset is searched.
 */
export function fitCenterline(model: Pts, ref: Pts): GroundFit {
  const M = 240;
  const a = resampleLoop(model, M);
  const b = resampleLoop(ref, M);
  let best: GroundFit | null = null;
  const rolled = new Float64Array(2 * M);
  for (const mir of [false, true])
    for (let k = 0; k < M; k++) {
      for (let i = 0; i < M; i++) {
        rolled[2 * i] = a[2 * ((i + k) % M)];
        rolled[2 * i + 1] = a[2 * ((i + k) % M) + 1];
      }
      const f = similarity(rolled, b, mir);
      if (!best || f.rms < best.rms) best = f;
    }
  // ICP refinement against the dense reference
  const dense = resampleLoop(model, 720);
  const refD = resampleLoop(ref, 1440);
  const pairs = new Int32Array(720);
  let fit = best!;
  for (let it = 0; it < 8; it++) {
    for (let i = 0; i < 720; i++) {
      const X = fit.a * dense[2 * i] + fit.b * dense[2 * i + 1] + fit.tx;
      const Z = fit.c * dense[2 * i] + fit.d * dense[2 * i + 1] + fit.tz;
      let bd = Infinity;
      for (let j = 0; j < 1440; j++) {
        const dd = (refD[2 * j] - X) ** 2 + (refD[2 * j + 1] - Z) ** 2;
        if (dd < bd) {
          bd = dd;
          pairs[i] = j;
        }
      }
    }
    fit = similarity(dense, refD, fit.mirrored, pairs);
  }
  return fit;
}

// ---------------------------------------------------------------- draping
/**
 * Bakes the alignment into the model and drapes it over the session elevation.
 * Meshes named D_* follow the ground per vertex, everything else is lifted whole.
 */
export function drapeCircuit(gltf: GLTF, fit: GroundFit, field: HeightField): THREE.Group {
  const height = field.at;
  const out = new THREE.Group();
  out.name = 'circuit-model';
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  const M = new THREE.Matrix4().set(fit.a, 0, fit.b, fit.tx, 0, fit.scale, 0, 0, fit.c, 0, fit.d, fit.tz, 0, 0, 0, 1);
  const world = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  src.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    world.multiplyMatrices(M, mesh.matrixWorld);
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const im = mesh as THREE.InstancedMesh;
      const copy = new THREE.InstancedMesh(im.geometry, im.material, im.count);
      const m = new THREE.Matrix4();
      const ms = new THREE.Matrix4();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m);
        ms.multiplyMatrices(mesh.matrixWorld, m);
        ms.decompose(v, q, s); // keep the instance's own (unmirrored) rotation and size
        v.applyMatrix4(M);
        v.y += height(v.x, v.z);
        s.multiplyScalar(fit.scale);
        copy.setMatrixAt(i, ms.compose(v, q, s));
      }
      copy.computeBoundingSphere();
      copy.castShadow = true;
      copy.name = im.name;
      out.add(copy);
      return;
    }
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(world);
    if (fit.mirrored && geo.index) {
      // a mirror flips the winding: swap two corners of every triangle
      const ix = geo.index.array;
      for (let i = 0; i < ix.length; i += 3) {
        const t = ix[i + 1];
        ix[i + 1] = ix[i + 2];
        ix[i + 2] = t;
      }
    }
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const flat = mesh.name.startsWith('D_') || mesh.parent?.name.startsWith('D_');
    if (flat) {
      // the coarse 25 m ground grid cuts chords across bumps: keep it under the verges near the track
      const name = mesh.name.startsWith('D_') ? mesh.name : mesh.parent!.name;
      const ground = name.startsWith('D_Ground');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const sink = ground ? 0.3 + 1.0 * (1 - smoothstep(30, 50, field.dist(x, z))) : 0;
        pos.setY(i, pos.getY(i) + height(x, z) - sink);
      }
      geo.computeVertexNormals();
    } else {
      geo.computeBoundingBox();
      geo.boundingBox!.getCenter(v);
      geo.translate(0, height(v.x, v.z), 0);
    }
    geo.computeBoundingSphere();
    const copy = new THREE.Mesh(geo, mesh.material);
    copy.name = mesh.name;
    copy.receiveShadow = true;
    copy.castShadow = !flat;
    out.add(copy);
  });
  // stack the coplanar ground layers without z-fighting
  const LAYER: Record<string, number> = { Grass: 0, Verge: 0, Gravel: 1, Road: 1, Shoulder: 2, PitLane: 2, Asphalt: 2, Kerb: 3 };
  out.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!mat || Array.isArray(mat)) return;
    const l = LAYER[mat.name];
    if (l) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -l;
      mat.polygonOffsetUnits = -l * 2;
    }
    if (mat.map) mat.map.anisotropy = 8;
  });
  return out;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface HeightField {
  /** ground elevation */
  at(x: number, z: number): number;
  /** distance from the reference lap */
  dist(x: number, z: number): number;
}

/** Elevation field over the ground plane, from the reference lap (draped meshes follow the cars). */
export function heightField(xs: Float64Array, zs: Float64Array, ys: Float64Array): HeightField {
  const n = xs.length;
  const CELL = 40;
  const grid = new Map<number, number[]>();
  const key = (gx: number, gz: number) => gx * 100003 + gz;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const k = key(Math.floor(xs[i] / CELL), Math.floor(zs[i] / CELL));
    let b = grid.get(k);
    if (!b) grid.set(k, (b = []));
    b.push(i);
    mean += ys[i];
  }
  mean /= n || 1;
  const coarse: number[] = [];
  for (let i = 0; i < n; i += 8) coarse.push(i);
  const nearest = (x: number, z: number): [number, number] => {
    const gx = Math.floor(x / CELL);
    const gz = Math.floor(z / CELL);
    let bi = -1;
    let bd = Infinity;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const b = grid.get(key(gx + dx, gz + dz));
        if (b)
          for (const i of b) {
            const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2;
            if (d < bd) {
              bd = d;
              bi = i;
            }
          }
      }
    if (bi < 0)
      for (const i of coarse) {
        const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
    return [bi, Math.sqrt(bd)];
  };
  const at = (x: number, z: number) => {
    const [bi, dist] = nearest(x, z);
    // interpolate along the closer neighbouring segment
    let h = ys[bi];
    for (const j of [(bi + 1) % n, (bi - 1 + n) % n]) {
      const ex = xs[j] - xs[bi];
      const ez = zs[j] - zs[bi];
      const L = ex * ex + ez * ez;
      if (!L) continue;
      const t = ((x - xs[bi]) * ex + (z - zs[bi]) * ez) / L;
      if (t > 0 && t < 1) {
        h = ys[bi] + (ys[j] - ys[bi]) * t;
        break;
      }
    }
    return h + (mean - h) * smoothstep(60, 500, dist);
  };
  return { at, dist: (x, z) => nearest(x, z)[1] };
}

// ---------------------------------------------------------------- car
export const WHEEL_RADIUS = 0.362;

/**
 * Copy of the Blender car with its "Paint" material in the team colour.
 * `userData.wheels` lists the wheel nodes (pivot at the hub, axle along local Z).
 */
export function carFromModel(gltf: GLTF, color: string): THREE.Object3D {
  const car = gltf.scene.clone(true);
  car.userData.wheels = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'].map((n) => car.getObjectByName(n)).filter(Boolean);
  const paint = new Map<THREE.Material, THREE.Material>();
  car.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const swap = (m: THREE.Material) => {
      if (m.name !== 'Paint') return m;
      let c = paint.get(m);
      if (!c) {
        c = m.clone();
        (c as THREE.MeshStandardMaterial).color.set(color);
        paint.set(m, c);
      }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  return car;
}
