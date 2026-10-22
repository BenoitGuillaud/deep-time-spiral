import { describe, expect, it } from 'vitest';
import {
  linearMapping,
  polarToCartesian,
  polarToUnit,
  unitToPolar,
  type SpiralShape,
} from '../../src/geometry/spiral';

const SAMPLES = Array.from({ length: 101 }, (_, i) => i / 100);
const shape: SpiralShape = { turns: 4, innerRadius: 10, outerRadius: 400 };

describe('linearMapping', () => {
  const maxAge = 13.8e9;
  const mapping = linearMapping(maxAge);

  it('maps Now to 0 and the maximum age to 1', () => {
    expect(mapping.toUnit(0)).toBe(0);
    expect(mapping.toUnit(maxAge)).toBe(1);
  });

  it('is strictly increasing', () => {
    const units = SAMPLES.map((s) => mapping.toUnit(s * maxAge));
    units.slice(1).forEach((u, i) => {
      expect(u).toBeGreaterThan(units[i] ?? Number.NaN);
    });
  });

  it('is invertible', () => {
    for (const s of SAMPLES) {
      const age = s * maxAge;
      expect(mapping.fromUnit(mapping.toUnit(age))).toBeCloseTo(age, 0);
      expect(mapping.toUnit(mapping.fromUnit(s))).toBeCloseTo(s, 12);
    }
  });

  it('rejects ages and positions out of range', () => {
    expect(() => mapping.toUnit(-1)).toThrow(RangeError);
    expect(() => mapping.toUnit(maxAge * 1.01)).toThrow(RangeError);
    expect(() => mapping.toUnit(Number.NaN)).toThrow(RangeError);
    expect(() => mapping.fromUnit(1.01)).toThrow(RangeError);
    expect(() => linearMapping(0)).toThrow(RangeError);
    expect(() => linearMapping(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('unitToPolar / polarToUnit', () => {
  it('puts Now at the centre and the oldest time at the outer end', () => {
    expect(unitToPolar(0, shape)).toEqual({ theta: 0, r: shape.innerRadius });
    const end = unitToPolar(1, shape);
    expect(end.theta).toBeCloseTo(shape.turns * 2 * Math.PI, 12);
    expect(end.r).toBeCloseTo(shape.outerRadius, 12);
  });

  it('grows angle and radius strictly as time goes back', () => {
    const points = SAMPLES.map((u) => unitToPolar(u, shape));
    points.slice(1).forEach((p, i) => {
      const previous = points[i];
      expect(p.theta).toBeGreaterThan(previous?.theta ?? Number.NaN);
      expect(p.r).toBeGreaterThan(previous?.r ?? Number.NaN);
    });
  });

  it('is invertible', () => {
    for (const u of SAMPLES) {
      expect(polarToUnit(unitToPolar(u, shape), shape)).toBeCloseTo(u, 12);
    }
  });

  it('rejects positions and shapes out of range', () => {
    expect(() => unitToPolar(-0.01, shape)).toThrow(RangeError);
    expect(() => polarToUnit({ theta: -1, r: 0 }, shape)).toThrow(RangeError);
    expect(() => unitToPolar(0.5, { ...shape, turns: 0 })).toThrow(RangeError);
    expect(() => unitToPolar(0.5, { ...shape, outerRadius: shape.innerRadius })).toThrow(
      RangeError,
    );
  });
});

describe('polarToCartesian', () => {
  it('starts at 12 o’clock and turns clockwise on screen', () => {
    const top = polarToCartesian({ theta: 0, r: 5 });
    expect(top.x).toBeCloseTo(0, 12);
    expect(top.y).toBeCloseTo(-5, 12);
    const right = polarToCartesian({ theta: Math.PI / 2, r: 5 });
    expect(right.x).toBeCloseTo(5, 12);
    expect(right.y).toBeCloseTo(0, 12);
  });

  it('keeps the distance from the centre equal to r', () => {
    for (const u of SAMPLES) {
      const polar = unitToPolar(u, shape);
      const { x, y } = polarToCartesian(polar);
      expect(Math.hypot(x, y)).toBeCloseTo(polar.r, 9);
    }
  });
});
