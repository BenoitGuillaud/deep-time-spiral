import type { HelixPath } from '../geometry/helix';

/**
 * Vertex data for one stretch of the corkscrew ribbon (from f0 to f1): a flat ramp whose width
 * narrows with the coils. Pure (no three.js) so it can be unit-tested.
 *
 * Each sample has 8 vertices (two per face: top, bottom, outer side, inner side) so every face gets
 * its own flat normal. Triangles are ordered from f0 to f1, so drawing the first N indices reveals
 * the ribbon from Now towards the past.
 */
export interface RibbonArrays {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Index count per stretch between two samples. */
  indicesPerStep: number;
}

const FACES = 4;

export interface RibbonOptions {
  /** Width multiplier (e.g. a wider, faint copy for a glow). */
  widthScale?: number;
  /** Thickness as a share of the width. */
  thickness?: number;
  /** Target spacing between samples along the path, in world units. */
  spacing?: number;
}

export function helixRibbon(
  path: HelixPath,
  f0: number,
  f1: number,
  { widthScale = 1, thickness = 0.2, spacing = 0.012 }: RibbonOptions = {},
): RibbonArrays {
  const steps = Math.max(1, Math.ceil(((f1 - f0) * path.length) / spacing));
  const samples = steps + 1;
  const positions = new Float32Array(samples * FACES * 2 * 3);
  const normals = new Float32Array(samples * FACES * 2 * 3);
  const uvs = new Float32Array(samples * FACES * 2 * 2);
  const texScale = path.helix.topWidth;

  for (let i = 0; i < samples; i++) {
    // Clamp: adding up fractions can overshoot f1 by a rounding error.
    const f = Math.min(f1, f0 + ((f1 - f0) * i) / steps);
    const c = path.pointAt(f);
    const a = path.across(f);
    const w = (path.widthAt(f) * widthScale) / 2;
    const h = (path.widthAt(f) * thickness) / 2;
    const corner = (side: number, up: number): [number, number, number] => [
      c.x + side * w * a.x,
      c.y + up * h,
      c.z + side * w * a.z,
    ];
    // Per face: [first corner, second corner, normal]
    const faces: [[number, number, number], [number, number, number], [number, number, number]][] =
      [
        [corner(-1, 1), corner(1, 1), [0, 1, 0]], // top
        [corner(-1, -1), corner(1, -1), [0, -1, 0]], // bottom
        [corner(1, 1), corner(1, -1), [a.x, 0, a.z]], // outer side
        [corner(-1, 1), corner(-1, -1), [-a.x, 0, -a.z]], // inner side
      ];
    const along = (f * path.length) / texScale;
    faces.forEach(([p, q, n], k) => {
      const v = (i * FACES + k) * 2;
      positions.set([...p, ...q], v * 3);
      normals.set([...n, ...n], v * 3);
      uvs.set([along, 0, along, 1], v * 2);
    });
  }

  const indicesPerStep = FACES * 6;
  const indices = new Uint32Array(steps * indicesPerStep);
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < FACES; k++) {
      const a = (i * FACES + k) * 2;
      const b = ((i + 1) * FACES + k) * 2;
      // Counter-clockwise seen from where each face's normal points (top and outer side are
      // listed outer-first), so the renderer never culls a face that should show.
      const triangles =
        k === 0 || k === 2 ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1];
      indices.set(triangles, i * indicesPerStep + k * 6);
    }
  }
  return { positions, normals, uvs, indices, indicesPerStep };
}
