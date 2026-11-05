import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SurveySource } from '../data/surveySources';

/** Assets use local east/up/south metres. Their elevations remain untouched. */
export function surveyPlacement(sourceOrigin: readonly [number, number], environmentOrigin: readonly [number, number], placement: THREE.Matrix4) {
  const east = (sourceOrigin[0] - environmentOrigin[0]) * 111320 * Math.cos(environmentOrigin[1] * Math.PI / 180);
  const north = (sourceOrigin[1] - environmentOrigin[1]) * 111320;
  return placement.clone().multiply(new THREE.Matrix4().makeTranslation(east, 0, -north));
}

export function disposeSurveyObjects(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const images = new Set<ImageBitmap>();
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    list.forEach(material => materials.add(material));
  });
  materials.forEach(material => {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  });
  textures.forEach(texture => {
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) images.add(texture.image);
    texture.dispose();
  });
  images.forEach(image => image.close());
  geometries.forEach(geometry => geometry.dispose());
  group.removeFromParent();
  group.clear();
}

export async function loadSurvey(options: {
  source: SurveySource;
  environmentOrigin: readonly [number, number];
  placement: THREE.Matrix4;
  signal: AbortSignal;
}) {
  const { source, signal } = options;
  const url = `${import.meta.env.BASE_URL}${source.url}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Survey download failed');
  const buffer = await response.arrayBuffer();
  signal.throwIfAborted();
  // Published assets are self-contained GLBs: never interpret an HTML fallback as glTF.
  if (buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) throw new Error('Invalid survey GLB');
  const gltf = await new GLTFLoader().parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
  const group = gltf.scene;
  try {
    signal.throwIfAborted();
    group.name = source.label;
    group.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
      }
      if (object instanceof THREE.Points) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (material instanceof THREE.PointsMaterial) {
            material.size = 1.5;
            material.sizeAttenuation = true;
          }
        });
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      // Captured colours already include lighting. Avoid inventing new baked shadows.
      materials.forEach(material => { material.toneMapped = false; });
    });
    group.applyMatrix4(surveyPlacement(source.origin, options.environmentOrigin, options.placement));
    group.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(group);
    if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) throw new Error('Empty survey');
    let disposed = false;
    return { group, bounds, dispose() { if (!disposed) { disposed = true; disposeSurveyObjects(group); } } };
  } catch (error) {
    disposeSurveyObjects(group);
    throw error;
  }
}
