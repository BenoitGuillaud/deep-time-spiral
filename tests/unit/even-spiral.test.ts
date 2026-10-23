import { describe, expect, it } from 'vitest';
import {
  archimedeanArcLength,
  evenSpiralLength,
  evenSpiralPoint,
  evenSpiralUnit,
  polarToCartesian,
  type EvenSpiral,
} from '../../src/geometry/spiral';

const spiral: EvenSpiral = { turns: 4, outerRadius: 300 };
const SAMPLES = Array.from({ length: 201 }, (_, i) => i / 200);

/** Path length measured the slow way: many short straight steps. */
function measuredLength(u0: number, u1: number, steps = 4000): number {
  let total = 0;
  let previous = polarToCartesian(evenSpiralPoint(u0, spiral));
  for (let i = 1; i <= steps; i++) {
    const p = polarToCartesian(evenSpiralPoint(u0 + ((u1 - u0) * i) / steps, spiral));
    total += Math.hypot(p.x - previous.x, p.y - previous.y);
    previous = p;
  }
  return total;
}

describe('even spiral (constant speed along the path)', () => {
  it('matches the closed-form arc length against a step-by-step measurement', () => {
    expect(measuredLength(0, 1)).toBeCloseTo(evenSpiralLength(spiral), 0);
    expect(archimedeanArcLength(0, 1)).toBe(0);
  });

  it('gives equal path lengths to equal spans of u (equal time ⇒ equal length)', () => {
    const total = evenSpiralLength(spiral);
    for (const [a, b] of [
      [0, 0.1],
      [0.45, 0.55],
      [0.9, 1],
    ] as const) {
      expect(measuredLength(a, b) / total).toBeCloseTo(b - a, 3);
    }
  });

  it('starts at the centre and ends at the outer radius after the given turns', () => {
    expect(evenSpiralPoint(0, spiral)).toEqual({ theta: 0, r: 0 });
    const end = evenSpiralPoint(1, spiral);
    expect(end.theta).toBeCloseTo(spiral.turns * 2 * Math.PI, 9);
    expect(end.r).toBeCloseTo(spiral.outerRadius, 9);
  });

  it('is strictly increasing in angle and radius', () => {
    const points = SAMPLES.map((u) => evenSpiralPoint(u, spiral));
    points.slice(1).forEach((p, i) => {
      expect(p.theta).toBeGreaterThan(points[i]?.theta ?? Number.NaN);
      expect(p.r).toBeGreaterThan(points[i]?.r ?? Number.NaN);
    });
  });

  it('is invertible', () => {
    for (const u of SAMPLES) {
      expect(evenSpiralUnit(evenSpiralPoint(u, spiral), spiral)).toBeCloseTo(u, 9);
    }
  });

  it('rejects positions and shapes out of range', () => {
    expect(() => evenSpiralPoint(1.5, spiral)).toThrow(RangeError);
    expect(() => evenSpiralPoint(0.5, { turns: 0, outerRadius: 1 })).toThrow(RangeError);
  });
});
