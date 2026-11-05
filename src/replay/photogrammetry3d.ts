import * as THREE from 'three';
import { TilesRenderer, WGS84_ELLIPSOID } from '3d-tiles-renderer/three';
import { DownloadPriorityQueue, LRUCache, PriorityQueue, type Tile, type Tileset } from '3d-tiles-renderer/core';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/three/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import dracoWrapperUrl from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url';
import dracoBinaryUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';

export interface PhotogrammetryOptions {
  /** Authorized ECEF-georeferenced tileset JSON URL. No provider or default key is implied. */
  url: string;
  /** Longitude, latitude in degrees. */
  origin: readonly [number, number];
  /** WGS84 ellipsoidal height in metres, not orthometric/sea-level altitude. */
  altitude: number;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  onStatus?: (text: string) => void;
  /** Plain text only. Render as text nodes; never interpret as HTML. */
  onAttribution?: (texts: string[]) => void;
}

export interface PhotogrammetryLayer {
  /** Local metre frame: +X east, +Y up, +Z south. May be transformed by the caller. */
  group: THREE.Group;
  /** Call after updating the camera each frame; also refreshes the viewport resolution. */
  update(): void;
  dispose(): void;
}

/** ECEF metres → a right-handed tangent frame with east/up/south axes. */
export function ecefToLocalMatrix(origin: readonly [number, number], altitude: number): THREE.Matrix4 {
  const [longitude, latitude] = origin;
  if (![longitude, latitude, altitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Invalid geographic origin');
  }
  const lon = THREE.MathUtils.degToRad(longitude), lat = THREE.MathUtils.degToRad(latitude);
  const east = new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0);
  const up = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
  const south = new THREE.Vector3(Math.sin(lat) * Math.cos(lon), Math.sin(lat) * Math.sin(lon), -Math.cos(lat));
  const position = WGS84_ELLIPSOID.getCartographicToPosition(lat, lon, altitude, new THREE.Vector3());
  return new THREE.Matrix4().makeBasis(east, up, south).setPosition(position).invert();
}

// These documented JavaScript plugin hooks are missing from the package's .d.ts.
interface RendererHooks {
  loadRootTileset(): Promise<Tileset>;
  parseTile(buffer: ArrayBuffer, tile: Tile, extension: string, url: string, signal: AbortSignal): Promise<void>;
}
const hooks = TilesRenderer.prototype as unknown as RendererHooks;
type MetadataTile = Tile & { engineData?: { metadata?: { asset?: { copyright?: unknown } } } };

/**
 * Stream an explicitly configured source. Nothing is fetched until update().
 * TilesRenderer owns tile geometry/material/texture disposal; the caller owns its renderer/camera.
 * Coverage, authorization, CORS and source licensing remain the source operator's responsibility.
 */
