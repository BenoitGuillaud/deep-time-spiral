import { describe, expect, it } from 'vitest';
import { CORKSCREW, createHelixPath, helixCentre, type Point3 } from '../../src/geometry/helix';

const path = createHelixPath(CORKSCREW);
const SAMPLES = Array.from({ length: 201 }, (_, i) => i / 200);
const dist = (a: Point3, b: Point3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Path length measured the slow way, with many short straight steps. */
function measured(f0: number, f1: number, steps = 4000): number {
  let total = 0;
  let previous = path.pointAt(f0);
  for (let i = 1; i <= steps; i++) {
    const p = path.pointAt(f0 + ((f1 - f0) * i) / steps);
    total += dist(p, previous);
    previous = p;
  }
  return total;
}

describe('the corkscrew', () => {
  it('puts Now at the front of the wide top coil and the Big Bang at the narrow bottom tip', () => {
    const now = path.pointAt(0);
    expect(now).toEqual({ x: 0, y: -0, z: CORKSCREW.topRadius });
    const tip = path.pointAt(1);
    expect(tip.y).toBeCloseTo(-CORKSCREW.depth, 9);
    expect(Math.hypot(tip.x, tip.z)).toBeCloseTo(CORKSCREW.bottomRadius, 9);
  });

  it('is always true size: equal fractions get equal lengths of ribbon', () => {
    for (const [a, b] of [
      [0, 0.05],
      [0.45, 0.5],
      [0.95, 1],
    ] as const) {
      expect(measured(a, b) / path.length).toBeCloseTo(b - a, 4);
    }
  });

  it('goes down and tightens as time goes back', () => {
    const points = SAMPLES.map((f) => path.pointAt(f));
    points.slice(1).forEach((p, i) => {
      const previous = points[i];
      if (!previous) return;
      expect(p.y).toBeLessThan(previous.y);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(Math.hypot(previous.x, previous.z));
      expect(path.widthAt(SAMPLES[i + 1] ?? 1)).toBeLessThan(path.widthAt(SAMPLES[i] ?? 0));
    });
  });

  it('is invertible between length fractions and coil turns', () => {
    for (const f of SAMPLES) {
      expect(path.fractionAtTurn(path.turnAt(f))).toBeCloseTo(f, 9);
      expect(dist(path.pointAt(f), helixCentre(CORKSCREW, path.turnAt(f)))).toBeLessThan(1e-12);
    }
  });

  it('winds the given number of coils, so the old times get many tight coils', () => {
    expect(path.turnAt(1)).toBeCloseTo(CORKSCREW.turns, 9);
    // The top coil is the longest: much more than one tenth of the whole length.
    expect(path.fractionAtTurn(1)).toBeGreaterThan(0.15);
  });

  it('gives a horizontal unit vector across the ribbon, pointing away from the axis', () => {
    for (const f of SAMPLES) {
      const a = path.across(f);
      const p = path.pointAt(f);
      expect(a.y).toBe(0);
      expect(Math.hypot(a.x, a.z)).toBeCloseTo(1, 9);
      expect(a.x * p.x + a.z * p.z).toBeGreaterThan(0);
    }
  });

  it('rejects positions and shapes out of range', () => {
    expect(() => path.pointAt(1.01)).toThrow(RangeError);
    expect(() => createHelixPath({ ...CORKSCREW, bottomRadius: 2 })).toThrow(RangeError);
  });
});
