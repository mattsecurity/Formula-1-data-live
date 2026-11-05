import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fitEnvironment } from '../src/model/environmentAlignment';
import { buildReference, cumulative } from '../src/model/geometry';
import { DemoSource, DEMO_RACE_KEY } from '../src/api/demo';
import { loadSession } from '../src/model/loadSession';
import monza from '../public/environments/it-1922.json';
import { circuitById } from '../src/data/circuits';

// An asymmetric circuit with intentionally uneven spacing and a repeated end.
const outline = [
  [0, 0], [900, 0], [1000, 100], [950, 450], [700, 600],
  [620, 420], [590, 400], [350, 750], [-100, 500], [-50, 50], [0, 0],
];
const angle = 1.17;
const units = 9.8;
const transform = (p: number[], scale = 1) => [
  12345 + units * scale * (Math.cos(angle) * p[0] - Math.sin(angle) * p[1]),
  -9876 + units * scale * (Math.sin(angle) * p[0] + Math.cos(angle) * p[1]),
];

function reference(points: number[][], scale = 1) {
  const transformed = points.map((p) => transform(p, scale));
  const ref = buildReference(transformed.map((p) => p[0]), transformed.map((p) => p[1]));
  // Retain original segments to test actual unequal vertex density; the real
  // reference builder's smoothing is separately covered by the demo test.
  ref.x = Float32Array.from(transformed, (p) => p[0]);
  ref.y = Float32Array.from(transformed, (p) => p[1]);
  Object.assign(ref, cumulative(ref.x, ref.y));
  ref.unitsPerMeter = units;
  ref.lengthM = ref.length / units;
  return ref;
}

describe('geographic environment alignment', () => {
  it.each([false, true])('fits rotation, translation and shifted start (reverse=%s)', (reverse) => {
    const path = outline.slice(0, -1);
    // This start falls partway down a segment and at a fractional sample phase.
    path.splice(1, 0, [173.65, 0], [177, 0], [333, 0]);
    const shifted = [...path.slice(1), ...path.slice(0, 1)];
    if (reverse) shifted.reverse();
    const result = fitEnvironment(outline, reference(shifted));
    expect(result.accepted).toBe(true);
    expect(result.rms).toBeLessThan(1);
    for (const point of [...outline, [1200, -1000]]) {
      const actual = result.project(point[0], point[1]);
      const expected = transform(point);
      expect(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) / units).toBeLessThan(0.5);
    }
  });

  it('accepts small racing-line deviations', () => {
    const line = outline.map(([x, y], i) => [x + 3 * Math.sin(i), y + 4 * Math.cos(i)]);
    const result = fitEnvironment(outline, reference(line));
    expect(result.accepted).toBe(true);
    expect(result.rms).toBeLessThan(10);
  });

  it('rejects a different layout even when it can be scaled and rotated', () => {
    const wrong = outline.map(([x, y]) => [x, y * 0.55]);
    expect(fitEnvironment(outline, reference(wrong)).accepted).toBe(false);
  });

  it('does not mistake a mirrored track for reversed traversal', () => {
    const mirrored = outline.map(([x, y]) => [-x, y]);
    expect(fitEnvironment(outline, reference(mirrored)).accepted).toBe(false);
  });

  it('rejects implausible physical scale despite a close shape match', () => {
    const result = fitEnvironment(outline, reference(outline, 1.5));
    expect(result.rms).toBeLessThan(1);
    expect(result.accepted).toBe(false);
  });

  it('rejects invalid and degenerate coordinates', () => {
    const ref = reference(outline);
    for (const invalid of [[], [[0, 0]], [[1, 1], [1, 1], [1, 1]], [[0, 0], [1, NaN], [2, 3]]]) {
      expect(fitEnvironment(invalid, ref).accepted).toBe(false);
    }
    expect(fitEnvironment(outline, { ...ref, unitsPerMeter: 0 }).accepted).toBe(false);
  });

  it('fits the bundled Monza geography to the complete demo telemetry pipeline', async () => {
    const session = await loadSession(new DemoSource(), DEMO_RACE_KEY);
    const result = fitEnvironment(monza.outline, session.ref);
    expect(result.accepted).toBe(true);
    expect(result.rms).toBeLessThan(25);
  });
});

describe('downloaded geographic outlines', () => {
  const directory = fileURLToPath(new URL('../public/environments/', import.meta.url));
  const files = readdirSync(directory).filter((file) => file.endsWith('.json')).sort();
  it.each(files)('%s agrees with its bundled circuit layout', (file) => {
    const environment = JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')) as {
      circuitId: string; outline: number[][];
    };
    const circuit = circuitById(environment.circuitId);
    expect(circuit, `Missing circuit for ${file}`).toBeDefined();
    const ref = buildReference(
      circuit!.pts.filter((_, i) => i % 2 === 0),
      circuit!.pts.filter((_, i) => i % 2 === 1),
    );
    ref.unitsPerMeter = 1;
    ref.lengthM = ref.length;
    const result = fitEnvironment(environment.outline, ref);
    expect(result.accepted, `Layout mismatch: RMS ${result.rms.toFixed(2)} m`).toBe(true);
    expect(result.rms).toBeLessThan(10);
  });
});
