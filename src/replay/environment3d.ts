import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fitEnvironment } from '../model/environmentAlignment';
export { createTerrainSampler as terrainSampler } from '../model/terrainHeight';
import type { ReferencePath } from '../model/types';

export interface EnvironmentFeature {
  id: number | string; kind: 'building' | 'water' | 'road' | 'vegetation' | 'barrier';
  role?: 'circuit';
  points: number[][]; holes?: number[][][]; height: number | null; name?: string; type?: string;
}
export interface EnvironmentData { version: number; circuitId: string; origin: [number, number]; outline: number[][]; features: EnvironmentFeature[] }
const DESERT = new Set(['bh-2002', 'sa-2021', 'qa-2004', 'ae-2009']);
const URBAN = new Set(['sg-2008', 'mc-1929', 'az-2016', 'us-2023']);

/** Local, licensed PBR assets; repeat distance is expressed in world metres. */
export function surfaceMaterial(asset: string, metres: number, renderer: THREE.WebGLRenderer, color = 0xffffff) {
  const loader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  const texture = (suffix: string, srgb = false) => {
    const t = loader.load(`${import.meta.env.BASE_URL}textures/${asset}-${suffix}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / metres, 1 / metres);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    return t;
  };
  const material = new THREE.MeshStandardMaterial({ color, map: texture('color', true), normalMap: texture('normal'), roughnessMap: texture('roughness'), roughness: 1, side: THREE.DoubleSide });
  material.normalScale.set(0.5, 0.5);
  return { material, textures };
}

export function makeLandscape(extent: number, id: string | undefined, heightAt: (x:number,z:number)=>number, renderer: THREE.WebGLRenderer) {
  const desert = DESERT.has(id || '');
  const urban = URBAN.has(id || '');
  const surface = surfaceMaterial(desert ? 'aerial_beach_01' : urban ? 'asphalt_02' : 'aerial_grass_rock', desert ? 30 : urban ? 12 : 80, renderer, urban ? 0x999b97 : desert ? 0xffffff : 0x548b61);
  const geometry = new THREE.PlaneGeometry(extent * 5, extent * 5, 96, 96);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    p.setY(i, heightAt(p.getX(i), p.getZ(i)) - 0.65);
    uv.setXY(i, p.getX(i), p.getZ(i));
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, surface.material);
  mesh.receiveShadow = true;
  return { mesh, textures: surface.textures };
}

export function buildEnvironment(data: EnvironmentData, ref: ReferencePath, cx: number, cy: number, heightAt: (x:number,z:number)=>number) {
  const fit = fitEnvironment(data.outline, ref);
  if (!fit.accepted) return { group: null, rms: fit.rms, buildings: 0, estimated: 0 };
  const upm = ref.unitsPerMeter || 10;
  const project = (p:number[]) => {
    const [x,y] = fit.project(p[0], p[1]);
    return new THREE.Vector2((x-cx)/upm, (y-cy)/upm);
  };
  const group = new THREE.Group();
  group.name = 'OpenStreetMap surroundings';
  const buckets: Record<string,THREE.BufferGeometry[]> = { stone:[], glass:[], stand:[], roof:[], stoneCircuit:[], glassCircuit:[], standCircuit:[], roofCircuit:[], barrier:[], fence:[], water:[], green:[], forest:[], road:[] };
  let buildings = 0, estimated = 0;
  const treePositions: THREE.Vector3[] = [];
  const trackPoints = Array.from(ref.x, (x,i)=>new THREE.Vector2((x-cx)/upm,(ref.y[i]-cy)/upm));
  const pitPoints = ref.pitLane ? Array.from(ref.pitLane.x, (x,i)=>new THREE.Vector2((x-cx)/upm,(ref.pitLane!.y[i]-cy)/upm)) : [];
  const nearPath = (p:THREE.Vector2,path:THREE.Vector2[],clearance:number,closed:boolean) => {
    for(let i=0;i<path.length-(closed?0:1);i++) {
      const a=path[i],b=path[(i+1)%path.length];const dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
      if((p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2<clearance**2)return true;
    }
    return false;
  };

  for (const f of data.features) {
    if (f.points.length < 2 || (f.points.length < 3 && f.kind !== 'road' && f.kind !== 'barrier')) continue;
    const pts = f.points.map(project);
    const center = pts.reduce((sum,p)=>sum.add(p),new THREE.Vector2()).multiplyScalar(1/pts.length);
    const base = heightAt(center.x, -center.y);
    if (f.kind === 'barrier') {
      for (let i=1;i<pts.length;i++) {
        const a=pts[i-1],b=pts[i],mid=a.clone().add(b).multiplyScalar(0.5);
        if (!nearPath(mid,trackPoints,45,true) && !nearPath(mid,pitPoints,25,false)) continue;
        const length=a.distanceTo(b);if(length<0.1)continue;
        const h=f.height ?? (f.type==='fence'?2.5:1);
        const ay=heightAt(a.x,-a.y),by=heightAt(b.x,-b.y);
        const y=(ay+by)/2;
        const wall=f.type==='wall'||f.type==='retaining_wall';
        // Position and direction come from the mapped barrier; cross section is inferred.
        const levels=wall?[h/2]:f.type==='fence'?[0.45,h]:[0.45,0.85];
        for(const level of levels) {
          const rail=new THREE.BoxGeometry(Math.hypot(length,by-ay),wall?h:0.12,wall?0.35:0.12);
          rail.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(b.x-a.x,by-ay,a.y-b.y).normalize()));rail.translate(mid.x,y+level,-mid.y);buckets.barrier.push(rail);
        }
        if (f.type==='fence') {
          const net=new THREE.BufferGeometry();
          net.setAttribute('position',new THREE.Float32BufferAttribute([a.x,ay,-a.y,b.x,by,-b.y,a.x,ay+h,-a.y,b.x,by,-b.y,b.x,by+h,-b.y,a.x,ay+h,-a.y],3));
          net.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,length,0,0,h,length,0,length,h,0,h],2));net.computeVertexNormals();buckets.fence.push(net);
        }
        if(!wall) for(let d=0;d<length;d+=4) {
          const p=a.clone().lerp(b,d/length),post=new THREE.BoxGeometry(0.09,h,0.09);
          post.translate(p.x,heightAt(p.x,-p.y)+h/2,-p.y);buckets.barrier.push(post);
        }
      }
      continue;
    }
    if (f.kind === 'road') {
      const pos:number[]=[];
      const width = f.type === 'footway' ? 1.4 : f.type === 'service' ? 2.5 : 4;
      for (let i=1;i<pts.length;i++) {
        const a=pts[i-1],b=pts[i],d=b.clone().sub(a).normalize();
        const off = new THREE.Vector2(-d.y,d.x).multiplyScalar(width);
        const quad=[a.clone().add(off),a.clone().sub(off),b.clone().add(off),a.clone().sub(off),b.clone().sub(off),b.clone().add(off)];
        for (const p of quad) pos.push(p.x,heightAt(p.x,-p.y)-0.24,-p.y);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();buckets.road.push(g);continue;
    }
    const shape = new THREE.Shape(pts);
    for (const hole of f.holes || []) shape.holes.push(new THREE.Path(hole.map(project)));
    if (f.kind === 'building') {
      const isStand = f.type === 'grandstand' || f.type === 'bleachers';
      const circuitBuilding = (isStand || f.role === 'circuit') && nearPath(center,trackPoints,250,true);
      const h = Math.min(450,Math.max(2,f.height ?? (isStand ? 12 : 9)));
      const geometry = new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1});
      geometry.rotateX(-Math.PI/2);geometry.translate(0,base-0.3,0);
      // World-scaled facade UVs for consistent floor spacing on differently sized buildings.
      const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
      for(let i=0;i<pos.count;i++) uv.setXY(i,Math.abs(normal.getX(i))>0.5?pos.getZ(i):pos.getX(i),pos.getY(i));
      for (const part of geometry.groups) {
        const section = new THREE.BufferGeometry();
        for (const name of ['position','normal','uv']) {
          const attribute = geometry.getAttribute(name);
          section.setAttribute(name, new THREE.Float32BufferAttribute(Array.from(attribute.array).slice(part.start*attribute.itemSize,(part.start+part.count)*attribute.itemSize),attribute.itemSize));
        }
        const key = part.materialIndex===0?'roof':isStand?'stand':h>35?'glass':'stone';
        buckets[circuitBuilding ? `${key}Circuit` : key].push(section);
      }
      geometry.dispose();
      buildings++; if (f.height == null) estimated++;
    } else {
      const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
      const pos=geometry.getAttribute('position');
      const forest = f.type === 'wood' || f.type === 'forest';
      // OSM parks often contain separately mapped woodland and lakes. Keep each
      // surface at a distinct depth so overlapping polygons do not flicker.
      for(let i=0;i<pos.count;i++) pos.setY(i,f.kind==='water'?base-0.35:heightAt(pos.getX(i),pos.getZ(i))-(forest?0.45:0.5));
      geometry.computeVertexNormals();
      buckets[f.kind==='water'?'water':forest?'forest':'green'].push(geometry);
      // Trees are inferred within mapped woodland only; not claimed as individual surveyed trees.
      if(forest && treePositions.length<3500) {
        const box=new THREE.Box2().setFromPoints(pts);
        const inside=(p:THREE.Vector2,poly:THREE.Vector2[])=>{
          let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++) {const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;
        };
        const holes=(f.holes||[]).map(h=>h.map(project));
        for(let x=box.min.x+8;x<box.max.x && treePositions.length<3500;x+=22) for(let y=box.min.y+8;y<box.max.y && treePositions.length<3500;y+=22) {
          const p=new THREE.Vector2(x+Math.sin(x*2+y)*5,y+Math.cos(y*3+x)*5);
          if(inside(p,pts)&&!holes.some(h=>inside(p,h))&&!nearPath(p,trackPoints,14,true)&&!nearPath(p,pitPoints,10,false)) treePositions.push(new THREE.Vector3(p.x,heightAt(p.x,-p.y),-p.y));
        }
      }
    }
  }
  const facade = (color:number,glass:boolean) => {
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle=glass?'#7699aa':'#b4b1a4';ctx.fillRect(0,0,64,64);
    ctx.fillStyle=glass?'#314754':'#56656b';ctx.fillRect(7,8,22,38);ctx.fillRect(35,8,22,38);
    ctx.fillStyle=glass?'#afbec4':'#d0ccc0';ctx.fillRect(0,57,64,7);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(1/6,1/3.2);
    return new THREE.MeshStandardMaterial({color,map,roughness:glass?0.32:0.88,metalness:glass?0.28:0});
  };
  const wireCanvas=document.createElement('canvas');wireCanvas.width=wireCanvas.height=64;
  const wireContext=wireCanvas.getContext('2d')!;wireContext.strokeStyle='#c5ced1';wireContext.lineWidth=2;
  for(let i=-64;i<=128;i+=16){wireContext.beginPath();wireContext.moveTo(i,0);wireContext.lineTo(i+64,64);wireContext.moveTo(i,0);wireContext.lineTo(i-64,64);wireContext.stroke();}
  const wireTexture=new THREE.CanvasTexture(wireCanvas);wireTexture.colorSpace=THREE.SRGBColorSpace;wireTexture.wrapS=wireTexture.wrapT=THREE.RepeatWrapping;
  const materials:Record<string,THREE.Material>={fence:new THREE.MeshStandardMaterial({map:wireTexture,alphaTest:0.45,side:THREE.DoubleSide,roughness:0.6,metalness:0.3}),stone:facade(0xffffff,false),glass:facade(0xffffff,true),roof:new THREE.MeshStandardMaterial({color:0xb9b9b0,roughness:0.95}),barrier:new THREE.MeshStandardMaterial({color:0xa2a9ad,roughness:0.55,metalness:0.55}),stand:new THREE.MeshStandardMaterial({color:0xaab2b7,roughness:0.7}),water:new THREE.MeshPhysicalMaterial({color:0x28788d,roughness:0.2,metalness:0.25,clearcoat:1,side:THREE.DoubleSide}),green:new THREE.MeshStandardMaterial({color:0x557341,roughness:1,side:THREE.DoubleSide}),forest:new THREE.MeshStandardMaterial({color:0x354f2b,roughness:1,side:THREE.DoubleSide}),road:new THREE.MeshStandardMaterial({color:0x636461,roughness:1,side:THREE.DoubleSide})};
  const usedMaterials = new Set<string>();
  for(const [key,geometries] of Object.entries(buckets)) {
    if(!geometries.length)continue;
    const materialKey=key.replace(/Circuit$/,'');
    const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(merged){
      usedMaterials.add(materialKey);
      const mesh=new THREE.Mesh(merged,materials[materialKey]);
      mesh.castShadow=['stone','glass','stand','roof','barrier'].includes(materialKey);mesh.receiveShadow=true;
      mesh.userData.circuitDetail=key.endsWith('Circuit')||key==='barrier'||key==='fence';
      group.add(mesh);
    }
  }
  for(const [key,material] of Object.entries(materials)) if(!usedMaterials.has(key)) {
    (material as THREE.MeshStandardMaterial).map?.dispose();material.dispose();
  }
  if(treePositions.length) {
    const trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0x456234,roughness:1}),treePositions.length);
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25,0.5,7,5),new THREE.MeshStandardMaterial({color:0x62513b,roughness:1}),treePositions.length);
    const dummy=new THREE.Object3D();
    treePositions.forEach((p,i)=>{const s=3+(i%7)*0.4;dummy.position.copy(p).add(new THREE.Vector3(0,7,0));dummy.scale.set(s,s*1.4,s);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);dummy.position.copy(p).add(new THREE.Vector3(0,3,0));dummy.scale.set(1,1,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);trees.setColorAt(i,new THREE.Color().setHSL(0.25+(i%5)*0.008,0.3,0.2+(i%9)*0.009));});
    trees.castShadow=true;trees.receiveShadow=true;group.add(trees,trunks);
  }
  return {group,rms:fit.rms,buildings,estimated};
}
