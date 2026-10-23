import { describe, expect, it } from 'vitest';
import { evenSpiralPoint, polarToCartesian } from '../../src/geometry/spiral';
import { vortexAcross, vortexPoint, vortexUnit, type Vortex } from '../../src/geometry/vortex';

const vortex: Vortex = { turns: 3.75, outerRadius: 1, depth: 1.2 };
const SAMPLES = Array.from({ length: 201 }, (_, i) => i / 200);

describe('vortex (3D spiral, depth ∝ time)', () => {
  it('starts at the summit and ends at the bottom rim', () => {
    const summit = vortexPoint(0, vortex);
    for (const value of [summit.x, summit.y, summit.z]) expect(value).toBeCloseTo(0, 12);
    const end = vortexPoint(1, vortex);
    expect(end.y).toBeCloseTo(-vortex.depth, 12);
    expect(Math.hypot(end.x, end.z)).toBeCloseTo(vortex.outerRadius, 9);
  });

  it('seen from above, is exactly the honest flat spiral', () => {
    for (const u of SAMPLES) {
      const flat = polarToCartesian(evenSpiralPoint(u, vortex));
      const p = vortexPoint(u, vortex);
      expect(p.x).toBeCloseTo(flat.x, 12);
      expect(p.z).toBeCloseTo(flat.y, 12);
    }
  });

  it('seen from the side, is a linear timeline: equal time, equal drop', () => {
    const drops = SAMPLES.slice(1).map(
      (u, i) => vortexPoint(SAMPLES[i] ?? 0, vortex).y - vortexPoint(u, vortex).y,
    );
    for (const drop of drops) expect(drop).toBeCloseTo(vortex.depth / 200, 12);
  });

  it('is strictly deeper and wider as time goes back', () => {
    const points = SAMPLES.map((u) => vortexPoint(u, vortex));
    points.slice(1).forEach((p, i) => {
      const previous = points[i];
      expect(p.y).toBeLessThan(previous?.y ?? Number.NaN);
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(Math.hypot(previous?.x ?? 0, previous?.z ?? 0));
    });
  });

  it('is invertible', () => {
    for (const u of SAMPLES) expect(vortexUnit(vortexPoint(u, vortex), vortex)).toBeCloseTo(u, 12);
    expect(() => vortexUnit({ x: 0, y: 1, z: 0 }, vortex)).toThrow(RangeError);
  });

  it('gives a horizontal unit vector across the ribbon, pointing away from the axis', () => {
    for (const u of SAMPLES.slice(20)) {
      const across = vortexAcross(u, vortex);
      const p = vortexPoint(u, vortex);
      expect(across.y).toBe(0);
      expect(Math.hypot(across.x, across.z)).toBeCloseTo(1, 9);
      expect(across.x * p.x + across.z * p.z).toBeGreaterThan(0);
    }
  });

  it('rejects a flat or broken depth', () => {
    expect(() => vortexPoint(0.5, { ...vortex, depth: 0 })).toThrow(RangeError);
  });
});
