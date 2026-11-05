import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { TilesGroup } from '3d-tiles-renderer/three';
import type { Tile } from '3d-tiles-renderer/core';
import { createPhotogrammetry, ecefToLocalMatrix, type PhotogrammetryLayer } from '../src/replay/photogrammetry3d';

// Independent WGS84 reference calculation; longitude/latitude are in degrees.
function ecef(longitude: number, latitude: number, height: number) {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  const a = 6378137, e2 = 6.6943799901413165e-3;
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return new THREE.Vector3((n + height) * Math.cos(lat) * Math.cos(lon),
    (n + height) * Math.cos(lat) * Math.sin(lon), (n * (1 - e2) + height) * Math.sin(lat));
}

const layers: PhotogrammetryLayer[] = [];
afterEach(() => {
  layers.splice(0).forEach(layer => layer.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(overrides: Partial<Parameters<typeof createPhotogrammetry>[0]> = {}) {
  vi.stubGlobal('window', { location: { href: 'http://localhost/' } });
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 10000);
  camera.position.set(0, 300, 300);
  camera.lookAt(0, 0, 0);
  const renderer = { getSize: (size: THREE.Vector2) => size.set(800, 600) } as THREE.WebGLRenderer;
  const layer = createPhotogrammetry({ url: 'http://localhost/fixture/root.json?token=private-token', origin: [9.28, 45.62], altitude: 142, camera, renderer, ...overrides });
  layers.push(layer);
  return layer;
}

function tilesOf(layer: PhotogrammetryLayer) { return (layer.group.children[0] as TilesGroup).tilesRenderer; }

function fixture() {
  const p = ecef(9.28, 45.62, 142);
  return { asset: { version: '1.0', copyright: 'Fixture survey © Owner' }, geometricError: 500,
    root: { boundingVolume: { sphere: [...p.toArray(), 150] }, geometricError: 0, children: [] } };
}

describe('photogrammetric ECEF tangent frame', () => {
  it.each([[9.28, 45.62, 142], [0, 0, 0], [-122.4, 37.8, 50], [151.2, -33.8, 12], [179.9, 89.9, 300]])(
    'maps origin and east/up/south metre axes correctly at (%s, %s, %s)', (longitude, latitude, height) => {
      const matrix = ecefToLocalMatrix([longitude, latitude], height);
      const position = ecef(longitude, latitude, height);
      expect(position.clone().applyMatrix4(matrix).length()).toBeLessThan(1e-7);
      const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
      const east = new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0);
      const north = new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat));
      const up = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
      for (const [axis, expected] of [[east, new THREE.Vector3(1, 0, 0)], [up, new THREE.Vector3(0, 1, 0)], [north, new THREE.Vector3(0, 0, -1)]]) {
        expect(position.clone().add(axis).applyMatrix4(matrix).distanceTo(expected)).toBeLessThan(1e-7);
      }
      expect(matrix.determinant()).toBeCloseTo(1, 10);
    },
  );

  it('preserves vertical metres and rejects invalid origins without echoing input', () => {
    const matrix = ecefToLocalMatrix([9.28, 45.62], 142);
    expect(ecef(9.28, 45.62, 167).applyMatrix4(matrix).distanceTo(new THREE.Vector3(0, 25, 0))).toBeLessThan(1e-7);
    for (const origin of [[NaN, 0], [0, Infinity], [181, 0], [0, 91]] as [number, number][]) {
      expect(() => ecefToLocalMatrix(origin, 0)).toThrow('Invalid geographic origin');
    }
  });
});

describe('photogrammetry source lifecycle', () => {
  it('defers requests, uses isolated budgets, streams a mocked tileset, and emits text attribution', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture())));
    vi.stubGlobal('fetch', fetcher);
    const onStatus = vi.fn(), onAttribution = vi.fn();
    const layer = setup({ onStatus, onAttribution });
    const other = setup();
    expect(fetcher).not.toHaveBeenCalled();
    const tiles = tilesOf(layer);
    expect(tiles.errorTarget).toBe(2);
    expect(tiles.lruCache.maxBytesSize).toBe(256 * 1024 * 1024);
    expect(tiles.lruCache).not.toBe(tilesOf(other).lruCache);
    expect(tiles.downloadQueue).not.toBe(tilesOf(other).downloadQueue);
    layer.update();
    await vi.waitFor(() => expect(onAttribution).toHaveBeenCalledWith(['Fixture survey © Owner']));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onStatus.mock.calls.some(([message]) => String(message).includes('connesso'))).toBe(true);
    expect(onStatus.mock.calls.flat().join(' ')).not.toContain('private-token');
    const scene = new THREE.Scene();
    scene.add(layer.group);
    layer.dispose();
    layer.dispose();
    layer.update();
    expect(layer.group.parent).toBeNull();
    expect(layer.group.children).toHaveLength(0);
    expect(tiles.cameras).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts a pending root request and suppresses callbacks after disposal', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError'))));
    }));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onStatus = vi.fn(), onAttribution = vi.fn();
    const layer = setup({ onStatus, onAttribution });
    layer.update();
    expect(signal?.aborted).toBe(false);
    layer.dispose();
    const statusCount = onStatus.mock.calls.length, attributionCount = onAttribution.mock.calls.length;
    expect(signal?.aborted).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onStatus).toHaveBeenCalledTimes(statusCount);
    expect(onAttribution).toHaveBeenCalledTimes(attributionCount);
    expect(logged.mock.calls.flat().map(String).join(' ')).not.toContain('private-token');
  });

  it('sanitizes failing-source status and upstream root errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('http://localhost/fixture/root.json?token=private-token')));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onStatus = vi.fn();
    const layer = setup({ onStatus });
    layer.update();
    await vi.waitFor(() => expect(onStatus.mock.calls.some(([message]) => String(message).includes('non disponibile'))).toBe(true));
    expect(onStatus.mock.calls.flat().join(' ')).not.toContain('private-token');
    expect(logged.mock.calls.flat().map(String).join(' ')).not.toContain('private-token');
  });

  it('aliases credential-bearing tile URIs while preserving real fetch addresses and plain credits', () => {
    const onAttribution = vi.fn();
    const layer = setup({ onAttribution });
    const tiles = tilesOf(layer);
    const plugin = tiles.getPluginByName('Pitwall source lifecycle and text attribution') as {
      preprocessNode(tile: Tile, directory: string): void;
      preprocessURL(url: string, tile: Tile): string;
    };
    const tile = { content: { uri: 'tile.glb?token=private-token' }, engineData: { metadata: { asset: { copyright: '<b>Owner</b>' } } } } as unknown as Tile;
    plugin.preprocessNode(tile, 'http://localhost/fixture');
    expect(tile.content?.uri).toMatch(/^__pitwall_tile_\d+\.glb$/);
    expect(plugin.preprocessURL('http://localhost/fixture/' + tile.content!.uri, tile)).toBe('http://localhost/fixture/tile.glb?token=private-token');
    tiles.dispatchEvent({ type: 'tile-visibility-change', tile, scene: new THREE.Group(), visible: true });
    expect(onAttribution).toHaveBeenLastCalledWith(['<b>Owner</b>']);
    tiles.dispatchEvent({ type: 'tile-visibility-change', tile, scene: new THREE.Group(), visible: false });
    expect(onAttribution).toHaveBeenLastCalledWith([]);
  });
});
