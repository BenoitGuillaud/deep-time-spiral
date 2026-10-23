/** Where the main spiral and the zoom lens sit on screen. Pure, so it can be unit-tested. */

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Layout {
  landscape: boolean;
  /** The main spiral: Now at the centre, the Big Bang at the outer end. */
  main: Circle & { turns: number; ribbon: number; badge: number };
  /** The zoom lens, and the spiral drawn inside it. */
  lens: Circle & { spiralRadius: number; turns: number; ribbon: number; badge: number };
  header: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function computeLayout(width: number, height: number): Layout {
  const header = width < 600 ? 64 : 76;
  const landscape = width / height >= 1.1;
  const free = { x: 0, y: header, w: width, h: height - header };

  const split = landscape ? 0.56 : 0.55;
  // Portrait puts the lens above the main spiral, matching the 3D view seen from above.
  const mainBox = landscape
    ? { x: free.x, y: free.y, w: free.w * split, h: free.h }
    : { x: free.x, y: free.y + free.h * (1 - split), w: free.w, h: free.h * split };
  const lensBox = landscape
    ? { x: free.x + mainBox.w, y: free.y, w: free.w - mainBox.w, h: free.h }
    : { x: free.x, y: free.y, w: free.w, h: free.h * (1 - split) };

  // Room around each spiral for badges and labels that stick out of the ribbon.
  const mainMargin = clamp(Math.min(mainBox.w, mainBox.h) * 0.12, 28, 56);
  const mainR = Math.max(40, Math.min(mainBox.w, mainBox.h) / 2 - mainMargin);
  // 3.75 turns spreads the main events around the clock: Big Bang at 9 o'clock, first life up-left,
  // Sun and Earth up-right.
  const mainTurns = 3.75;

  const lensMargin = clamp(Math.min(lensBox.w, lensBox.h) * 0.08, 18, 40);
  const lensR = Math.max(40, Math.min(lensBox.w, lensBox.h) / 2 - lensMargin);
  // 2.25 turns puts T. rex left, the first dinosaurs at the bottom and trilobites on the right.
  const lensTurns = 2.25;

  return {
    landscape,
    header,
    main: {
      x: mainBox.x + mainBox.w / 2,
      y: mainBox.y + mainBox.h / 2,
      r: mainR,
      turns: mainTurns,
      ribbon: 0.48 * (mainR / mainTurns),
      badge: clamp(mainR * 0.26, 48, 88),
    },
    lens: {
      x: lensBox.x + lensBox.w / 2,
      y: lensBox.y + lensBox.h / 2,
      r: lensR,
      spiralRadius: lensR * 0.8,
      turns: lensTurns,
      ribbon: 0.5 * ((lensR * 0.8) / lensTurns),
      badge: clamp(lensR * 0.3, 44, 84),
    },
  };
}

/**
 * The two outer tangent lines between circles a and b, as the four corners of the "light beam"
 * joining the magnifier on the main spiral to the zoom lens.
 */
export function beamPolygon(a: Circle, b: Circle): [number, number][] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(a.r - b.r)) return [];
  const phi = Math.atan2(dy, dx);
  const alpha = Math.acos((a.r - b.r) / d);
  const at = (c: Circle, angle: number): [number, number] => [
    c.x + c.r * Math.cos(angle),
    c.y + c.r * Math.sin(angle),
  ];
  return [at(a, phi + alpha), at(b, phi + alpha), at(b, phi - alpha), at(a, phi - alpha)];
}
