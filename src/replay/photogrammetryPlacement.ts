import { Matrix4 } from 'three';
import { fitEnvironment } from '../model/environmentAlignment';
import type { ReferencePath } from '../model/types';

/** Align the local east/up/south survey frame with the replay's telemetry frame. */
export function photogrammetryPlacement(outline: number[][], ref: ReferencePath, cx: number, cy: number): Matrix4 | null {
  const fit = fitEnvironment(outline, ref);
  if (!fit.accepted) return null;
  const u = ref.unitsPerMeter || 10;
  const origin = fit.project(0, 0), east = fit.project(1, 0), north = fit.project(0, 1);
  return new Matrix4().set(
    (east[0]-origin[0])/u, 0, -(north[0]-origin[0])/u, (origin[0]-cx)/u,
    0, 1, 0, 0,
    -(east[1]-origin[1])/u, 0, (north[1]-origin[1])/u, -(origin[1]-cy)/u,
    0, 0, 0, 1,
  );
}