export function createPhotogrammetry(options: PhotogrammetryOptions): PhotogrammetryLayer {
  const localMatrix = ecefToLocalMatrix(options.origin, options.altitude);
  let source: URL;
  try {
    source = new URL(options.url, typeof window === 'undefined' ? 'http://localhost/' : window.location.href);
    if (!options.url.trim() || !['http:', 'https:'].includes(source.protocol) || source.username || source.password) throw new Error();
  } catch {
    throw new Error('Invalid tileset URL');
  }
  let disposed = false;
  let lastStatus = '';
  let lastAttribution = '';
  const report = (text: string) => {
    if (!disposed && lastStatus !== text) { lastStatus = text; options.onStatus?.(text); }
  };
  const group = new THREE.Group();
  group.name = 'Configured 3D Tiles context';
  const tiles = new TilesRenderer(source.href);
  tiles.group.matrixAutoUpdate = false;
  tiles.group.matrix.copy(localMatrix);
  tiles.group.matrixWorldNeedsUpdate = true;
  group.add(tiles.group);
  tiles.errorTarget = 2;
  tiles.maxTilesProcessed = 500;
  tiles.loadSiblings = false;
  tiles.setCamera(options.camera);

  // Isolated budgets avoid changing global caches used by another view. These are cache
  // targets, not a strict process/GPU cap: an individual decoded tile can exceed them.
  const cache = new LRUCache();
  cache.minSize = 100;
  cache.maxSize = 400;
  cache.minBytesSize = 192 * 1024 * 1024;
  cache.maxBytesSize = 256 * 1024 * 1024;
  cache.unloadPercent = 0.2;
  cache.unloadPriorityCallback = tiles.lruCache.unloadPriorityCallback;
  tiles.lruCache = cache;
  const downloads = new DownloadPriorityQueue();
  downloads.maxJobsPerOrigin = 6;
  downloads.priorityCallback = tiles.downloadQueue.priorityCallback;
  tiles.downloadQueue = downloads;
  const parses = new PriorityQueue();
  parses.maxJobs = 2;
  parses.priorityCallback = tiles.parseQueue.priorityCallback;
  tiles.parseQueue = parses;
  const nodes = new PriorityQueue();
  nodes.maxJobs = 10;
  nodes.priorityCallback = tiles.processNodeQueue.priorityCallback;
  tiles.processNodeQueue = nodes;

  // Vite bundles these installed Three.js decoder files locally. No decoder CDN request.
  const decoderManager = new THREE.LoadingManager();
  decoderManager.setURLModifier(url => url === 'draco_wasm_wrapper.js' ? dracoWrapperUrl : url === 'draco_decoder.wasm' ? dracoBinaryUrl : url);
  const draco = new DRACOLoader(decoderManager).setDecoderConfig({ type: 'wasm' }).setWorkerLimit(2);
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco, meshoptDecoder: MeshoptDecoder, autoDispose: false }));

  const lifetime = new AbortController();
  const visibleCredits = new Map<Tile, string>();
  const tilesetCredits = new Set<string>();
  // Upstream logs tile.content.uri on failure. Alias it without credentials and resolve
  // the actual address only in preprocessURL, preserving the extension used by parsers.
  const addresses = new WeakMap<Tile, string>();
  let nextAddress = 0;
  const safeFailure = () => new Error('Configured 3D Tiles resource could not be loaded');
  tiles.registerPlugin({
    name: 'Pitwall source lifecycle and text attribution',
    preprocessNode(tile: Tile, directory: string) {
      if (!tile.content?.uri) return;
      try {
        const actual = new URL(tile.content.uri, directory + '/');
        const extension = actual.pathname.match(/\.([a-z0-9]{1,8})$/i)?.[1] || 'bin';
        addresses.set(tile, actual.href);
        tile.content.uri = `__pitwall_tile_${nextAddress++}.${extension}`;
      } catch { throw safeFailure(); }
    },
    preprocessURL(url: string, tile: Tile | null) { return tile ? addresses.get(tile) ?? url : url; },
    async fetchData(url: string, init: RequestInit = {}) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      lifetime.signal.addEventListener('abort', abort, { once: true });
      init.signal?.addEventListener('abort', abort, { once: true });
      if (lifetime.signal.aborted || init.signal?.aborted) controller.abort();
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) throw safeFailure();
        // Returning decoded data prevents the upstream HTTP/JSON error path exposing URLs.
        return url === source.href || /\.json(?:[?#]|$)/i.test(url) ? await response.json() : await response.arrayBuffer();
      } catch {
        if (controller.signal.aborted) throw new DOMException('Tile loading cancelled', 'AbortError');
        throw safeFailure();
      } finally {
        lifetime.signal.removeEventListener('abort', abort);
        init.signal?.removeEventListener('abort', abort);
      }
    },
    async loadRootTileset() {
      try { return await hooks.loadRootTileset.call(tiles); }
      catch { throw safeFailure(); }
    },
    async parseTile(buffer: ArrayBuffer, tile: Tile, extension: string, url: string, signal: AbortSignal) {
      try { return await hooks.parseTile.call(tiles, buffer, tile, extension, url, signal); }
      catch { throw safeFailure(); }
    },
    getAttributions(target: Array<{ type: string; value: unknown }>) {
      for (const value of new Set([...tilesetCredits, ...visibleCredits.values()])) target.push({ type: 'string', value });
    },
  });

  const emitAttribution = () => {
    if (disposed) return;
    const texts = [...new Set(tiles.getAttributions().filter(item => item.type === 'string' && typeof item.value === 'string')
      .map(item => (item.value as string).trim()).filter(Boolean))];
    const key = JSON.stringify(texts);
    if (key !== lastAttribution) { lastAttribution = key; options.onAttribution?.(texts); }
  };
  const onTileset = ({ tileset }: { tileset: Tileset }) => {
    const copyright = (tileset.asset as Tileset['asset'] & { copyright?: unknown }).copyright;
    if (typeof copyright === 'string' && copyright.trim()) tilesetCredits.add(copyright.trim());
    report('Contesto 3D connesso · caricamento dei dettagli…');
    emitAttribution();
  };
  const onVisibility = ({ tile, visible }: { tile: Tile; visible: boolean }) => {
    const copyright = (tile as MetadataTile).engineData?.metadata?.asset?.copyright;
    if (visible && typeof copyright === 'string' && copyright.trim()) visibleCredits.set(tile, copyright.trim());
    else visibleCredits.delete(tile);
    emitAttribution();
  };
  const onModel = () => report('Contesto 3D disponibile · dettagli progressivi');
  const onError = () => report('Contesto 3D non disponibile · verifica sorgente e autorizzazione');
  tiles.addEventListener('load-tileset', onTileset);
  tiles.addEventListener('tile-visibility-change', onVisibility);
  tiles.addEventListener('load-model', onModel);
  tiles.addEventListener('load-error', onError);
  report('Connessione al contesto 3D…');

  return {
    group,
    update() {
      if (disposed || !group.visible) return;
      options.camera.updateMatrixWorld();
      group.updateWorldMatrix(true, true);
      tiles.setResolutionFromRenderer(options.camera, options.renderer);
      tiles.update();
      emitAttribution();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      tiles.removeEventListener('load-tileset', onTileset);
      tiles.removeEventListener('tile-visibility-change', onVisibility);
      tiles.removeEventListener('load-model', onModel);
      tiles.removeEventListener('load-error', onError);
      tiles.deleteCamera(options.camera);
      tiles.dispose();
      draco.dispose();
      visibleCredits.clear();
      tilesetCredits.clear();
      group.removeFromParent();
      group.clear();
    },
  };
}
