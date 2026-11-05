import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildReference } from '../src/model/geometry';
import { photogrammetryPlacement } from '../src/replay/photogrammetryPlacement';

describe('photogrammetry placement in telemetry coordinates', () => {
  it('preserves altitude and south/east handedness under rotated telemetry', () => {
    const outline = [[0,0],[150,0],[180,70],[90,130],[0,90]];
    const angle=0.7,c=Math.cos(angle),s=Math.sin(angle);
    const transform=(x:number,y:number)=>[10*(c*x-s*y)+500,10*(s*x+c*y)-800];
    const target=outline.map(p=>transform(p[0],p[1]));
    const ref=buildReference(target.map(p=>p[0]),target.map(p=>p[1]));
    ref.unitsPerMeter=10;
    const matrix=photogrammetryPlacement(outline,ref,500,-800);
    expect(matrix).not.toBeNull();
    const p=new Vector3(30,12,-50).applyMatrix4(matrix!);
    expect(p.x).toBeCloseTo(c*30-s*50,0);
    expect(p.y).toBe(12);
    expect(p.z).toBeCloseTo(-(s*30+c*50),0);
    expect(matrix!.determinant()).toBeGreaterThan(0);
  });
});
