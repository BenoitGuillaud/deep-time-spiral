import type { HelixPath, Point3 } from '../geometry/helix';
import { flagLook, flagsForSpan, type Flag, type FlagLook } from './flags';

/**
 * Where each flag stands on the corkscrew: a pole on the event's exact spot, the picture on top.
 * Shared by the 2D and 3D views so they always agree. Pure, no DOM.
 */

/** Flags closer than this (world units) to an earlier one are raised so they don't overlap. */
const FLAG_GAP = 0.42;
const FLAG_BASE = 0.16;
const FLAG_STEP = 0.34;
/** How far a raised flag leans in towards the axis per step, so it is apart seen from above too. */
const FLAG_LEAN = 0.2;
/**
 * The flag at Now stands taller: the coils just below it (first life is two coils down, at nearly
 * the same angle) would otherwise hide under its picture when seen from the front.
 */
const NOW_FLAG_HEIGHT = 0.4;
const HANG_SHORT = 0.08;
const BIG_BANG_HANG = 0.28;

export interface PlacedFlag {
  flag: Flag;
  look: FlagLook;
  /** The exact spot on the ribbon's top surface. */
  foot: Point3;
  /** Where the picture goes. */
  top: Point3;
}

const dist = (a: Point3, b: Point3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const across = (a: Point3, b: Point3): number => Math.hypot(a.x - b.x, a.z - b.z);

export function placeFlags(path: HelixPath, spanYears: number): PlacedFlag[] {
  const placed: (PlacedFlag & { height: number; down: boolean })[] = [];
  for (const flag of flagsForSpan(spanYears)) {
    const look = flagLook(flag);
    const centre = path.pointAt(flag.f);
    const foot = { ...centre, y: centre.y + path.widthAt(flag.f) * 0.1 };
    // The Big Bang's flag hangs down from the bottom tip, and so does a flag on a coil right under
    // an earlier one (seen from the front, its picture would land on it); the others stand up.
    const down =
      look.id === 'big-bang' ||
      placed.some((other) => other.foot.y > foot.y && across(other.foot, foot) < FLAG_GAP);
    // The Big Bang hangs a little lower, below the tightest coils; a flag hanging under another one
    // hangs short, to stay clear of the coils further down too.
    const base =
      flag.f === 0
        ? NOW_FLAG_HEIGHT
        : look.id === 'big-bang'
          ? BIG_BANG_HANG
          : down
            ? HANG_SHORT
            : FLAG_BASE;
    let height = base;
    while (
      placed.some(
        (other) =>
          other.down === down &&
          dist(other.foot, foot) < FLAG_GAP &&
          Math.abs(other.height - height) < FLAG_STEP,
      )
    ) {
      height += FLAG_STEP;
    }
    const lean = ((height - base) / FLAG_STEP) * FLAG_LEAN;
    const outward = path.across(flag.f);
    const top = {
      x: foot.x - outward.x * lean,
      y: foot.y + (down ? -height : height),
      z: foot.z - outward.z * lean,
    };
    placed.push({ flag, look, foot, top, height, down });
  }
  return placed.map(({ flag, look, foot, top }) => ({ flag, look, foot, top }));
}

/** Points along the corkscrew plus the flag tops, for framing the camera around everything. */
export function outlineOf(path: HelixPath, flags: PlacedFlag[]): Point3[] {
  return [
    ...Array.from({ length: 201 }, (_, i) => path.pointAt(i / 200)),
    ...flags.map((f) => f.top),
  ];
}
