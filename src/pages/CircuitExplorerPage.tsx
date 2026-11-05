import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CIRCUITS, circuitById, findCircuit } from '../data/circuits';
import { buildReference } from '../model/geometry';
import { buildTrackGeo } from '../replay/trackArt';
import { buildEnvironment, makeLandscape, surfaceMaterial, terrainSampler, type EnvironmentData } from '../replay/environment3d';
import { loadPhotogrammetrySource } from '../data/scenerySources';
import { photogrammetryPlacement } from '../replay/photogrammetryPlacement';
import type { createPhotogrammetry } from '../replay/photogrammetry3d';
import './circuit-explorer.css';

const MAPPED_CIRCUITS = CIRCUITS.filter(circuit => findCircuit(circuit.name, circuit.location)?.id === circuit.id)
  .sort((a, b) => a.location.localeCompare(b.location));
type CameraMode = 'orbit' | 'top';

export default function CircuitExplorerPage() {
  const { id = 'it-1922' } = useParams();
  const navigate = useNavigate();
  const circuit = circuitById(id);
  const supported = circuit && MAPPED_CIRCUITS.some(item => item.id === id) ? circuit : undefined;
  const hostRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(true);
  const [mode, setMode] = useState<CameraMode>('orbit');
  const [surroundings, setSurroundings] = useState(true);
  const [photoStatus, setPhotoStatus] = useState('Rilievo fotografico 3D non configurato');
  const [photoCredits, setPhotoCredits] = useState<string[]>([]);
  const [status, setStatus] = useState('Caricamento del contesto geografico…');
  const surroundingsRef = useRef(surroundings);
  surroundingsRef.current = surroundings;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const frameRef = useRef<((mode: CameraMode) => void) | null>(null);

  useEffect(() => {
    document.title = supported ? `${supported.location} · Esplora circuito · Pitwall` : 'Circuito non disponibile · Pitwall';
  }, [supported]);
  useEffect(() => { frameRef.current?.(mode); }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;
    const abort = new AbortController();
    let disposed = false;
    let raf = 0;
    let photogrammetry: ReturnType<typeof createPhotogrammetry> | null = null;
    let renderer: THREE.WebGLRenderer;
    setStatus('Caricamento del contesto geografico…');
    setPhotoStatus('Rilievo fotografico 3D non configurato');
    setPhotoCredits([]);
    setWebgl(true);
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    } catch {
      setWebgl(false);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', `Vista tridimensionale di ${supported.name}`);
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);

    // Geographic outlines already use local metres; buildReference defaults to telemetry units.
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < supported.pts.length; i += 2) { xs.push(supported.pts[i]); ys.push(supported.pts[i + 1]); }
    const ref = buildReference(xs, ys, { n: 1200 });
    ref.unitsPerMeter = 1;
    ref.lengthM = ref.length;
    const cx = ref.x.reduce((sum, value) => sum + value, 0) / ref.x.length;
    const cy = ref.y.reduce((sum, value) => sum + value, 0) / ref.y.length;
    const geo = buildTrackGeo(ref);
    let extent = 100;
    for (let i = 0; i < ref.x.length; i++) extent = Math.max(extent, Math.hypot(ref.x[i] - cx, ref.y[i] - cy));
    const heightAt = terrainSampler(ref, cx, cy, 0);
    const textures = new Set<THREE.Texture>();
    const scene = new THREE.Scene();
    const sky = 0xb7ccd9;
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, extent * 3, extent * 9);
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
    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, extent * 20);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 20;
    controls.maxDistance = extent * 7;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = false;
    const frame = (preset: CameraMode) => {
      const portrait = camera.aspect < 1;
      const angle = -ref.rotation * Math.PI / 180 + (portrait ? Math.PI / 2 : 0);
      const distance = extent / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, 0.8 / camera.aspect) * 1.1;
      const direction = preset === 'top'
        ? new THREE.Vector3(Math.sin(angle) * 0.001, 1, Math.cos(angle) * 0.001)
        : new THREE.Vector3(Math.sin(angle) * 1.5, portrait ? 2.2 : 1.5, Math.cos(angle) * 1.5).normalize();
      controls.target.set(0, 0, 0);
      camera.position.copy(direction).multiplyScalar(distance);
      controls.update();
    };
    frameRef.current = frame;
    let userMoved = false;
    const onStart = () => { userMoved = true; };
    controls.addEventListener('start', onStart);
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (!userMoved) frame(modeRef.current);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const landscape = makeLandscape(extent, supported.id, heightAt, renderer);
    landscape.textures.forEach(texture => textures.add(texture));
    scene.add(landscape.mesh);
    let environmentGroup: THREE.Group | null = null;

    const ribbon = (offset0: number, offset1: number, lift = 0) => {
      const positions: number[] = [], uv: number[] = [], indices: number[] = [];
      const n = ref.x.length;
      for (let i = 0; i <= n; i++) {
        const j = i % n;
        for (const offset of [offset0, offset1]) {
          const x = ref.x[j] - cx + geo.nx[j] * offset;
          const z = -(ref.y[j] - cy + geo.ny[j] * offset);
          positions.push(x, heightAt(ref.x[j] - cx, -(ref.y[j] - cy)) + lift, z);
          uv.push(offset, i === n ? ref.length : ref.s[j]);
        }
        if (i) { const k = i * 2; indices.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };
    const asphalt = surfaceMaterial('asphalt_02', 3, renderer, 0xa6a6a6);
    asphalt.textures.forEach(texture => textures.add(texture));
    const road = new THREE.Mesh(ribbon(7, -7), asphalt.material);
    road.receiveShadow = true;
    scene.add(road);
    const vergeAsset = ['bh-2002', 'sa-2021', 'qa-2004', 'ae-2009'].includes(supported.id)
      ? 'aerial_beach_01' : ['sg-2008', 'mc-1929', 'az-2016', 'us-2023'].includes(supported.id) ? 'asphalt_02' : 'aerial_grass_rock';
    const verge = surfaceMaterial(vergeAsset, vergeAsset === 'asphalt_02' ? 3 : 12, renderer, vergeAsset === 'aerial_grass_rock' ? 0x548b61 : 0xffffff);
    verge.textures.forEach(texture => textures.add(texture));
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(ribbon(side * 7, side * 11, -0.08), verge.material);
      edge.receiveShadow = true;
      scene.add(edge);
      const line = new THREE.Mesh(ribbon(side * 6.7, side * 6.55, 0.035), new THREE.MeshStandardMaterial({ color: 0xf4f3e9, roughness: 0.75, side: THREE.DoubleSide }));
      scene.add(line);
    }
    // Kerbs follow estimated curvature; they are visual aids, not surveyed geometry.
    const kerbPositions: number[] = [], kerbColors: number[] = [];
    for (const kerb of geo.kerbs) for (let i = kerb.from; i < kerb.to; i++) {
      const a = i % ref.x.length, b = (i + 1) % ref.x.length;
      const point = (j: number, off: number) => [ref.x[j] - cx + geo.nx[j] * off,
        heightAt(ref.x[j] - cx, -(ref.y[j] - cy)) + 0.06, -(ref.y[j] - cy + geo.ny[j] * off)];
      const color = new THREE.Color(i % 2 ? 0xf1f0e9 : 0xc72d25);
      for (const p of [point(a, kerb.side * 7), point(a, kerb.side * 5.8), point(b, kerb.side * 7),
        point(a, kerb.side * 5.8), point(b, kerb.side * 5.8), point(b, kerb.side * 7)]) {
        kerbPositions.push(...p); kerbColors.push(color.r, color.g, color.b);
      }
    }
    if (kerbPositions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(kerbPositions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(kerbColors, 3));
      geometry.computeVertexNormals();
      scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })));
    }

    fetch(`${import.meta.env.BASE_URL}environments/${supported.id}.json`, { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error('missing'); return response.json() as Promise<EnvironmentData>; })
      .then(data => {
        if (disposed) return;
        if (data.version !== 1 || data.circuitId !== supported.id) throw new Error('invalid');
        const built = buildEnvironment(data, ref, cx, cy, heightAt);
        if (!built.group) { setStatus('Contesto non allineato a questa versione del tracciato'); return; }
        environmentGroup = built.group;
        scene.add(built.group);
        setStatus(`Mappa OSM · ${built.buildings.toLocaleString('it-IT')} edifici · ${built.estimated.toLocaleString('it-IT')} altezze stimate`);
        loadPhotogrammetrySource(supported.id, abort.signal).then(async source => {
          if (disposed || !source) return;
          const placement = photogrammetryPlacement(data.outline, ref, cx, cy);
          if (!placement) { setPhotoStatus('Rilievo non allineabile a questo tracciato'); return; }
          const module = await import('../replay/photogrammetry3d');
          if (disposed) return;
          photogrammetry = module.createPhotogrammetry({url:source.url,origin:data.origin,altitude:source.originAltitude,camera,renderer,
            onStatus:message => { if(!disposed)setPhotoStatus(message); },
            onAttribution:credits => { if(!disposed)setPhotoCredits([source.attribution,...credits]); },
          });
          photogrammetry.group.applyMatrix4(placement);
          scene.add(photogrammetry.group);
        }).catch(() => { if(!disposed)setPhotoStatus('Rilievo fotografico non disponibile'); });

      })
      .catch(() => { if (!disposed) setStatus('Contesto geografico non disponibile · solo tracciato e terreno indicativo'); });
    const onContextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); setWebgl(false); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    const render = () => {
      if (disposed) return;
      landscape.mesh.visible = surroundingsRef.current && !photogrammetry;
      environmentGroup?.children.forEach(child => { child.visible = !photogrammetry && (surroundingsRef.current || Boolean(child.userData.circuitDetail)) || !surroundingsRef.current && Boolean(child.userData.circuitDetail); });
      controls.update();
      if (photogrammetry) { photogrammetry.group.visible = surroundingsRef.current; if(surroundingsRef.current)photogrammetry.update(); }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      observer.disconnect();
      if(photogrammetry){scene.remove(photogrammetry.group);photogrammetry.dispose();}
      frameRef.current = null;
      controls.removeEventListener('start', onStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const values = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        values.forEach(material => materials.add(material));
      });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
      geometries.forEach(geometry => geometry.dispose());
      textures.forEach(texture => texture.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [supported]);

  return (
    <main className="circuit-explorer">
      <div className="ce-host" ref={hostRef} />
      <div className="ce-shade" aria-hidden="true" />
      <header className="ce-header">
        <Link className="ce-back" to="/season" aria-label="Torna al calendario"><span aria-hidden="true">←</span> Calendario</Link>
        <label className="ce-picker"><span>Cambia circuito</span>
          <select value={supported?.id ?? ''} onChange={event => navigate(`/circuit/${event.target.value}`)}>
            {!supported && <option value="" disabled>Seleziona un circuito</option>}
            {MAPPED_CIRCUITS.map(item => <option key={item.id} value={item.id}>{item.location} · {item.name}</option>)}
          </select>
        </label>
      </header>
      {supported ? <>
        <section className="ce-heading">
          <div className="ce-eyebrow">Circuit Explorer <span>3D</span></div>
          <p className="ce-photo-status">{photoStatus}</p>
          <h1>{supported.name}</h1>
          <p>{supported.location}<span>·</span>{(supported.length / 1000).toFixed(3)} km<span>·</span>{MAPPED_CIRCUITS.length} circuiti da esplorare</p>
        </section>
        {!webgl && <div className="ce-error" role="alert"><h2>Vista 3D non disponibile</h2><p>Il browser non ha accesso a WebGL. Prova a ricaricare la pagina con l’accelerazione grafica attiva.</p><Link to="/season">Torna al calendario</Link></div>}
        <div className="ce-toolbar">
          <div className="ce-segment" role="group" aria-label="Contesto geografico">
            <button aria-pressed={surroundings} onClick={() => setSurroundings(true)}>Ambiente completo</button>
            <button aria-pressed={!surroundings} onClick={() => setSurroundings(false)}>Solo autodromo</button>
          </div>
          <div className="ce-segment" role="group" aria-label="Inquadratura">
            <button aria-pressed={mode === 'orbit'} onClick={() => { setMode('orbit'); frameRef.current?.('orbit'); }}>Orbita</button>
            <button aria-pressed={mode === 'top'} onClick={() => { setMode('top'); frameRef.current?.('top'); }}>Dall’alto</button>
            <button onClick={() => frameRef.current?.(mode)} aria-label="Ricomponi l’inquadratura">↺</button>
          </div>
        </div>
        {photoCredits.length>0 && <div className="ce-photo-credits">{photoCredits.join(' · ')}</div>}
        <details className="ce-sources">
          <summary><span className="ce-source-dot" />Fonti e dettagli del contesto</summary>
          <p className="ce-status" aria-live="polite">{status}</p>
          <p>Edifici, strade, acqua e aree verdi seguono i dati geografici OpenStreetMap. Facciate, alberi e altezze mancanti sono ricostruzioni indicative; le strutture temporanee possono mancare.</p>
          <p>Tracciato geografico, larghezza rappresentata di 14 m e cordoli indicativi. Terreno piano in assenza di dati altimetrici; nessuna telemetria necessaria.</p>
          <div className="ce-source-links"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · ODbL</a><a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">Tracciati · MIT</a><a href="https://polyhaven.com" target="_blank" rel="noreferrer">Texture · Poly Haven CC0</a></div>
        </details>
        <p className="ce-hint">Trascina per ruotare · Scorri per avvicinarti · Tasto destro per spostarti</p>
      </> : <div className="ce-error"><h1>Circuito non disponibile</h1><p>Scegli uno dei {MAPPED_CIRCUITS.length} circuiti nel menu per esplorare il suo ambiente.</p><Link to="/circuit/it-1922">Esplora Monza</Link></div>}
    </main>
  );
}
