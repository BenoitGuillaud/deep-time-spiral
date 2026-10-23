import { describe, expect, it } from 'vitest';
import { vortexPoint } from '../../src/geometry/vortex';
import {
  easeInOutCubic,
  eventPose,
  fitDistance,
  framePose,
  flightPose,
  orbit,
  presetPose,
} from '../../src/render3d/camera';
import { ribbonArrays } from '../../src/render3d/ribbon-geometry';
import { computeWorld } from '../../src/render3d/world';

const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('computeWorld', () => {
  it.each([
    ['landscape', 1180 / 820],
    ['portrait', 390 / 844],
  ])('%s: the two vortices never overlap and both fit the bounding sphere', (_, aspect) => {
    const { main, lens, bounds, landscape } = computeWorld(aspect);
    expect(landscape).toBe(aspect >= 1.1);
    // Seen from above, the two discs are apart: the axes are further apart than the two radii.
    const axes = Math.hypot(lens.origin.x - main.origin.x, lens.origin.z - main.origin.z);
    expect(axes).toBeGreaterThan(main.vortex.outerRadius + lens.vortex.outerRadius);
    // Landscape: lens to the right. Portrait: lens above on screen (further back) and raised.
    if (landscape) expect(lens.origin.x).toBeGreaterThan(main.origin.x);
    else expect(lens.origin.z).toBeLessThan(main.origin.z);
    for (const { vortex, origin } of [main, lens]) {
      for (const u of [0, 0.5, 1]) {
        const p = vortexPoint(u, vortex);
        const world = { x: origin.x + p.x, y: origin.y + p.y, z: origin.z + p.z };
        expect(distance(world, bounds.center)).toBeLessThanOrEqual(bounds.radius + 1e-9);
      }
    }
  });

  it('leaves gaps between the turns of each ribbon', () => {
    for (const p of [computeWorld(1.5).main, computeWorld(1.5).lens]) {
      expect(p.ribbon.width).toBeLessThan(p.vortex.outerRadius / p.vortex.turns);
    }
  });
});

describe('camera', () => {
  const target = { x: 1, y: 2, z: 3 };

  it('orbits at the requested distance, with elevation 90° looking straight down', () => {
    expect(distance(orbit(target, 5, 37, 21), target)).toBeCloseTo(5, 9);
    const above = orbit(target, 5, 0, 90);
    expect(above.y - target.y).toBeCloseTo(5, 9);
    const front = orbit(target, 5, 0, 0);
    expect(front.z - target.z).toBeCloseTo(5, 9);
  });

  it('fits a sphere in a narrow phone screen as well as a wide one', () => {
    expect(fitDistance(1, 40, 0.5)).toBeGreaterThan(fitDistance(1, 40, 1.5));
    // In a square view, the sphere touches the edges of the 40° field of view.
    expect(Math.sin((20 * Math.PI) / 180) * fitDistance(1, 40, 1)).toBeCloseTo(1, 9);
  });

  it('gives Top a view from above and Side a view from the front', () => {
    const world = computeWorld(1.5);
    const frame = { fovDeg: 40, aspect: 1.5, marginX: 0.05, marginY: 0.1 };
    const top = presetPose('top', world, frame);
    const side = presetPose('side', world, frame);
    expect(top.position.y - top.target.y).toBeGreaterThan(
      0.99 * distance(top.position, top.target),
    );
    // Side: nearly level (12° up), so height reads as a timeline.
    const rise = (side.position.y - side.target.y) / distance(side.position, side.target);
    expect(rise).toBeCloseTo(Math.sin((12 * Math.PI) / 180), 9);
  });

  it.each([
    ['tablet landscape', 1180 / 820],
    ['phone portrait', 390 / 844],
  ])(
    '%s: frames every point of both vortices inside the margins, as tightly as possible',
    (_, aspect) => {
      const world = computeWorld(aspect);
      const frame = { fovDeg: 40, aspect, marginX: 0.06, marginY: 0.12 };
      for (const [az, el] of [
        [-18, 36],
        [0, 89.9],
        [0, 12],
      ] as const) {
        const pose = framePose(world.outline, az, el, frame);
        // Project each point and check it lands inside the screen minus the margins.
        const back = orbit({ x: 0, y: 0, z: 0 }, 1, az, el);
        const rl = Math.hypot(back.z, back.x);
        const right = { x: back.z / rl, y: 0, z: -back.x / rl };
        const up = {
          x: back.y * right.z - back.z * right.y,
          y: back.z * right.x - back.x * right.z,
          z: back.x * right.y - back.y * right.x,
        };
        const tanV = Math.tan((20 * Math.PI) / 180);
        let tightest = 0;
        for (const p of world.outline) {
          const q = {
            x: p.x - pose.position.x,
            y: p.y - pose.position.y,
            z: p.z - pose.position.z,
          };
          const depth = -(q.x * back.x + q.y * back.y + q.z * back.z);
          const sx = (q.x * right.x + q.y * right.y + q.z * right.z) / depth / (tanV * aspect);
          const sy = (q.x * up.x + q.y * up.y + q.z * up.z) / depth / tanV;
          expect(Math.abs(sx)).toBeLessThanOrEqual(1 - 2 * frame.marginX + 1e-9);
          expect(Math.abs(sy)).toBeLessThanOrEqual(1 - 2 * frame.marginY + 1e-9);
          tightest = Math.max(
            tightest,
            Math.abs(sx) / (1 - 2 * frame.marginX),
            Math.abs(sy) / (1 - 2 * frame.marginY),
          );
        }
        // Tight: at least one point touches the edge of the allowed area.
        expect(tightest).toBeGreaterThan(0.99);
      }
    },
  );

  it('flies to an event from outside the vortex, looking at it', () => {
    const point = { x: 0.6, y: -0.3, z: 0 };
    const pose = eventPose(point, { x: 0, y: 0, z: 0 }, 1);
    expect(pose.target).toEqual(point);
    expect(pose.position.x).toBeGreaterThan(point.x);
    expect(pose.position.y).toBeGreaterThan(point.y);
  });

  it('eases flights smoothly from start to end', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    const from = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
    const to = { position: { x: 10, y: 0, z: 0 }, target: { x: 0, y: 4, z: 0 } };
    expect(flightPose(from, to, 1)).toEqual(to);
    expect(flightPose(from, to, 0.25).position.x).toBeLessThan(2.5);
  });
});

describe('ribbonArrays', () => {
  const { main } = computeWorld(1.5);
  const ribbon = ribbonArrays(main.vortex, 0.1, 0.2, main.ribbon.width, main.ribbon.thickness);

  it('has 8 vertices per sample and indices in range, ordered from Now outward', () => {
    const vertices = ribbon.positions.length / 3;
    expect(vertices % 8).toBe(0);
    expect(Math.max(...ribbon.indices)).toBeLessThan(vertices);
    expect(ribbon.indices.length % ribbon.indicesPerStep).toBe(0);
    // The first triangles use the first samples (closest to Now).
    expect(Math.max(...ribbon.indices.slice(0, ribbon.indicesPerStep))).toBeLessThan(16);
  });

  it('is as wide as asked, with its top face pointing up', () => {
    const p = (i: number) => [...ribbon.positions.slice(i * 3, i * 3 + 3)];
    const [ix, iy, iz] = p(0);
    const [ox, oy, oz] = p(1);
    expect(
      Math.hypot((ox ?? 0) - (ix ?? 0), (oy ?? 0) - (iy ?? 0), (oz ?? 0) - (iz ?? 0)),
    ).toBeCloseTo(main.ribbon.width, 5);
    expect(ribbon.normals[1]).toBe(1);
  });
});
