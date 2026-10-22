import { describe, expect, it } from 'vitest';
import { beamPolygon, computeLayout } from '../../src/render/layout';

const SCREENS = [
  ['iPad landscape', 1180, 820],
  ['iPad portrait', 820, 1180],
  ['small tablet', 640, 1024],
  ['phone', 390, 844],
  ['small phone', 360, 640],
  ['desktop', 1440, 900],
] as const;

describe('computeLayout', () => {
  it.each(SCREENS)(
    '%s: puts the lens beside the spiral in landscape, below it in portrait',
    (_, w, h) => {
      const { landscape, main, lens } = computeLayout(w, h);
      expect(landscape).toBe(w / h >= 1.1);
      if (landscape) expect(lens.x).toBeGreaterThan(main.x);
      else expect(lens.y).toBeGreaterThan(main.y);
    },
  );

  it.each(SCREENS)(
    '%s: keeps both circles on screen, below the title, without overlapping',
    (_, w, h) => {
      const { header, main, lens } = computeLayout(w, h);
      for (const c of [main, lens]) {
        expect(c.x - c.r).toBeGreaterThanOrEqual(0);
        expect(c.x + c.r).toBeLessThanOrEqual(w);
        expect(c.y - c.r).toBeGreaterThanOrEqual(header);
        expect(c.y + c.r).toBeLessThanOrEqual(h);
      }
      expect(Math.hypot(lens.x - main.x, lens.y - main.y)).toBeGreaterThan(main.r + lens.r);
    },
  );

  it.each(SCREENS)('%s: leaves gaps between the turns of each ribbon', (_, w, h) => {
    const { main, lens } = computeLayout(w, h);
    expect(main.ribbon).toBeLessThan(main.r / main.turns);
    expect(lens.ribbon).toBeLessThan(lens.spiralRadius / lens.turns);
  });
});

describe('beamPolygon', () => {
  it('joins two separate circles with their two outer tangent lines', () => {
    const a = { x: 0, y: 0, r: 10 };
    const b = { x: 100, y: 0, r: 40 };
    const corners = beamPolygon(a, b);
    expect(corners).toHaveLength(4);
    const [p1, p2] = corners;
    if (!p1 || !p2) throw new Error('missing corners');
    // Each corner lies on its circle…
    expect(Math.hypot(p1[0] - a.x, p1[1] - a.y)).toBeCloseTo(a.r, 9);
    expect(Math.hypot(p2[0] - b.x, p2[1] - b.y)).toBeCloseTo(b.r, 9);
    // …and the line between them touches both circles: it is perpendicular to each radius.
    const along = [p2[0] - p1[0], p2[1] - p1[1]] as const;
    expect(along[0] * (p1[0] - a.x) + along[1] * (p1[1] - a.y)).toBeCloseTo(0, 6);
    expect(along[0] * (p2[0] - b.x) + along[1] * (p2[1] - b.y)).toBeCloseTo(0, 6);
  });

  it('returns nothing when one circle is inside the other', () => {
    expect(beamPolygon({ x: 0, y: 0, r: 50 }, { x: 5, y: 0, r: 10 })).toEqual([]);
  });
});
