import { evenSpiralPoint, polarToCartesian, type EvenSpiral } from './spiral';

/**
 * The 3D vortex: the even-speed spiral in the horizontal plane, plus depth proportional to time.
 * Now is at the top centre; older times are further out and deeper, like rock layers.
 *
 * Seen from straight above it is exactly the honest flat spiral (equal time = equal path length);
 * seen from the side, height is a linear timeline.
 */
export interface Vortex extends EvenSpiral {
  /** How far below the summit (Now) the outer end (the oldest time) lies. */
  depth: number;
}

/** World coordinates, y pointing up (three.js convention). */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

function assertDepth(vortex: Vortex): void {
  if (!(vortex.depth > 0 && Number.isFinite(vortex.depth))) {
    throw new RangeError('Vortex depth must be a positive number');
  }
}

/** Position u (fraction of the time span, 0 = Now) → point on the vortex, relative to its summit. */
export function vortexPoint(u: number, vortex: Vortex): Point3 {
  assertDepth(vortex);
  const flat = polarToCartesian(evenSpiralPoint(u, vortex));
  // The flat spiral's screen "down" (y) becomes the world's "towards the viewer" (z).
  return { x: flat.x, y: -vortex.depth * u, z: flat.y };
}

/** Inverse of `vortexPoint`: the height alone tells the time. */
export function vortexUnit(point: Point3, vortex: Vortex): number {
  assertDepth(vortex);
  const u = -point.y / vortex.depth;
  if (!(u >= 0 && u <= 1)) throw new RangeError(`Point is not on the vortex (u = ${String(u)})`);
  return u;
}

/**
 * Unit vector across the ribbon at position u: horizontal and perpendicular to the direction of
 * travel, pointing away from the axis. Used to give the ribbon its width.
 */
export function vortexAcross(u: number, vortex: Vortex): Point3 {
  const step = 1e-4;
  const a = vortexPoint(Math.max(0, u - step), vortex);
  const b = vortexPoint(Math.min(1, u + step), vortex);
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  const length = Math.hypot(tx, tz) || 1;
  // One of the two horizontal perpendiculars to the direction of travel; flip it to face outward.
  const p = vortexPoint(u, vortex);
  const sign = -tz * p.x + tx * p.z < 0 ? -1 : 1;
  return { x: (sign * -tz) / length, y: 0, z: (sign * tx) / length };
}
