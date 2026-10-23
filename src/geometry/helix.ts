/**
 * The corkscrew: one spiral like the USGS poster. Now is at the front of the wide top coil; the past
 * winds down into ever-tighter coils to the Big Bang at the bottom tip. Pure functions, no DOM.
 *
 * Positions along it are fractions f of the path length (0 = Now, 1 = the oldest time shown), so
 * with a linear time mapping, equal spans of time get equal lengths of ribbon: always true size.
 */

/** World coordinates, y pointing up (three.js convention). */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Helix {
  /** Number of coils from Now to the bottom tip. */
  turns: number;
  /** Radius of the top coil (Now). */
  topRadius: number;
  /** Radius at the bottom tip (the oldest time). */
  bottomRadius: number;
  /** How far below Now the bottom tip lies. */
  depth: number;
  /**
   * How much tighter the coils stack towards the bottom: 1 = evenly spaced; above 1 the drop per
   * coil shrinks, so the deep (empty) coils pack together and the top ones stay apart.
   */
  stacking: number;
  /** Ribbon width on the top coil; it narrows in step with the radius. */
  topWidth: number;
}

export interface HelixPath {
  helix: Helix;
  /** Total length of the centre line. */
  length: number;
  /** Point on the centre line at fraction f of the length (0 = Now, 1 = the tip). */
  pointAt(f: number): Point3;
  /** Inverse of `pointAt`, from the coil parameter: which fraction of the length is turn t. */
  fractionAtTurn(t: number): number;
  /** Coil parameter (0 … turns) at fraction f of the length. */
  turnAt(f: number): number;
  /** Horizontal unit vector across the ribbon at f, pointing away from the axis. */
  across(f: number): Point3;
  /** Ribbon width at f (narrows towards the tip). */
  widthAt(f: number): number;
}

function assertFraction(f: number): void {
  if (!(f >= 0 && f <= 1))
    throw new RangeError(`Position must be between 0 and 1, got ${String(f)}`);
}

function assertHelix(h: Helix): void {
  if (!(
    h.turns > 0 &&
    h.topRadius > h.bottomRadius &&
    h.bottomRadius > 0 &&
    h.depth > 0 &&
    h.stacking >= 1 &&
    h.topWidth > 0
  )) {
    throw new RangeError(
      'Helix needs turns > 0, topRadius > bottomRadius > 0, depth > 0, stacking ≥ 1 and a width',
    );
  }
}

/** Radius at coil parameter t: shrinks steadily from the top coil to the tip. */
const radiusAt = (h: Helix, t: number): number =>
  h.topRadius - ((h.topRadius - h.bottomRadius) * t) / h.turns;

/** Centre line at coil parameter t (0 = Now at the front of the top coil, turns = the tip). */
export function helixCentre(h: Helix, t: number): Point3 {
  const r = radiusAt(h, t);
  const a = 2 * Math.PI * t;
  const s = t / h.turns;
  return { x: r * Math.sin(a), y: -h.depth * (1 - (1 - s) ** h.stacking), z: r * Math.cos(a) };
}

/** Builds the corkscrew with a length table, so positions can be given as fractions of the length. */
export function createHelixPath(helix: Helix, samples = 8192): HelixPath {
  assertHelix(helix);
  const ts = new Float64Array(samples + 1);
  const lengths = new Float64Array(samples + 1);
  let previous = helixCentre(helix, 0);
  for (let i = 1; i <= samples; i++) {
    const t = (helix.turns * i) / samples;
    const p = helixCentre(helix, t);
    ts[i] = t;
    lengths[i] =
      (lengths[i - 1] ?? 0) + Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z);
    previous = p;
  }
  const total = lengths[samples] ?? 0;

  const turnAt = (f: number): number => {
    assertFraction(f);
    const target = f * total;
    let lo = 0;
    let hi = samples;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((lengths[mid] ?? 0) < target) lo = mid;
      else hi = mid;
    }
    const l0 = lengths[lo] ?? 0;
    const l1 = lengths[hi] ?? total;
    const k = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
    return (ts[lo] ?? 0) + k * ((ts[hi] ?? 0) - (ts[lo] ?? 0));
  };

  const fractionAtTurn = (t: number): number => {
    if (!(t >= 0 && t <= helix.turns))
      throw new RangeError(`Turn must be between 0 and ${String(helix.turns)}`);
    const x = (t / helix.turns) * samples;
    const i = Math.min(samples - 1, Math.floor(x));
    const l0 = lengths[i] ?? 0;
    const l1 = lengths[i + 1] ?? total;
    return (l0 + (x - i) * (l1 - l0)) / total;
  };

  const pointAt = (f: number): Point3 => helixCentre(helix, turnAt(f));

  const across = (f: number): Point3 => {
    // Outward from the axis, horizontal. (On a corkscrew the outward direction is close enough to
    // perpendicular to the direction of travel for a ribbon.)
    const p = pointAt(f);
    const r = Math.hypot(p.x, p.z) || 1;
    return { x: p.x / r, y: 0, z: p.z / r };
  };

  const widthAt = (f: number): number =>
    (helix.topWidth * radiusAt(helix, turnAt(f))) / helix.topRadius;

  return { helix, length: total, pointAt, fractionAtTurn, turnAt, across, widthAt };
}

/**
 * The corkscrew used by the app: 14 coils tightening to 6% of the top radius (Benoît, 2026-10-23:
 * "more, tighter coils"). At the whole-story view the Earth is the top ~2.7 coils and about 11 tight
 * coils wind around the Big Bang.
 */
export const CORKSCREW: Helix = {
  turns: 14,
  topRadius: 1,
  bottomRadius: 0.06,
  depth: 1.4,
  // Benoît, 2026-10-23: the deep coils (mostly the time before the Earth) stack tighter.
  stacking: 2.2,
  // Narrow enough that every coil reads as its own line, down to the Big Bang.
  topWidth: 0.045,
};
