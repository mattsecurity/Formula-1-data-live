import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { leaderNum, safetyCarAt } from '../model/derive';
import { flagStateAt, marshalRange } from '../model/flags';
import { carAt, distanceAt } from '../model/interp';
import type { SessionData } from '../model/types';
import { usePlayback } from './store';
import { buildTrackGeo } from './trackArt';
import { liveOrder } from './useStandings';
import { createGeographicTerrain, type GeographicTerrainData } from '../model/geographicTerrain';
import { loadPhotogrammetrySource } from '../data/scenerySources';
import { photogrammetryPlacement } from './photogrammetryPlacement';
import type { createPhotogrammetry } from './photogrammetry3d';
import { makeCar } from './carModel3d';
import { buildEnvironment, makeLandscape, surfaceMaterial, terrainSampler, type EnvironmentData } from './environment3d';
import './track3d.css';

export type CamMode = 'orbit' | 'chase' | 'top';

const EXAG = 1; // preserve measured vertical scale
const HALF_W = 7; // half track width, metres

function checkerTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 2; j++) {
      x.fillStyle = (i + j) % 2 ? '#f5f5f7' : '#0a0a0c';
      x.fillRect(i * 8, j * 8, 8, 8);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function label(text: string, cls: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return new CSS2DObject(el);
}

/** Small waving flag (same slice animation as the dock flag) for 3D markers. */
function flagMarker(sector: number): { obj: CSS2DObject; set: (double: boolean) => void } {
  const el = document.createElement('div');
  el.className = 't3d-flag';
  const one = (x: number) => {
    const W = 22;
    const H = 15;
    const N = 8;
    const sw = W / N;
    let slices = '';
    for (let i = 0; i < N; i++)
      slices += `<g class="wf-slice" style="--i:${i};--amp:${((i / N) * 1.8).toFixed(2)}px;clip-path:inset(0 ${(W - (i + 1) * sw - 0.15).toFixed(2)}px 0 ${(i * sw - 0.15).toFixed(2)}px)"><rect width="${W}" height="${H}" fill="#ffd60a"/></g>`;
    return `<g transform="translate(${x} 0)"><rect x="0" y="1" width="1.6" height="${H + 9}" rx="0.8" fill="#d1d1d6"/><g transform="translate(1.6 2)">${slices}</g></g>`;
  };
  const html = (double: boolean) =>
    `<svg class="wf" width="${double ? 50 : 26}" height="26" viewBox="0 0 ${double ? 50 : 26} 26">${one(0)}${double ? one(25) : ''}</svg><span>S${sector}</span>`;
  let cur: boolean | null = null;
  return {
    obj: new CSS2DObject(el),
    set: (double) => {
      if (cur === double) return;
      cur = double;
      el.innerHTML = html(double);
    },
  };
}

export default function Track3D({
  data,
  mode,
  onMode,
  insets,
}: {
  data: SessionData;
  mode: CamMode;
  onMode: (m: CamMode) => void;
  insets?: { left: number; right: number; top: number; bottom: number };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [webgl, setWebgl] = useState(true);
  const [photoCredits, setPhotoCredits] = useState<string[]>([]);
  const [surroundings, setSurroundings] = useState(true);
  const surroundingsRef = useRef(surroundings);
  surroundingsRef.current = surroundings;
  const [environmentStatus, setEnvironmentStatus] = useState('Caricamento ambiente…');

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let photogrammetry: ReturnType<typeof createPhotogrammetry> | null = null;
    setPhotoCredits([]);
    let environmentGroup: THREE.Group | null = null;
    let lastSurroundings: boolean | null = null;
    const abort = new AbortController();
    setWebgl(true);
    setEnvironmentStatus('Caricamento ambiente…');
    const ownedTextures: THREE.Texture[] = [];
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebgl(false);
      return;
    }
    const ref = data.ref;
    const n = ref.x.length;
    const upm = ref.unitsPerMeter || 10;
    const geo = buildTrackGeo(ref);
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < n; i++) {
      cx += ref.x[i];
      cy += ref.y[i];
    }
    cx /= n;
    cy /= n;
    let zmin = Infinity;
    if (ref.z) for (let i = 0; i < n; i++) zmin = Math.min(zmin, ref.z[i]);
    if (!Number.isFinite(zmin)) zmin = 0;
    const elevAt = (frac: number) => {
      if (!ref.z) return 0;
      let f = frac % 1;
      if (f < 0) f += 1;
      const k = f * n;
      const i = Math.floor(k) % n;
      const j = (i + 1) % n;
      const u = k - Math.floor(k);
      return (((ref.z[i] + (ref.z[j] - ref.z[i]) * u) - zmin) / upm) * EXAG;
    };
    const toV = (x: number, y: number, h = 0) => new THREE.Vector3((x - cx) / upm, h, -(y - cy) / upm);
    const vertY = (i: number) => (ref.z ? ((ref.z[i] - zmin) / upm) * EXAG : 0);
    let extent = 0;
    for (let i = 0; i < n; i++) extent = Math.max(extent, Math.hypot((ref.x[i] - cx) / upm, (ref.y[i] - cy) / upm));

    // ---------- scene
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = 't3d-labels';
    host.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    const skyColor = 0xb7ccd9;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, extent * 3, extent * 9);
    scene.add(new THREE.HemisphereLight(0xcfe7ff, 0x6c7655, 1.5));
    const sun = new THREE.DirectionalLight(0xffecd1, 2.6);
    sun.position.set(extent * 0.4, extent, extent * 0.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = extent * 5;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -extent * 1.4;
    sun.shadow.camera.right = sun.shadow.camera.top = extent * 1.4;
    sun.shadow.normalBias = 0.4;
    sun.shadow.bias = -0.0001;
    scene.add(sun, sun.target);
    const sunOffset = sun.position.clone();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, extent * 20);
    // start from the same orientation as the 2D map
    const phi = (-ref.rotation * Math.PI) / 180;
    // home position: same orientation as the 2D map, distance fitted later (see fitHome)
    const homeDir = new THREE.Vector3();
    const setHomeDir = (portrait: boolean) => {
      // on portrait screens look along the circuit's long axis so it fills the height
      const a = phi + (portrait ? Math.PI / 2 : 0);
      homeDir.set(Math.sin(a) * 1.5, portrait ? 2.2 : 1.4, Math.cos(a) * 1.5).normalize();
    };
    setHomeDir(false);
    let homeDist = extent * 2;
    const home = () => camera.position.copy(homeDir).multiplyScalar(homeDist);
    home();
    const controls = new OrbitControls(camera, labels.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 15;
    controls.maxDistance = extent * 4;
    controls.target.set(0, 0, 0);

    let heightAt = terrainSampler(ref, cx, cy, zmin);
    let landscape = makeLandscape(extent, data.circuitId, heightAt, renderer);
    scene.add(landscape.mesh);
    ownedTextures.push(...landscape.textures);
    if (data.circuitId) {
      Promise.all([
        fetch(`${import.meta.env.BASE_URL}environments/${data.circuitId}.json`, { signal: abort.signal })
          .then(response => { if (!response.ok) throw new Error('missing'); return response.json() as Promise<EnvironmentData>; }),
        fetch(`${import.meta.env.BASE_URL}terrain/${data.circuitId}.json`, { signal: abort.signal })
          .then(response => response.ok ? response.json() as Promise<GeographicTerrainData> : null).catch(() => null),
      ])
        .then(([environment, terrain]) => {
          if (disposed) return;
          if (environment.version !== 1 || environment.circuitId !== data.circuitId) throw new Error('invalid');
          // Urban DEM surface models include rooftop heights; do not grow buildings on top of those roofs.
          if (terrain && ref.z && !['sg-2008','mc-1929','az-2016','us-2023'].includes(data.circuitId || '')) {
            const geographic = createGeographicTerrain(terrain, ref, cx, cy, zmin);
            if (geographic) {
              heightAt = geographic.heightAt;
              scene.remove(landscape.mesh);landscape.mesh.geometry.dispose();landscape.mesh.material.dispose();
              landscape = makeLandscape(extent, data.circuitId, heightAt, renderer);
              ownedTextures.push(...landscape.textures);scene.add(landscape.mesh);lastSurroundings=null;
            }
          }
          const built = buildEnvironment(environment, ref, cx, cy, heightAt);
          if (built.group) {
            environmentGroup = built.group;
            lastSurroundings = null;
            scene.add(built.group);
            setEnvironmentStatus(`Ambiente OSM · ${built.buildings} edifici · ${built.estimated} altezze stimate`);
            loadPhotogrammetrySource(data.circuitId!, abort.signal).then(async source => {
              if(disposed || !source)return;
              const placement=photogrammetryPlacement(environment.outline,ref,cx,cy);
              if(!placement)return;
              const module=await import('./photogrammetry3d');
              if(disposed)return;
              photogrammetry=module.createPhotogrammetry({url:source.url,origin:environment.origin,altitude:source.originAltitude,camera,renderer,
                onStatus:message=>{if(!disposed)setEnvironmentStatus(message);},
                onAttribution:credits=>{if(!disposed)setPhotoCredits([source.attribution,...credits]);},
              });
              photogrammetry.group.applyMatrix4(placement);scene.add(photogrammetry.group);lastSurroundings=null;
            }).catch(()=>{if(!disposed)setEnvironmentStatus('Rilievo fotografico non disponibile · schema geografico');});

          } else setEnvironmentStatus('Ambiente non allineato a questa versione del tracciato');
        })
        .catch(() => { if (!disposed) setEnvironmentStatus('Dati ambiente non disponibili · solo terreno indicativo'); });
    } else setEnvironmentStatus('Circuito senza dati geografici · terreno indicativo');

    // ---------- track ribbon (+ skirts)
    const ribbon = (off0: number, off1: number, from: number, to: number, lift = 0) => {
      const pos: number[] = [];
      const idx: number[] = [];
      const uv: number[] = [];
      let distance = 0;
      let k = 0;
      for (let i = from; i <= to; i++) {
        const j = ((i % n) + n) % n;
        const y = vertY(j) + lift;
        if (i > from) { const prev = ((i-1)%n+n)%n; distance += Math.hypot(ref.x[j]-ref.x[prev],ref.y[j]-ref.y[prev])/upm; }
        for (const off of [off0, off1]) {
          const x = ref.x[j] + geo.nx[j] * off * upm;
          const yy = ref.y[j] + geo.ny[j] * off * upm;
          pos.push((x - cx) / upm, y, -(yy - cy) / upm);
          uv.push(off, distance);
        }
        if (i > from) idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        k += 2;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    };
    const asphaltSurface = surfaceMaterial('asphalt_02', 3, renderer, 0xa6a6a6);
    ownedTextures.push(...asphaltSurface.textures);
    const asphalt = new THREE.Mesh(ribbon(HALF_W, -HALF_W, 0, n), asphaltSurface.material);
    asphalt.receiveShadow = true;
    scene.add(asphalt);
    // A narrow verge follows measured track elevation, hiding terrain-grid interpolation seams.
    const vergeAsset = ['bh-2002','sa-2021','qa-2004','ae-2009'].includes(data.circuitId || '') ? 'aerial_beach_01' : ['sg-2008','mc-1929','az-2016','us-2023'].includes(data.circuitId || '') ? 'asphalt_02' : 'aerial_grass_rock';
    const verge = surfaceMaterial(vergeAsset, vergeAsset === 'asphalt_02' ? 3 : 12, renderer, vergeAsset === 'aerial_grass_rock' ? 0x548b61 : 0xffffff);
    ownedTextures.push(...verge.textures);
    for (const side of [1,-1]) {
      const mesh = new THREE.Mesh(ribbon(side * HALF_W, side * (HALF_W+4), 0, n, -0.08), verge.material);
      mesh.receiveShadow = true; scene.add(mesh);
    }
    // white edge lines
    for (const side of [HALF_W - 0.3, -HALF_W + 0.3]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const j = i % n;
        pts.push(toV(ref.x[j] + geo.nx[j] * side * upm, ref.y[j] + geo.ny[j] * side * upm, vertY(j) + 0.04));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })));
    }
    // kerbs: red/white blocks on the inside of tight corners
    {
      const pos: number[] = [];
      const col: number[] = [];
      const red = new THREE.Color(0xe10600);
      const white = new THREE.Color(0xf2f2f2);
      for (const kb of geo.kerbs) {
        const o0 = HALF_W * kb.side;
        const o1 = (HALF_W - 1.3) * kb.side;
        for (let i = kb.from; i < kb.to; i++) {
          const a = ((i % n) + n) % n;
          const b = (a + 1) % n;
          const c = (i - kb.from) % 2 ? red : white;
          const v = (j: number, off: number) => [(ref.x[j] + geo.nx[j] * off * upm - cx) / upm, vertY(j) + 0.06, -(ref.y[j] + geo.ny[j] * off * upm - cy) / upm];
          const q = [v(a, o0), v(a, o1), v(b, o0), v(a, o1), v(b, o1), v(b, o0)];
          for (const p of q) {
            pos.push(...p);
            col.push(c.r, c.g, c.b);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })));
    }
    // DRS zones
    for (const [f0, f1] of ref.drs) {
      let i1 = Math.floor(f1 * n);
      const i0 = Math.floor(f0 * n);
      if (i1 < i0) i1 += n;
      scene.add(new THREE.Mesh(ribbon(HALF_W, -HALF_W, i0, i1, 0.03), new THREE.MeshBasicMaterial({ color: 0x30d158, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })));
    }
    // start / finish
    {
      const p = toV(ref.x[0], ref.y[0], vertY(0) + 0.05);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 2), new THREE.MeshBasicMaterial({ map: checkerTexture(), side: THREE.DoubleSide }));
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = Math.atan2(geo.ny[0], geo.nx[0]);
      line.position.copy(p);
      scene.add(line);
    }
    // pit lane
    if (ref.pitLane) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < ref.pitLane.x.length; i++) {
        const v = toV(ref.pitLane.x[i], ref.pitLane.y[i]);
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < n; k += 3) {
          const d = (ref.x[k] - ref.pitLane.x[i]) ** 2 + (ref.y[k] - ref.pitLane.y[i]) ** 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        v.y = vertY(best) + 0.05;
        pts.push(v);
      }
      const vertices: number[] = [];
      const uv: number[] = [];
      const indices: number[] = [];
      let length = 0;
      for (let i=0; i<pts.length; i++) {
        const direction = pts[Math.min(pts.length-1,i+1)].clone().sub(pts[Math.max(0,i-1)]).normalize();
        const normal = new THREE.Vector3(-direction.z,0,direction.x).multiplyScalar(2.8);
        if (i) length += pts[i].distanceTo(pts[i-1]);
        for (const side of [-1,1]) { const p=pts[i].clone().addScaledVector(normal,side); vertices.push(p.x,p.y,p.z); uv.push(side*2.8,length); }
        if (i) {const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}
      }
      const pavement = new THREE.BufferGeometry();
      pavement.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      pavement.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      pavement.setIndex(indices);pavement.computeVertexNormals();
      const pit = new THREE.Mesh(pavement,asphaltSurface.material);
      pit.receiveShadow=true;scene.add(pit);
    }
    // corners
    for (const c of geo.corners) {
      const l = label(c.name ? `${c.num} · ${c.name}` : c.num, 't3d-corner');
      const j = c.idx;
      const off = (HALF_W + 14) * c.out;
      l.position.copy(toV(ref.x[j] + geo.nx[j] * off * upm, ref.y[j] + geo.ny[j] * off * upm, vertY(j) + 3));
      scene.add(l);
    }

    // marshal-sector flag overlays (hidden until a flag is out)
    const sectorMeshes = new Map<number, THREE.Mesh>();
    const sectorFlagMarkers = new Map<number, ReturnType<typeof flagMarker>>();
    for (const m of ref.marshal) {
      const r = marshalRange(data, m.num);
      if (!r) continue;
      const mesh = new THREE.Mesh(
        ribbon(HALF_W + 4, -HALF_W - 4, Math.floor(r[0] * n), Math.ceil(r[1] * n), 0.08),
        new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
      );
      mesh.visible = false;
      scene.add(mesh);
      sectorMeshes.set(m.num, mesh);
      // waving flag at the middle of the sector, outside the track
      const mid = Math.floor((((r[0] + r[1]) / 2) % 1) * n);
      const fm = flagMarker(m.num);
      const off = (HALF_W + 10) * upm;
      fm.obj.position.copy(toV(ref.x[mid] + geo.nx[mid] * off, ref.y[mid] + geo.ny[mid] * off, vertY(mid) + 2));
      fm.obj.visible = false;
      scene.add(fm.obj);
      sectorFlagMarkers.set(m.num, fm);
    }
    const redMesh = new THREE.Mesh(ribbon(HALF_W + 9, -HALF_W - 9, 0, n, 0.09), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    redMesh.visible = false;
    scene.add(redMesh);

    // ---------- cars
    const cars = new Map<number, { g: THREE.Group; tag: CSS2DObject }>();
    for (const d of data.drivers) {
      const g = makeCar(d.color);
      g.userData.num = d.num;
      const tag = label(d.code, 't3d-tag');
      (tag.element as HTMLElement).style.setProperty('--team', d.color);
      tag.position.set(0, 2.6, 0);
      g.add(tag);
      scene.add(g);
      cars.set(d.num, { g, tag });
    }
    const sc = makeCar('#ff9f0a');
    // roof light bar
    const lampMat = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffb800 }));
    const lamps = lampMat.map((m, k) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.45), m);
      b.position.set(-0.3, 1.15, k ? 0.3 : -0.3);
      sc.add(b);
      return b;
    });
    const scGlow = new THREE.PointLight(0xffb800, 0, 30, 1.6);
    scGlow.position.set(-0.3, 1.6, 0);
    sc.add(scGlow);
    const scTag = label('SAFETY CAR', 't3d-tag t3d-sc');
    scTag.position.set(0, 2.6, 0);
    sc.add(scTag);
    sc.visible = false;
    scene.add(sc);

    // ---------- interaction: pick a car
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (downAt = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
      const r = labels.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects([...cars.values()].map((c) => c.g), true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && o.userData.num == null) o = o.parent;
        if (o) {
          usePlayback.getState().select(o.userData.num as number, e.shiftKey || e.metaKey);
          break;
        }
      }
    };
    labels.domElement.addEventListener('pointerdown', onDown);
    labels.domElement.addEventListener('pointerup', onUp);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    // keep the circuit centred in the area not covered by the side panels
    let lastOffset = NaN;
    const applyOffset = () => {
      const ins = insetsRef.current;
      const w = host.clientWidth;
      const h = host.clientHeight;
      const ox = ins ? (ins.right - ins.left) / 2 : 0;
      const oy = ins ? (ins.bottom - ins.top) / 2 : 0;
      const key = ox * 10000 + oy + w * 1e-3 + h * 1e-7;
      if (key === lastOffset) return false;
      lastOffset = key;
      camera.setViewOffset(w, h, ox, oy, w, h);
      return true;
    };
    resize();
    // closest distance at which the whole lap fits in the area left free by the panels
    const fitHome = () => {
      applyOffset();
      const ins = insetsRef.current ?? { left: 0, right: 0, top: 0, bottom: 0 };
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      setHomeDir(w < h);
      const m = 0.05;
      const x0 = -1 + (2 * ins.left) / w + m;
      const x1 = 1 - (2 * ins.right) / w - m;
      const y0 = -1 + (2 * ins.bottom) / h + m;
      const y1 = 1 - (2 * ins.top) / h - m;
      const p = new THREE.Vector3();
      for (let d = extent * 1.1; d < extent * 8; d *= 1.06) {
        camera.position.copy(homeDir).multiplyScalar(d);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        let ok = true;
        for (let i = 0; i < n && ok; i += 6) {
          p.copy(toV(ref.x[i], ref.y[i], vertY(i))).project(camera);
          ok = p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;
        }
        homeDist = d;
        if (ok) break;
      }
      controls.maxDistance = Math.max(extent * 4, homeDist * 1.5);
      scene.fog = new THREE.Fog(skyColor, homeDist * 2, homeDist * 5);
      home();
    };
    fitHome();
    let userMoved = false;
    controls.addEventListener('start', () => (userMoved = true));
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ---------- frame loop
    let raf = 0;
    let lastMode: CamMode | null = null;
    const chasePos = new THREE.Vector3();
    const chaseLook = new THREE.Vector3();
    let chaseAng: number | null = null;
    let chaseY: number | null = null;
    const headingOf = (num: number, t: number) => {
      const tr = data.tracks.get(num)!;
      const p = carAt(tr, t)!;
      const q = carAt(tr, t - 0.35);
      const dx = q ? p.x - q.x : 1;
      const dy = q ? p.y - q.y : 0;
      const moving = !!q && Math.hypot(dx, dy) > 0.5;
      const fraction = ((distanceAt(tr,t) % 1) + 1) % 1;
      const index = Math.floor(fraction*n)%n;
      const before = (index+n-1)%n, after = (index+1)%n;
      const tangent = Math.atan2(ref.y[after]-ref.y[before],ref.x[after]-ref.x[before]);
      return { p, ang: moving ? Math.atan2(dy, dx) : tangent, moving };
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const showSurroundings = surroundingsRef.current;
      if (showSurroundings !== lastSurroundings) {
        landscape.mesh.visible = showSurroundings && !photogrammetry;
        if (environmentGroup) for (const child of environmentGroup.children) child.visible = !photogrammetry && showSurroundings || !showSurroundings && !!child.userData.circuitDetail;
        lastSurroundings = showSurroundings;
      }
      const st = usePlayback.getState();
      const t = st.t;
      const now = performance.now();
      const m = modeRef.current;
      if (m !== lastMode) {
        const shadowExtent = m === 'chase' ? 90 : extent * 1.4;
        sun.shadow.camera.left = sun.shadow.camera.bottom = -shadowExtent;
        sun.shadow.camera.right = sun.shadow.camera.top = shadowExtent;
        sun.shadow.camera.updateProjectionMatrix();
        controls.enabled = m !== 'chase';
        if (m === 'top') {
          camera.position.set(Math.sin(phi) * 0.01, extent * 2.6, Math.cos(phi) * 0.01);
          controls.target.set(0, 0, 0);
          controls.maxPolarAngle = 0.0001;
        } else if (m === 'orbit') {
          controls.maxPolarAngle = Math.PI * 0.47;
          if (lastMode !== null) {
            userMoved = false;
            home();
            controls.target.set(0, 0, 0);
          }
        }
        lastMode = m;
      }

      // Keep cars at physical size; broadcast labels remain readable from orbit.
      const carScale = 1;
      const sel = new Set(st.selected);
      const lead = leaderNum(data, t);
      for (const d of data.drivers) {
        const c = cars.get(d.num)!;
        const tr = data.tracks.get(d.num);
        const ret = data.retiredAt.get(d.num);
        if (!tr || t < tr.t[0] - 5 || (ret != null && t > ret + 90)) {
          c.g.visible = false;
          continue;
        }
        const { p, ang } = headingOf(d.num, t);
        const frac = distanceAt(tr, t);
        c.g.visible = true;
        c.g.position.copy(toV(p.x, p.y, elevAt(frac) + 0.02));
        const slopeStep = 3 / Math.max(1, ref.lengthM);
        const pitch = Math.atan2(elevAt(frac + slopeStep) - elevAt(frac - slopeStep), 6);
        c.g.rotation.set(0, ang, Math.max(-0.35, Math.min(0.35, pitch)), 'YXZ');
        c.g.scale.setScalar(carScale);
        const pos = liveOrder.get(d.num);
        const el = c.tag.element as HTMLElement;
        const txt = st.showNames ? `${pos != null ? `${pos} ` : ''}${d.code}` : '';
        if (el.textContent !== txt) el.textContent = txt;
        el.classList.toggle('sel', sel.has(d.num));
        el.style.display = txt ? '' : 'none';
        c.tag.position.y = 2.2 + 0.2 / carScale;
      }

      // safety car
      const lt = lead != null ? data.tracks.get(lead) : undefined;
      const scState = lt ? safetyCarAt(data, t, distanceAt(lt, t)) : null;
      sc.visible = !!scState && scState.alpha > 0.05;
      if (scState && sc.visible) {
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < n; k += 2) {
          const d = (ref.x[k] - scState.x) ** 2 + (ref.y[k] - scState.y) ** 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        sc.position.copy(toV(scState.x, scState.y, vertY(best) + 0.02));
        sc.rotation.y = scState.angle;
        const ph = Math.floor(now / 250) % 2;
        const lit = scState.phase !== 'returning';
        lamps.forEach((l, k) => (lampMat[k].color.setHex(lit && k === ph ? 0xffd60a : 0x3a2a00), l.scale.setScalar(lit && k === ph ? 1.15 : 1)));
        scGlow.intensity = lit ? 6 : 0;
        sc.scale.setScalar(carScale);
      }

      // flags
      const fs = flagStateAt(data, t);
      const pulse = 0.5 + 0.5 * Math.sin(now / 260);
      for (const mesh of sectorMeshes.values()) mesh.visible = false;
      for (const fm of sectorFlagMarkers.values()) fm.obj.visible = false;
      for (const f of fs.sectors) {
        const mesh = sectorMeshes.get(f.sector);
        if (!mesh) continue;
        mesh.visible = true;
        const fm = sectorFlagMarkers.get(f.sector);
        if (fm) {
          fm.set(f.kind === 'DOUBLE YELLOW');
          fm.obj.visible = true;
        }
        (mesh.material as THREE.MeshBasicMaterial).opacity = (f.kind === 'DOUBLE YELLOW' ? 0.55 : 0.4) + 0.4 * pulse;
      }
      redMesh.visible = fs.flag === 'red';
      (redMesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.4 * pulse;

      // cameras
      if (m === 'chase') {
        const num = st.selected[0] ?? lead;
        const tr = num != null ? data.tracks.get(num) : undefined;
        if (tr) {
          const { p, ang } = headingOf(num!, t);
          const base = toV(p.x, p.y, elevAt(distanceAt(tr, t)));
          // smooth only the heading: the camera stays locked to the car at any playback speed
          if (chaseAng == null) chaseAng = ang;
          let da = ang - chaseAng;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          chaseAng += da * 0.1;
          const back = new THREE.Vector3(Math.cos(chaseAng), 0, -Math.sin(chaseAng));
          chaseY = chaseY == null ? base.y : chaseY + (base.y - chaseY) * 0.1;
          chasePos.copy(base).addScaledVector(back, -17);
          chasePos.y = chaseY + 5.5;
          chaseLook.copy(base).addScaledVector(back, 14);
          chaseLook.y = chaseY + 0.8;
          camera.position.copy(chasePos);
          camera.lookAt(chaseLook);
        }
      } else {
        chaseAng = null;
        chaseY = null;
        controls.update();
      }
      // panels opened/closed or window resized: re-frame until the user takes over the camera
      if (applyOffset() && m === 'orbit' && !userMoved) {
        fitHome();
        controls.target.set(0, 0, 0);
      }
      sun.target.position.set(m === 'chase' ? chaseLook.x : 0, m === 'chase' ? chaseLook.y : 0, m === 'chase' ? chaseLook.z : 0);
      sun.position.copy(sun.target.position).add(sunOffset);
      if(photogrammetry){photogrammetry.group.visible=showSurroundings;if(showSurroundings)photogrammetry.update();}
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      ro.disconnect();
      if(photogrammetry){scene.remove(photogrammetry.group);photogrammetry.dispose();}
      labels.domElement.removeEventListener('pointerdown', onDown);
      labels.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      const textureSet = new Set(ownedTextures);
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        const materials = Array.isArray(mat) ? mat : mat ? [mat] : [];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textureSet.add(value);
          material.dispose();
        }
      });
      textureSet.forEach(texture => texture.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      host.innerHTML = '';
    };
  }, [data]);

  return (
    <div className="t3d">
      <div ref={hostRef} className="t3d-host" />
      {!webgl && <p className="t3d-err">Il tuo browser non supporta WebGL: la vista 3D non è disponibile.</p>}
      <div className="t3d-environment glass" role="group" aria-label="Contesto del circuito">
        <button aria-pressed={surroundings} onClick={() => setSurroundings(true)}>Ambiente completo</button>
        <button aria-pressed={!surroundings} onClick={() => setSurroundings(false)}>Solo autodromo</button>
      </div>
      {photoCredits.length>0 && <div className="t3d-photo-credits">{photoCredits.join(' · ')}</div>}
      <details className="t3d-source glass">
        <summary>{photoCredits.length ? 'Fonti del rilievo 3D' : 'Schema geografico 3D'}</summary>
        <p>{environmentStatus}</p>
        <p>Sagome geografiche reali; facciate, vegetazione e rilievo circostante sono ricostruzioni indicative. Le strutture temporanee possono mancare.</p>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>
        <span> · </span><a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Quote · fonti Tilezen</a>
        <span> · </span><a href="https://polyhaven.com" target="_blank" rel="noreferrer">Texture Poly Haven · CC0</a>
      </details>
      <div className="t3d-cams glass" role="group" aria-label="Inquadratura 3D">
        {(
          [
            ['orbit', 'Orbita'],
            ['chase', 'Insegui'],
            ['top', 'Dall’alto'],
          ] as const
        ).map(([id, txt]) => (
          <button key={id} aria-pressed={mode === id} onClick={() => onMode(id)}>
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}
