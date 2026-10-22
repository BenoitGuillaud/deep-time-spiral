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

/**
 * An Archimedean spiral r = bθ walked at constant speed: position u is the fraction of the path
 * length from the centre. With a linear time mapping, equal spans of time get equal path lengths,
 * so a finger tracing the spiral feels the true proportions.
 */
export interface EvenSpiral {
  turns: number;
  outerRadius: number;
}

/** Path length of r = bθ from the centre out to angle θ (closed form). */
export function archimedeanArcLength(theta: number, b: number): number {
  return (b / 2) * (theta * Math.sqrt(1 + theta * theta) + Math.asinh(theta));
}

function evenSpiralParams(spiral: EvenSpiral): { b: number; thetaMax: number; length: number } {
  if (!(spiral.turns > 0 && spiral.outerRadius > 0)) {
    throw new RangeError('Spiral needs turns > 0 and outerRadius > 0');
  }
  const thetaMax = spiral.turns * 2 * Math.PI;
  const b = spiral.outerRadius / thetaMax;
  return { b, thetaMax, length: archimedeanArcLength(thetaMax, b) };
}

/** Total path length of the spiral, in the same units as its radius. */
export function evenSpiralLength(spiral: EvenSpiral): number {
  return evenSpiralParams(spiral).length;
}

/** Position u (fraction of the path length from the centre) → polar point. */
export function evenSpiralPoint(u: number, spiral: EvenSpiral): PolarPoint {
  assertUnit(u);
  const { b, thetaMax, length } = evenSpiralParams(spiral);
  const target = u * length;
  // Newton's method on s(θ) = target, with s'(θ) = b√(1 + θ²); s is convex, so starting from the
  // small-angle approximation s ≈ bθ²/2 it converges in a few steps.
  let theta = Math.min(Math.sqrt((2 * target) / b), thetaMax);
  for (let i = 0; i < 30; i++) {
    const step = (archimedeanArcLength(theta, b) - target) / (b * Math.sqrt(1 + theta * theta));
    theta = Math.min(Math.max(theta - step, 0), thetaMax);
    if (Math.abs(step) < 1e-12) break;
  }
  return { theta, r: b * theta };
}

/** Inverse of `evenSpiralPoint`. */
export function evenSpiralUnit(point: PolarPoint, spiral: EvenSpiral): number {
  const { b, length } = evenSpiralParams(spiral);
  const u = archimedeanArcLength(point.theta, b) / length;
  assertUnit(u);
  return u;
}
