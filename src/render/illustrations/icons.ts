import type { Selection } from 'd3';
import { SILHOUETTES, type Silhouette } from './silhouettes';

/** Illustrations are drawn in a 100 × 100 box centred on (0, 0), then scaled. */

export type IllustrationKind =
  | 'big-bang'
  | 'solar-system'
  | 'first-life'
  | 'trilobite'
  | 'herrerasaurus'
  | 'tyrannosaurus'
  | 'people'
  | 'zoom';

type Group = Selection<SVGGElement, unknown, null, undefined>;

function star(points: number, outer: number, inner: number): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points;
    return `${(r * Math.sin(a)).toFixed(2)},${(-r * Math.cos(a)).toFixed(2)}`;
  }).join(' ');
}

function bigBang(g: Group): void {
  for (const [r, color, opacity] of [
    [48, '#ff9f43', 0.18],
    [38, '#ffb347', 0.3],
  ] as const) {
    g.append('circle').attr('r', r).attr('fill', color).attr('opacity', opacity);
  }
  g.append('polygon')
    .attr('points', star(12, 46, 16))
    .attr('fill', '#ffe08a')
    .attr('opacity', 0.9);
  g.append('polygon')
    .attr('points', star(8, 30, 12))
    .attr('fill', '#fff6d6');
  g.append('circle').attr('r', 11).attr('fill', '#ffffff');
  for (const [x, y, s] of [
    [-34, -30, 7],
    [36, -22, 5],
    [30, 34, 6],
    [-36, 28, 4],
  ] as const) {
    g.append('polygon')
      .attr('points', star(4, s, s / 3))
      .attr('transform', `translate(${String(x)},${String(y)})`)
      .attr('fill', '#ffffff');
  }
}

function solarSystem(g: Group): void {
  g.append('ellipse')
    .attr('rx', 44)
    .attr('ry', 16)
    .attr('transform', 'rotate(-18)')
    .attr('fill', 'none')
    .attr('stroke', '#b8c4d6')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '3 4')
    .attr('opacity', 0.7);
  const sun = g.append('g').attr('transform', 'translate(-12,-6)');
  sun.append('circle').attr('r', 34).attr('fill', '#ffb347').attr('opacity', 0.25);
  sun
    .append('polygon')
    .attr('points', star(12, 30, 22))
    .attr('fill', '#ffc94a');
  sun.append('circle').attr('r', 21).attr('fill', '#ffd166');
  const earth = g.append('g').attr('transform', 'translate(28,20)');
  earth.append('circle').attr('r', 13).attr('fill', '#3a86ff');
  earth
    .append('path')
    .attr('d', 'M-7,-6 q5,-4 9,0 q-1,5 -6,6 q-4,-2 -3,-6 z M3,4 q5,-2 7,2 q-3,5 -7,3 z')
    .attr('fill', '#5fd068');
  g.append('circle').attr('cx', 44).attr('cy', 4).attr('r', 4.5).attr('fill', '#e3e3e3');
}

function firstLife(g: Group): void {
  g.append('path')
    .attr('d', 'M-46,36 H46')
    .attr('stroke', '#5fe3b1')
    .attr('stroke-width', 3)
    .attr('opacity', 0.5);
  const layers = [
    [40, 30, '#1f8a70'],
    [30, 24, '#2fb38a'],
    [20, 17, '#5fe3b1'],
  ] as const;
  for (const [w, h, color] of layers) {
    g.append('path')
      .attr(
        'd',
        `M${String(-w)},34 Q${String(-w)},${String(34 - 2 * h)} 0,${String(34 - 2 * h)} Q${String(w)},${String(34 - 2 * h)} ${String(w)},34 Z`,
      )
      .attr('fill', color);
  }
  for (const [x, y, r, a] of [
    [-30, -30, 6, 20],
    [-8, -40, 5, -30],
    [16, -32, 7, 60],
    [34, -14, 4, 0],
  ] as const) {
    g.append('ellipse')
      .attr('rx', r * 1.8)
      .attr('ry', r)
      .attr('transform', `translate(${String(x)},${String(y)}) rotate(${String(a)})`)
      .attr('fill', '#b8ffe4')
      .attr('opacity', 0.85);
  }
}

