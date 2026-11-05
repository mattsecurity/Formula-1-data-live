import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Section = [x: number, centerY: number, halfWidth: number, halfHeight: number];

/** A smooth longitudinal shell, with elliptical sections in the Y/Z plane. */
function shell(sections: Section[], offsetZ = 0, facets = 16): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [x, y, width, height] of sections) {
    for (let j = 0; j < facets; j++) {
      const angle = (j / facets) * Math.PI * 2;
      positions.push(x, y + Math.sin(angle) * height, offsetZ + Math.cos(angle) * width);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < facets; j++) {
      const a = i * facets + j;
      const b = i * facets + (j + 1) % facets;
      const c = a + facets;
      const d = b + facets;
      indices.push(a, c, b, b, c, d);
    }
  }
  for (let j = 1; j < facets - 1; j++) {
    indices.push(0, j, j + 1);
    const end = (sections.length - 1) * facets;
    indices.push(end, end + j + 1, end + j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Generic contemporary open-wheel car. +X is forward, Y is up; dimensions are metres. */
export function makeCar(color: string): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Procedural open-wheel car';
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.48, roughness: 0.29 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.25, roughness: 0.57 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.91 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x626772, metalness: 0.8, roughness: 0.28 });
  const rimDark = new THREE.MeshStandardMaterial({ color: 0x282c33, metalness: 0.6, roughness: 0.35 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf0eee6, metalness: 0.2, roughness: 0.3 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x111b2b, metalness: 0.7, roughness: 0.16 });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const transform = new THREE.Object3D();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0,
    rotation: [number, number, number] = [0, 0, 0]) => {
    transform.position.set(x, y, z);
    transform.rotation.set(...rotation);
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    // A common attribute set permits one draw call per material for the whole car.
    for (const key of Object.keys(flat.attributes)) if (key !== 'position' && key !== 'normal') flat.deleteAttribute(key);
    if (flat !== geometry) geometry.dispose();
    const batch = batches.get(material) ?? [];
    batch.push(flat);
    batches.set(material, batch);
  };
  const box = (material: THREE.Material, size: [number, number, number], position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0]) => add(new THREE.BoxGeometry(...size), material, ...position, rotation);
  const rod = (a: [number, number, number], b: [number, number, number], radius: number, material = carbon) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const geometry = new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 7);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()));
    add(geometry, material, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  };

  // Thin ground-effect floor with a narrowing tail and swept outer edges.
  add(shell([[-2.23, 0.105, 0.4, 0.025], [-1.6, 0.105, 0.81, 0.025],
    [0.1, 0.105, 0.84, 0.025], [0.7, 0.105, 0.58, 0.025], [1.25, 0.105, 0.26, 0.025]]), carbon);
  add(shell([[-1.95, 0.3, 0.15, 0.14], [-1.35, 0.39, 0.31, 0.23],
    [-0.55, 0.48, 0.33, 0.3], [-0.33, 0.5, 0.3, 0.25]]), paint);
  // Raised narrow nose drops toward the front wing, leaving the suspension exposed.
  add(shell([[0.65, 0.48, 0.28, 0.22], [1.05, 0.47, 0.24, 0.17],
    [1.65, 0.38, 0.15, 0.12], [2.42, 0.24, 0.105, 0.075], [2.58, 0.22, 0.065, 0.04]]), paint);
  for (const side of [-1, 1]) {
    // Undercut sidepods: broad intake shoulders, falling toward the rear floor.
    add(shell([[-1.65, 0.26, 0.1, 0.09], [-1.2, 0.34, 0.22, 0.15],
      [-0.58, 0.43, 0.3, 0.19], [0.05, 0.46, 0.3, 0.17], [0.22, 0.44, 0.23, 0.13]], side * 0.49), paint);
    add(shell([[0.224, 0.46, 0.17, 0.085], [0.232, 0.46, 0.17, 0.085]], side * 0.49), carbon);
    add(shell([[-0.42, 0.57, 0.075, 0.12], [0.25, 0.58, 0.075, 0.12],
      [0.72, 0.55, 0.065, 0.1]], side * 0.26), paint);
    rod([-1.65, 0.15, side * 0.77], [0.18, 0.15, side * 0.81], 0.022);
    // Small mirrors on stems beside the cockpit.
    rod([0.43, 0.62, side * 0.28], [0.37, 0.7, side * 0.48], 0.012);
    add(new THREE.SphereGeometry(1, 10, 6).scale(0.11, 0.045, 0.065), paint, 0.36, 0.7, side * 0.48);
  }
  // Cockpit cavity, driver and wraparound halo stay legible in a chase view.
  add(new THREE.SphereGeometry(1, 16, 8).scale(0.48, 0.075, 0.25), carbon, 0.13, 0.61, 0);
  add(new THREE.SphereGeometry(1, 16, 10).scale(0.145, 0.16, 0.14), light, 0.03, 0.74, 0);
  add(new THREE.SphereGeometry(1, 12, 6).scale(0.1, 0.053, 0.143), visor, 0.124, 0.77, 0);
  const haloPoints = [new THREE.Vector3(-0.27, 0.78, -0.27), new THREE.Vector3(0.2, 0.86, -0.29),
    new THREE.Vector3(0.65, 0.8, 0), new THREE.Vector3(0.2, 0.86, 0.29), new THREE.Vector3(-0.27, 0.78, 0.27)];
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(haloPoints), 24, 0.027, 6, false), carbon);
  rod([0.65, 0.8, 0], [0.77, 0.56, 0], 0.028);
  rod([-0.27, 0.78, -0.27], [-0.34, 0.59, -0.24], 0.025);
  rod([-0.27, 0.78, 0.27], [-0.34, 0.59, 0.24], 0.025);
  // Airbox and tapered engine cover, with a slim vertical fin.
  add(shell([[-1.7, 0.42, 0.08, 0.12], [-1.15, 0.57, 0.16, 0.21],
    [-0.57, 0.72, 0.21, 0.28], [-0.35, 0.76, 0.17, 0.22]]), paint);
  add(shell([[-0.34, 0.89, 0.1, 0.08], [-0.327, 0.89, 0.1, 0.08]]), carbon);
  add(shell([[-1.6, 0.65, 0.014, 0.08], [-0.65, 0.8, 0.014, 0.17], [-0.46, 0.82, 0.014, 0.12]], 0, 8), paint);

  // Multi-element front wing, curved in plan, with distinct outboard endplates.
  for (let element = 0; element < 3; element++) {
    const x = 2.72 - element * 0.14;
    add(shell([[x - 0.1, 0.14 + element * 0.045, 0.95, 0.012],
      [x + 0.08, 0.12 + element * 0.045, 0.99, 0.012]], 0, 24), element === 2 ? paint : carbon);
  }
  for (const side of [-1, 1]) {
    box(paint, [0.48, 0.18, 0.027], [2.56, 0.2, side * 0.97]);
    rod([2.32, 0.21, side * 0.13], [2.35, 0.13, side * 0.13], 0.018);
    // Rear wing endplates and two supporting pylons.
    box(carbon, [0.48, 0.49, 0.035], [-2.42, 0.76, side * 0.61]);
    rod([-1.98, 0.31, side * 0.18], [-2.36, 0.91, side * 0.18], 0.025);
    box(carbon, [0.67, 0.027, 0.09], [-1.91, 0.19, side * 0.34], [0, 0, -0.2]);
  }
  box(paint, [0.37, 0.055, 1.21], [-2.44, 0.99, 0], [0, 0, -0.09]);
  box(carbon, [0.32, 0.045, 1.18], [-2.42, 0.84, 0], [0, 0, -0.18]);
  box(carbon, [0.3, 0.045, 0.95], [-2.12, 0.34, 0]);

  for (const x of [1.65, -1.65]) {
    const width = x > 0 ? 0.34 : 0.39;
    for (const side of [-1, 1]) {
      const z = side * 0.84;
      const half = width / 2;
      // Rounded tyre shoulders and recessed sidewalls around an 18-inch-style rim.
      const profile = [[0.235, -half], [0.3, -half], [0.343, -half + 0.035],
        [0.36, -half + 0.07], [0.36, half - 0.07], [0.343, half - 0.035],
        [0.3, half], [0.235, half], [0.235, -half]].map(([r, a]) => new THREE.Vector2(r, a));
      add(new THREE.LatheGeometry(profile, 24), rubber, x, 0.36, z, [Math.PI / 2, 0, 0]);
      // Fine circumferential wear bands provide tyre detail without chunky off-road tread.
      for (const band of [-0.095, 0.095]) {
        add(new THREE.TorusGeometry(0.357, 0.004, 4, 24), carbon, x, 0.36, z + band);
      }
      for (const face of [-1, 1]) {
        const faceZ = z + face * (half + 0.003);
        add(new THREE.CylinderGeometry(0.226, 0.226, 0.014, 20), rimDark, x, 0.36, faceZ, [Math.PI / 2, 0, 0]);
        add(new THREE.TorusGeometry(0.221, 0.012, 5, 24), alloy, x, 0.36, faceZ + face * 0.009);
        add(new THREE.CylinderGeometry(0.058, 0.058, 0.028, 10), alloy, x, 0.36, faceZ + face * 0.015, [Math.PI / 2, 0, 0]);
        for (let spoke = 0; spoke < 6; spoke++) {
          const angle = spoke * Math.PI / 3;
          rod([x + Math.cos(angle) * 0.07, 0.36 + Math.sin(angle) * 0.07, faceZ + face * 0.012],
            [x + Math.cos(angle + 0.16) * 0.205, 0.36 + Math.sin(angle + 0.16) * 0.205, faceZ + face * 0.012], 0.013, alloy);
        }
      }
      // Paired suspension wishbones and pushrods connect each exposed wheel to the chassis.
      for (const y of [0.25, 0.45]) {
        rod([x - 0.43, y, side * 0.23], [x, 0.34, z], 0.018);
        rod([x + 0.34, y, side * 0.23], [x, 0.34, z], 0.018);
      }
      rod([x - 0.18, 0.57, side * 0.21], [x + 0.05, 0.26, z], 0.016, alloy);
    }
  }

  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach(part => part.dispose());
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
