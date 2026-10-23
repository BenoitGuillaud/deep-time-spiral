import { evenSpiralLength } from '../geometry/spiral';
import { vortexAcross, vortexPoint, type Vortex } from '../geometry/vortex';

/**
 * Vertex data for one stretch of the vortex ribbon: a flat ramp of given width and thickness, so the
 * top view looks exactly like the 2D ribbon. Pure (no three.js) so it can be unit-tested.
 *
 * Each sample has 8 vertices (two per face: top, bottom, outer side, inner side) so every face gets
 * its own flat normal. Triangles are ordered from u0 to u1, so drawing the first N indices reveals
 * the ribbon from Now outward.
 */
export interface RibbonArrays {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Index count per stretch between two samples, for animating the draw range. */
  indicesPerStep: number;
}

const FACES = 4;

export function ribbonArrays(
  vortex: Vortex,
  u0: number,
  u1: number,
  width: number,
  thickness: number,
  /** Target spacing between samples along the path, in world units. */
  spacing = 0.01,
): RibbonArrays {
  const steps = Math.max(1, Math.ceil(((u1 - u0) * evenSpiralLength(vortex)) / spacing));
  const samples = steps + 1;
  const positions = new Float32Array(samples * FACES * 2 * 3);
  const normals = new Float32Array(samples * FACES * 2 * 3);
  const uvs = new Float32Array(samples * FACES * 2 * 2);
  let travelled = 0;
  let previous = vortexPoint(u0, vortex);

  for (let i = 0; i < samples; i++) {
    // Clamp: adding up fractions can overshoot u1 by a rounding error.
    const u = Math.min(u1, u0 + ((u1 - u0) * i) / steps);
    const c = vortexPoint(u, vortex);
    const a = vortexAcross(u, vortex);
    travelled += Math.hypot(c.x - previous.x, c.y - previous.y, c.z - previous.z);
    previous = c;
    const w = width / 2;
    const h = thickness / 2;
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
    faces.forEach(([p, q, n], f) => {
      const v = (i * FACES + f) * 2;
      positions.set([...p, ...q], v * 3);
      normals.set([...n, ...n], v * 3);
      uvs.set([travelled / width, 0, travelled / width, 1], v * 2);
    });
  }

  const indicesPerStep = FACES * 6;
  const indices = new Uint32Array(steps * indicesPerStep);
  for (let i = 0; i < steps; i++) {
    for (let f = 0; f < FACES; f++) {
      const a = (i * FACES + f) * 2;
      const b = ((i + 1) * FACES + f) * 2;
      indices.set([a, b, a + 1, a + 1, b, b + 1], i * indicesPerStep + f * 6);
    }
  }
  return { positions, normals, uvs, indices, indicesPerStep };
}