function person(g: Group, x: number, y: number, scale: number, color: string): void {
  const p = g
    .append('g')
    .attr('transform', `translate(${String(x)},${String(y)}) scale(${String(scale)})`);
  p.append('circle').attr('cy', -30).attr('r', 11).attr('fill', color);
  p.append('path')
    .attr(
      'd',
      'M-15,-14 Q0,-20 15,-14 Q20,-12 20,-4 L20,22 Q20,26 15,26 L-15,26 Q-20,26 -20,22 L-20,-4 Q-20,-12 -15,-14 Z',
    )
    .attr('fill', color);
}

function people(g: Group): void {
  person(g, -14, 2, 1.15, '#ffd166');
  person(g, 20, 14, 0.8, '#ffe8b0');
}

/** A magnifying glass with a tiny person and T. rex inside: "zoom in to see them". */
function zoom(g: Group): void {
  g.append('line')
    .attr('x1', 18)
    .attr('y1', 18)
    .attr('x2', 42)
    .attr('y2', 42)
    .attr('stroke', '#ffd166')
    .attr('stroke-width', 10)
    .attr('stroke-linecap', 'round');
  g.append('circle')
    .attr('cx', -6)
    .attr('cy', -6)
    .attr('r', 34)
    .attr('fill', '#1b2a4a')
    .attr('stroke', '#ffd166')
    .attr('stroke-width', 6);
  const inside = g.append('g').attr('transform', 'translate(-6,-6) scale(0.42)');
  person(inside, -36, 22, 0.9, '#ffe8b0');
  silhouette(
    inside.append('g').attr('transform', 'translate(22,0)'),
    SILHOUETTES.tyrannosaurus,
    '#ffb3a8',
  );
}

function silhouette(g: Group, s: Silhouette, color: string, flip = false): void {
  const fit = 84 / Math.max(s.width, s.height);
  const sx = flip ? -fit : fit;
  g.append('g')
    .attr(
      'transform',
      `scale(${String(sx)},${String(fit)}) translate(${String(-s.width / 2)},${String(-s.height / 2)})`,
    )
    .append('path')
    .attr('transform', s.transform)
    .attr('d', s.d)
    .attr('fill', color);
}

/** Draws one illustration into `g`, centred on (0, 0) and `size` pixels across. */
export function drawIllustration(g: Group, kind: IllustrationKind, size: number): void {
  const art = g.append('g').attr('transform', `scale(${String(size / 100)})`);
  switch (kind) {
    case 'big-bang':
      bigBang(art);
      break;
    case 'solar-system':
      solarSystem(art);
      break;
    case 'first-life':
      firstLife(art);
      break;
    case 'trilobite':
      silhouette(art, SILHOUETTES.trilobite, '#bdf3ff');
      break;
    case 'herrerasaurus':
      silhouette(art, SILHOUETTES.herrerasaurus, '#ffd3a8', true);
      break;
    case 'tyrannosaurus':
      silhouette(art, SILHOUETTES.tyrannosaurus, '#ffb3a8');
      break;
    case 'zoom':
      zoom(art);
      break;
    case 'people':
      people(art);
      break;
  }
}

/** A round "sticker" badge: dark disc, coloured ring, illustration inside. */
export function drawBadge(g: Group, kind: IllustrationKind, size: number, ring: string): void {
  g.append('circle')
    .attr('class', 'badge-glow')
    .attr('r', size * 0.62)
    .attr('fill', ring)
    .attr('opacity', 0.22);
  g.append('circle')
    .attr('r', size / 2)
    .attr('fill', '#0b1426')
    .attr('stroke', ring)
    .attr('stroke-width', Math.max(2.5, size * 0.06));
  drawIllustration(g, kind, size * 0.78);
}
