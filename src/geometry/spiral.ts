/**
 * Time → spiral geometry. Pure functions only (no DOM), so they can be unit-tested.
 *
 * A position along the spiral is a unit `u` in [0, 1]: 0 is Now (the centre) and 1 is the oldest
 * time shown (the outer end). A `TimeMapping` turns ages into units and back; a `SpiralShape`
 * turns units into polar and screen coordinates.
 */

export interface TimeMapping {
  /** Age in years before present → position along the spiral, 0 (Now) … 1 (oldest). */
  toUnit(ageYears: number): number;
  /** Inverse of `toUnit`. */
  fromUnit(u: number): number;
}

export interface SpiralShape {
  /** Number of full turns from the centre to the outer end. */
  turns: number;
  /** Radius at u = 0 (Now). */
  innerRadius: number;
  /** Radius at u = 1 (the oldest time shown). */
  outerRadius: number;
}

export interface PolarPoint {
  /** Angle in radians, measured clockwise from 12 o'clock. */
  theta: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

function assertUnit(u: number): void {
  if (!(u >= 0 && u <= 1)) {
    throw new RangeError(`Spiral position must be between 0 and 1, got ${String(u)}`);
  }
}

function assertShape({ turns, innerRadius, outerRadius }: SpiralShape): void {
  if (!(turns > 0 && innerRadius >= 0 && outerRadius > innerRadius)) {
    throw new RangeError('Spiral needs turns > 0 and 0 ≤ innerRadius < outerRadius');
  }
}

/** Linear (honest) scale: position along the spiral is proportional to age. */
export function linearMapping(maxAgeYears: number): TimeMapping {
  if (!(maxAgeYears > 0 && Number.isFinite(maxAgeYears))) {
    throw new RangeError(`Maximum age must be a positive number, got ${String(maxAgeYears)}`);
  }
  return {
    toUnit(ageYears) {
      if (!(ageYears >= 0 && ageYears <= maxAgeYears)) {
        throw new RangeError(
          `Age must be between 0 and ${String(maxAgeYears)}, got ${String(ageYears)}`,
        );
      }
      return ageYears / maxAgeYears;
    },
    fromUnit(u) {
      assertUnit(u);
      return u * maxAgeYears;
    },
  };
}

/**
 * Archimedean spiral: angle and radius both grow linearly from Now (centre) to the oldest time
 * (outer end). Equal spans of time get equal turning angles; equal path lengths are an M2 question.
 */
export function unitToPolar(u: number, shape: SpiralShape): PolarPoint {
  assertUnit(u);
  assertShape(shape);
  return {
    theta: u * shape.turns * 2 * Math.PI,
    r: shape.innerRadius + u * (shape.outerRadius - shape.innerRadius),
  };
}

/** Inverse of `unitToPolar`. The angle alone fixes the position, because it keeps growing past 2π. */
export function polarToUnit(point: PolarPoint, shape: SpiralShape): number {
  assertShape(shape);
  const u = point.theta / (shape.turns * 2 * Math.PI);
  assertUnit(u);
  return u;
}

/** Screen coordinates (y points down) around an origin at the centre of the spiral. */
export function polarToCartesian({ theta, r }: PolarPoint): Point {
  return { x: r * Math.sin(theta), y: -r * Math.cos(theta) };
}
