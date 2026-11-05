import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { disposeSurveyObjects, loadSurvey, surveyPlacement } from '../src/replay/survey3d';
import { surveySource } from '../src/data/surveySources';

afterEach(() => vi.unstubAllGlobals());

describe('survey placement and resource ownership', () => {
  it('composes geographic origin offset before telemetry rotation and preserves survey altitude', () => {
    const origin = [144, -38] as const;
    const surveyOrigin = [144 + 150 / (111320 * Math.cos(-38 * Math.PI / 180)), -38 + 70 / 111320] as const;
    const alignment = new THREE.Matrix4().makeRotationY(0.6);
    alignment.setPosition(20, 0, -40);
    const transformed = new THREE.Vector3(10, 25, -30).applyMatrix4(surveyPlacement(surveyOrigin, origin, alignment));
    const expected = new THREE.Vector3(160, 25, -100).applyMatrix4(alignment);
    expect(transformed.distanceTo(expected)).toBeLessThan(0.00001);
    expect(transformed.y).toBe(25);
  });

  it('disposes shared geometry, materials and textures once across mesh and point objects', () => {
    const geometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
    const pointsMaterial = new THREE.PointsMaterial();
    root.add(new THREE.Points(geometry, pointsMaterial));
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeTexture = vi.spyOn(texture, 'dispose');
    const disposePoints = vi.spyOn(pointsMaterial, 'dispose');
    disposeSurveyObjects(root);
    [disposeGeometry, disposeMaterial, disposeTexture, disposePoints].forEach(spy => expect(spy).toHaveBeenCalledOnce());
    expect(root.children).toHaveLength(0);
  });

  it('rejects a successful SPA HTML fallback instead of interpreting it as a survey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not a model</html>')));
    await expect(loadSurvey({ source: surveySource('au-1953')!, environmentOrigin: [144, -38], placement: new THREE.Matrix4(), signal: new AbortController().signal })).rejects.toThrow('Invalid survey GLB');
  });

  it('does not parse a response after cancellation', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      controller.abort();
      return new Response(new ArrayBuffer(16));
    }));
    await expect(loadSurvey({ source: surveySource('br-1940')!, environmentOrigin: [-46, -23], placement: new THREE.Matrix4(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
