import type { HelixPath, Point3 } from '../geometry/helix';

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
  // Like the poster: a gentle tilt shows the corkscrew hanging down to the Big Bang.
  home: { azimuth: -15, elevation: 34 },
  // Not exactly 90°: orbit controls need a tiny tilt to know which way is "up" on screen.
  top: { azimuth: 0, elevation: 89.9 },
  // A slight tilt: exactly side-on, the flat ribbons would shrink to thin lines.
  side: { azimuth: 0, elevation: 12 },
};

/** Frames `outline` (points along the corkscrew) from one of the named views. */
export function presetPose(view: ViewName, outline: Point3[], frame: Frame): CameraPose {
  const { azimuth, elevation } = VIEWS[view];
  return framePose(outline, azimuth, elevation, frame);
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

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The camera during the landing journey, with the spark at `f`. It starts low and close to the Now
 * glow, widens to show the whole top turn, then dives down into the tightening vortex, looking more
 * and more steeply into it. Continuous in `f`, so the views can follow it smoothly. `aspect` is the
 * free screen area's (beside the caption panel).
 */
export function journeyPose(path: HelixPath, f: number, aspect: number): CameraPose {
  const now = path.pointAt(0);
  const spark = path.pointAt(f);
  const radius = Math.hypot(spark.x, spark.z);
  // 0 at Now → 1 once the top turn is drawn.
  const wide = smoothstep(0, path.fractionAtTurn(1), f);
  // Close up, aim a little above Now, so the flag standing there is in the picture too.
  const target = lerp({ ...now, y: now.y + 0.14 }, { x: 0, y: spark.y * 0.85, z: 0 }, wide);
  const close = 1 / Math.min(1, aspect) ** 0.5;
  // Room for the whole local coil, including its near side (bigger, being closer).
  const distance = close + (fitDistance(0.3 + 1.15 * radius, FOV, aspect) - close) * wide;
  // Low beside Now, higher to see the whole top turn, then steeply down into the vortex.
  const elevation = 12 + 18 * wide + 28 * smoothstep(0.2, 1, f);
  // A slow drift against the spark's direction, for depth.
  const azimuth = 25 - 60 * f;
  return { target, position: orbit(target, distance, azimuth, elevation) };
}

export interface Projected {
  /** Screen pixels from the left. */
  x: number;
  /** Screen pixels from the top. */
  y: number;
  /** Distance in front of the camera (bigger = further away). */
  depth: number;
}

/**
 * Projects world points to screen pixels for a camera pose, exactly as a three.js perspective camera
 * looking at `pose.target` with "up" pointing up. The 2D view uses it to draw what the 3D camera
 * would show, so the two line up.
 */
export function projector(
  pose: CameraPose,
  fovDeg: number,
  width: number,
  height: number,
): (p: Point3) => Projected {
  const { position: eye, target } = pose;
  const fl = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z) || 1;
  const forward = {
    x: (target.x - eye.x) / fl,
    y: (target.y - eye.y) / fl,
    z: (target.z - eye.z) / fl,
  };
  // right = forward × up (up = +y); camera up = right × forward.
  const rl = Math.hypot(forward.z, forward.x) || 1;
  const right = { x: -forward.z / rl, y: 0, z: forward.x / rl };
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };
  const focal = height / 2 / Math.tan((fovDeg * DEG) / 2);
  return (p) => {
    const q = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
    const depth = q.x * forward.x + q.y * forward.y + q.z * forward.z;
    const sx = q.x * right.x + q.y * right.y + q.z * right.z;
    const sy = q.x * up.x + q.y * up.y + q.z * up.z;
    return { x: width / 2 + (focal * sx) / depth, y: height / 2 - (focal * sy) / depth, depth };
  };
}

/** Vertical field of view of the camera, in degrees (both views). */
export const FOV = 40;

/** Sticker size in px: smaller on phones, but the button (with its glow) stays over 48 px. */
export function stickerSize(width: number, height: number): number {
  return Math.round(Math.min(60, Math.max(46, Math.min(width, height) * 0.12)));
}

/**
 * Screen margins for framing: room for the title at the top and the view buttons at the bottom,
 * plus half a sticker (and its label) beyond the outermost flag.
 */
export function viewFrame(width: number, height: number): Frame {
  const sticker = stickerSize(width, height);
  return {
    fovDeg: FOV,
    aspect: width / height,
    marginX: Math.min(0.2, (sticker * 0.7 + 8) / width),
    marginY: Math.min(0.3, (84 + sticker * 0.8) / height),
  };
}
