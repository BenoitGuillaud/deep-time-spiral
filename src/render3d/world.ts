import { vortexPoint, type Point3, type Vortex } from '../geometry/vortex';

/** Where the main vortex and the zoom-lens vortex sit in the 3D world. Pure, so it can be tested. */

export interface Placement {
  vortex: Vortex;
  /** World position of the summit (Now). */
  origin: Point3;
  /** Ribbon width and thickness, in world units. */
  ribbon: { width: number; thickness: number };
}

export interface World {
  landscape: boolean;
  main: Placement;
  lens: Placement;
  /** A sphere that holds both vortices. */
  bounds: { center: Point3; radius: number };
  /** Points along both vortices and around the lens rim, for framing the camera tightly. */
  outline: Point3[];
}

/** Radius and height of the glass ring around the lens (it carries the zoom badge and caption). */
export function lensRing(lens: Placement): { radius: number; y: number } {
  return {
    radius: lens.vortex.outerRadius + lens.ribbon.width / 2 + 0.06,
    y: lens.origin.y - lens.vortex.depth * 0.45,
  };
}

function ribbonFor(vortex: Vortex, share: number): Placement['ribbon'] {
  const spacing = vortex.outerRadius / vortex.turns;
  return { width: share * spacing, thickness: 0.22 * share * spacing };
}

/** Lays out the scene for a screen aspect ratio (width / height). */
export function computeWorld(aspect: number): World {
  const landscape = aspect >= 1.1;
  const mainVortex: Vortex = { turns: 3.75, outerRadius: 1, depth: 1.1 };
  // On a tall phone the lens gets more room: it holds most of the pictures (the dinosaurs!).
  const lensVortex: Vortex = { turns: 2.25, outerRadius: landscape ? 0.9 : 1.05, depth: 0.6 };
  const main: Placement = {
    vortex: mainVortex,
    origin: { x: 0, y: 0, z: 0 },
    ribbon: ribbonFor(mainVortex, 0.48),
  };
  // Matching the 2D layout seen from above: landscape puts the lens to the right; portrait puts it
  // above (further back, and raised so its light beam passes over the main vortex).
  const lens: Placement = {
    vortex: lensVortex,
    origin: landscape ? { x: 2.4, y: 0.1, z: 0 } : { x: 0, y: 0.75, z: -2.2 },
    ribbon: ribbonFor(lensVortex, 0.5),
  };

  // Bounding box of both vortices (each spans its radius around the axis, and its depth below).
  const boxes = [main, lens].map(({ vortex, origin }) => ({
    min: {
      x: origin.x - vortex.outerRadius,
      y: origin.y - vortex.depth,
      z: origin.z - vortex.outerRadius,
    },
    max: { x: origin.x + vortex.outerRadius, y: origin.y, z: origin.z + vortex.outerRadius },
  }));
  const min = {
    x: Math.min(...boxes.map((b) => b.min.x)),
    y: Math.min(...boxes.map((b) => b.min.y)),
    z: Math.min(...boxes.map((b) => b.min.z)),
  };
  const max = {
    x: Math.max(...boxes.map((b) => b.max.x)),
    y: Math.max(...boxes.map((b) => b.max.y)),
    z: Math.max(...boxes.map((b) => b.max.z)),
  };
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const radius = Math.hypot(max.x - center.x, max.y - center.y, max.z - center.z);
  const outline: Point3[] = [];
  for (const placement of [main, lens]) {
    for (let i = 0; i <= 160; i++)
      outline.push(placed(placement, vortexPoint(i / 160, placement.vortex)));
  }
  const ring = lensRing(lens);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    outline.push({
      x: lens.origin.x + ring.radius * Math.cos(a),
      y: ring.y,
      z: lens.origin.z + ring.radius * Math.sin(a),
    });
  }
  return { landscape, main, lens, bounds: { center, radius }, outline };
}

/** World position of the point at fraction u on a placed vortex. */
export function placed(placement: Placement, point: Point3): Point3 {
  return {
    x: placement.origin.x + point.x,
    y: placement.origin.y + point.y,
    z: placement.origin.z + point.z,
  };
}
