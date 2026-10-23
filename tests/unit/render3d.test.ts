import { describe, expect, it } from 'vitest';
import { CORKSCREW, createHelixPath } from '../../src/geometry/helix';
import {
  easeInOutCubic,
  eventPose,
  fitDistance,
  framePose,
  flightPose,
  orbit,
  presetPose,
  projector,
} from '../../src/render3d/camera';

const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const path = createHelixPath(CORKSCREW);
const outline = Array.from({ length: 201 }, (_, i) => path.pointAt(i / 200));

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
    const frame = { fovDeg: 40, aspect: 1.5, marginX: 0.05, marginY: 0.1 };
    const top = presetPose('top', outline, frame);
    const side = presetPose('side', outline, frame);
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
    '%s: frames every point of the corkscrew inside the margins, as tightly as possible',
    (_, aspect) => {
      const frame = { fovDeg: 40, aspect, marginX: 0.06, marginY: 0.12 };
      for (const [az, el] of [
        [-18, 36],
        [0, 89.9],
        [0, 12],
      ] as const) {
        const pose = framePose(outline, az, el, frame);
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
        for (const p of outline) {
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

describe('projector', () => {
  const pose = { position: { x: 0, y: 1, z: 5 }, target: { x: 0, y: 0, z: 0 } };
  const project = projector(pose, 40, 800, 600);

  it('puts the target in the middle of the screen', () => {
    const p = project(pose.target);
    expect(p.x).toBeCloseTo(400, 9);
    expect(p.y).toBeCloseTo(300, 9);
  });

  it('draws higher points higher on screen and right-hand points to the right', () => {
    expect(project({ x: 0, y: 0.5, z: 0 }).y).toBeLessThan(300);
    expect(project({ x: 0.5, y: 0, z: 0 }).x).toBeGreaterThan(400);
  });

  it('measures depth along the view, and puts the frame edge at half the field of view', () => {
    // A level camera looking straight down the -z axis.
    const level = projector(
      { position: { x: 0, y: 0, z: 5 }, target: { x: 0, y: 0, z: 0 } },
      40,
      800,
      600,
    );
    expect(level({ x: 0, y: 0, z: 4 }).depth).toBeCloseTo(1, 9);
    // 1 unit ahead and tan(20°) up lands exactly on the top edge of a 40° field of view.
    expect(level({ x: 0, y: Math.tan((20 * Math.PI) / 180), z: 4 }).y).toBeCloseTo(0, 6);
  });
});
