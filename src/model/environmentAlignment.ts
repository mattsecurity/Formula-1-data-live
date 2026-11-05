import { resampleClosed } from './geometry';
import type { ReferencePath } from './types';

export interface EnvironmentFit {
  /** Transform local east/north metres into the reference's world coordinates. */
  project: (x: number, y: number) => [number, number];
  /** Corresponding-point RMS error in metres, independent of world scale. */
  rms: number;
  accepted: boolean;
}

const SAMPLES = 512;
const rejected = (): EnvironmentFit => ({
  project: () => [NaN, NaN],
  rms: Infinity,
  accepted: false,
});

/**
 * Align a geographic circuit outline with a telemetry lap. Vertex density,
 * start/finish placement and traversal direction may differ between sources.
 * Only rotation, translation and uniform scale are allowed: reversing the
 * traversal must never mirror the surrounding geography.
 */
export function fitEnvironment(outline: number[][], ref: ReferencePath): EnvironmentFit {
  const units = ref.unitsPerMeter;
  if (!Number.isFinite(units) || units <= 0 || outline.length < 3 || ref.x.length < 3
    || ref.x.length !== ref.y.length
    || outline.some((p) => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
    || ref.x.some((v) => !Number.isFinite(v)) || ref.y.some((v) => !Number.isFinite(v))) return rejected();

  const source = resampleClosed(outline.map((p) => p[0]), outline.map((p) => p[1]), SAMPLES);
  const target = resampleClosed(Array.from(ref.x, (v) => v / units), Array.from(ref.y, (v) => v / units), SAMPLES);
  if (source.length < 1 || target.length < 1) return rejected();

  const mean = (values: Float32Array) => values.reduce((sum, v) => sum + v, 0) / SAMPLES;
  const sx = mean(source.x), sy = mean(source.y);
  const tx = mean(target.x), ty = mean(target.y);
  const x = Float64Array.from(source.x, (v) => v - sx);
  const y = Float64Array.from(source.y, (v) => v - sy);
  const u = Float64Array.from(target.x, (v) => v - tx);
  const v = Float64Array.from(target.y, (value) => value - ty);
  let variance = 0;
  for (let i = 0; i < SAMPLES; i++) variance += x[i] ** 2 + y[i] ** 2;
  if (variance < 1) return rejected();

  // A fractional phase interpolates adjacent arc-length samples. Every shift
  // has the same centroid, so the similarity fit needs only two coefficients.
  const fit = (phase: number, direction: number) => {
    const offset = Math.floor(phase);
    const fraction = phase - offset;
    let dot = 0, cross = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const j = ((offset + direction * i) % SAMPLES + SAMPLES) % SAMPLES;
      const next = (j + 1) % SAMPLES;
      const px = u[j] + (u[next] - u[j]) * fraction;
      const py = v[j] + (v[next] - v[j]) * fraction;
      dot += x[i] * px + y[i] * py;
      cross += x[i] * py - y[i] * px;
    }
    const a = dot / variance, b = cross / variance;
    let error = 0;
    let maxError = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const j = ((offset + direction * i) % SAMPLES + SAMPLES) % SAMPLES;
      const next = (j + 1) % SAMPLES;
      const dx = a * x[i] - b * y[i] - (u[j] + (u[next] - u[j]) * fraction);
      const dy = b * x[i] + a * y[i] - (v[j] + (v[next] - v[j]) * fraction);
      const d2 = dx * dx + dy * dy;
      error += d2;
      maxError = Math.max(maxError, d2);
    }
    return { a, b, error, maxError, phase, direction };
  };

  let best = fit(0, 1);
  for (const direction of [1, -1]) {
    for (let phase = 0; phase < SAMPLES; phase++) {
      const candidate = fit(phase, direction);
      if (candidate.error < best.error) best = candidate;
    }
  }
  // The true lap offset need not fall on a resampled vertex. Refine it below
  // one metre of lap distance rather than accepting a whole-sample mismatch.
  let lo = best.phase - 1, hi = best.phase + 1;
  for (let i = 0; i < 28; i++) {
    const left = fit(lo + (hi - lo) / 3, best.direction);
    const right = fit(hi - (hi - lo) / 3, best.direction);
    if (left.error < right.error) hi = right.phase;
    else lo = left.phase;
    if (left.error < best.error) best = left;
    if (right.error < best.error) best = right;
  }

  const { a, b } = best;
  const rms = Math.sqrt(best.error / SAMPLES);
  const scale = Math.hypot(a, b);
  return {
    project: (px, py) => [
      (tx + a * (px - sx) - b * (py - sy)) * units,
      (ty + b * (px - sx) + a * (py - sy)) * units,
    ],
    rms,
    // A stale layout or poor reference should suppress scenery rather than
    // place a believable-looking town on the wrong side of the circuit.
    accepted: rms <= 25 && scale >= 0.85 && scale <= 1.15 && best.maxError <= 80 ** 2,
  };
}
