import type { Point3 } from '../geometry/vortex';
import type { World } from './world';

/** Camera maths for the 3D view: orbit positions, framing, presets and fly-to. Pure functions. */

export interface CameraPose {
  position: Point3;
  target: Point3;
}

export type ViewName = 'home' | 'top' | 'side';

const DEG = Math.PI / 180;

/**
 * Camera position orbiting `target`: azimuth 0 looks from the +z side (the front), positive azimuth
 * moves to the right; elevation 90° looks straight down.
 */
export function orbit(
  target: Point3,
  distance: number,
  azimuthDeg: number,
  elevationDeg: number,
): Point3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return {
    x: target.x + distance * Math.cos(el) * Math.sin(az),
    y: target.y + distance * Math.sin(el),
    z: target.z + distance * Math.cos(el) * Math.cos(az),
  };
}

/** Distance at which a sphere of `radius` fits the view, for a vertical field of view and aspect ratio. */
export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
  const vertical = fovDeg * DEG;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  return radius / Math.sin(Math.min(vertical, horizontal) / 2);
}

export interface Frame {
  fovDeg: number;
  aspect: number;
  /** Share of the screen width kept free on each side (for stickers). */
  marginX: number;
  /** Share of the screen height kept free at the top and bottom (title, buttons, stickers). */
  marginY: number;
}

/**
 * The closest camera, looking from the given direction at the middle of `points`, that keeps every
 * point inside the screen minus its margins. Tighter than fitting a bounding sphere, which wastes
 * most of a tall phone screen.
 */
export function framePose(
  points: Point3[],
  azimuthDeg: number,
  elevationDeg: number,
  frame: Frame,
): CameraPose {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  const target = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  // Camera axes: `back` points from the target towards the camera.
  const back = orbit({ x: 0, y: 0, z: 0 }, 1, azimuthDeg, elevationDeg);
  const rightLength = Math.hypot(back.z, back.x) || 1;
  const right = { x: back.z / rightLength, y: 0, z: -back.x / rightLength };
  const up = {
    x: back.y * right.z - back.z * right.y,
    y: back.z * right.x - back.x * right.z,
    z: back.x * right.y - back.y * right.x,
  };
  const tanV = Math.tan((frame.fovDeg * DEG) / 2) * (1 - 2 * frame.marginY);
  const tanH = Math.tan((frame.fovDeg * DEG) / 2) * frame.aspect * (1 - 2 * frame.marginX);
  let distance = 0;
  for (const p of points) {
    const q = { x: p.x - target.x, y: p.y - target.y, z: p.z - target.z };
    const x = q.x * right.x + q.y * right.y + q.z * right.z;
    const y = q.x * up.x + q.y * up.y + q.z * up.z;
    const towards = q.x * back.x + q.y * back.y + q.z * back.z;
    distance = Math.max(distance, towards + Math.abs(x) / tanH, towards + Math.abs(y) / tanV);
  }
  return { target, position: orbit(target, distance, azimuthDeg, elevationDeg) };
}

/** Viewing directions of the three named views: Home (3D), Top (the flat map), Side (the timeline). */
const VIEWS: Record<ViewName, { azimuth: number; elevation: number }> = {
  home: { azimuth: -18, elevation: 36 },
  // Not exactly 90°: orbit controls need a tiny tilt to know which way is "up" on screen.
  top: { azimuth: 0, elevation: 89.9 },
  // A slight tilt: exactly side-on, the flat ribbons would shrink to thin lines.
  side: { azimuth: 0, elevation: 12 },
};

export function presetPose(view: ViewName, world: World, frame: Frame): CameraPose {
  const { azimuth, elevation } = VIEWS[view];
  // On a tall screen the lens sits above the main vortex; looking down more steeply opens it up.
  const tilt = view === 'home' && !world.landscape ? 12 : 0;
  return framePose(world.outline, azimuth, elevation + tilt, frame);
}

/**
 * A close look at one event: the camera stands outside the vortex, in the event's direction from the
 * axis, a little above it, so the picture faces the viewer.
 */
export function eventPose(point: Point3, axis: Point3, distance: number): CameraPose {
  const azimuth = Math.atan2(point.x - axis.x, point.z - axis.z) / DEG;
  return { target: point, position: orbit(point, distance, azimuth, 32) };
}

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function lerp(a: Point3, b: Point3, t: number): Point3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** The pose a fraction t (0…1, eased) of the way through a flight from `from` to `to`. */
export function flightPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const e = easeInOutCubic(t);
  return { position: lerp(from.position, to.position, e), target: lerp(from.target, to.target, e) };
}
