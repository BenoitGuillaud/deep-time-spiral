import { select, type Selection } from 'd3';
import { CORKSCREW, createHelixPath, type Point3 } from '../geometry/helix';
import { t } from '../i18n/i18n';
import {
  FOV,
  presetPose,
  projector,
  stickerSize,
  viewFrame,
  type Projected,
} from '../render3d/camera';
import { COSMOS_COLOR, YOU_GAP } from './events';
import { outlineOf, placeFlags, type PlacedFlag } from './flag-placement';
import type { Flag } from './flags';
import { drawBadge } from './illustrations/icons';
import { seeded } from './seeded';
import { colourAt, spanBands } from './span-colours';

/**
 * The 2D corkscrew: the same true-size spiral as the 3D view, drawn in SVG from the same Home camera
 * (so the 3D view can fade in exactly on top). The first paint everywhere, and the whole experience
 * where WebGL is missing or drawn in software.
 */

type Group = Selection<SVGGElement, unknown, null, undefined>;

export interface Helix2dOptions {
  width: number;
  height: number;
  /** The years shown, Now → `spanYears` ago (the whole story by default). */
  spanYears: number;
  animate: boolean;
  onSelect: (flag: Flag) => void;
  /**
   * The landing journey: everything starts hidden and `reveal` shows it as the spark passes.
   * (Without it, the ribbon draws itself in `DRAW_SECONDS`.)
   */
  journey?: {
    /** Stretches of ribbon that glow for a while (`start`: seconds from now; may be negative). */
    highlights: { from: number; to: number; start: number; seconds: number }[];
  };
  /** Screen space covered by the caption panel: the spiral is framed beside it. */
  inset?: { right: number; bottom: number };
}

/** Shows the journey's progress: the ribbon up to `f`, and the pictures popped so far. */
export type Reveal2d = (f: number, popped: readonly string[]) => void;

const DRAW_SECONDS = 2.4;
const SKY = '#060a14';
const px = (n: number): string => n.toFixed(1);

/** Mixes a colour towards the night sky: far coils look a little dimmer, for depth. */
function dim(hex: string, amount: number): string {
  const parse = (h: string, i: number): number => parseInt(h.slice(i, i + 2), 16);
  const mix = (i: number): string =>
    Math.round(parse(hex, i) * (1 - amount) + parse(SKY, i) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

function defs(svg: Selection<SVGSVGElement, unknown, null, undefined>): void {
  const d = svg.append('defs');
  const space = d.append('radialGradient').attr('id', 'space').attr('cx', '50%').attr('cy', '35%');
  space.append('stop').attr('offset', '0%').attr('stop-color', '#141f38');
  space.append('stop').attr('offset', '100%').attr('stop-color', SKY);
  for (const [id, inner, outer] of [
    ['glow-now', '#ffe6a0', '#ffd166'],
    ['glow-bang', '#fffaf0', '#ffaa50'],
  ] as const) {
    const g = d.append('radialGradient').attr('id', id);
    g.append('stop').attr('offset', '0%').attr('stop-color', inner).attr('stop-opacity', 1);
    g.append('stop').attr('offset', '40%').attr('stop-color', outer).attr('stop-opacity', 0.45);
    g.append('stop').attr('offset', '100%').attr('stop-color', outer).attr('stop-opacity', 0);
  }
}

function starField(g: Group, width: number, height: number): void {
  const random = seeded(42);
  const count = Math.min(500, Math.round((width * height) / 2000));
  for (let i = 0; i < count; i++) {
    const star = g
      .append('circle')
      .attr('cx', px(random() * width))
      .attr('cy', px(random() * height))
      .attr('r', (0.4 + random() * 1.1).toFixed(2))
      .attr('fill', '#ffffff')
      .attr('opacity', (0.25 + random() * 0.6).toFixed(2));
    if (random() < 0.15) {
      star
        .attr('class', 'twinkle')
        .style('animation-delay', `${(random() * 4).toFixed(2)}s`)
        .style('animation-duration', `${(2 + random() * 3).toFixed(2)}s`);
    }
  }
}

/** One piece of ribbon between two positions, as a projected four-sided shape. */
interface Piece {
  points: Projected[];
  depth: number;
  f: number;
  colour: string;
  cosmos: boolean;
}

function flagButton(
  g: Group,
  placed: PlacedFlag,
  at: Projected,
  size: number,
  /** Seconds before it pops in; null: it waits, hidden, until the journey reveals it. */
  delay: number | null,
  onSelect: (flag: Flag) => void,
): void {
  const { look, flag } = placed;
  const button = g
    .append('g')
    .attr('class', 'event')
    .attr('data-event', look.id)
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', look.name)
    .attr('transform', `translate(${px(at.x)},${px(at.y)})`)
    .on('click', () => {
      onSelect(flag);
    })
    .on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(flag);
      }
    });
  if (delay === null) button.classed('waiting', true);
  // Pops in as the drawing ribbon reaches it.
  const pop = button
    .append('g')
    .attr('class', 'pop')
    .style('animation-delay', `${(delay ?? 0).toFixed(2)}s`);
  // Invisible hit area: at least 48 × 48 px even when the badge is drawn smaller.
  pop
    .append('circle')
    .attr('r', Math.max(24, size / 2 + 4))
    .attr('fill', 'transparent');
  pop
    .append('circle')
    .attr('class', 'focus-ring')
    .attr('r', size / 2 + 7);
  drawBadge(pop, look.art, size, look.ring);
  pop
    .append('text')
    .attr('class', 'event-label')
    .attr('y', size / 2 + 16)
    .text(look.label);
}

/** Draws the corkscrew; during the journey, returns the function that reveals it bit by bit. */
export function renderHelix2d(container: HTMLElement, options: Helix2dOptions): Reveal2d | null {
  const { width, height, spanYears, onSelect, journey } = options;
  const delay = (seconds: number): string => `${seconds.toFixed(2)}s`;
  // During the journey, things wait hidden (no pending animations, which cost every frame) and
  // `reveal` shows them as the spark passes: only the few new ones each frame.
  const waiting: { f: number; element: SVGElement }[] = [];
  const hideUntil = (element: SVGElement | null, f: number): void => {
    if (!journey || !element) return;
    element.setAttribute('visibility', 'hidden');
    waiting.push({ f, element });
  };
  const path = createHelixPath(CORKSCREW);
  const placed = placeFlags(path, spanYears);
  // Framed in the free area (beside the panel); the stars still fill the whole screen.
  const free = {
    width: width - (options.inset?.right ?? 0),
    height: height - (options.inset?.bottom ?? 0),
  };
  const pose = presetPose('home', outlineOf(path, placed), viewFrame(free.width, free.height));
  const project = projector(pose, FOV, free.width, free.height);

  const svg = select(container)
    .append('svg')
    .attr('class', options.animate ? 'scene' : 'scene static')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${String(width)} ${String(height)}`)
    .attr('role', 'group')
    .attr('aria-labelledby', 'scene-title');
  svg.append('title').attr('id', 'scene-title').text(t('spiral.label'));
  defs(svg);
  svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#space)');
  starField(svg.append('g').attr('aria-hidden', 'true'), width, height);

  // The ribbon, cut into short pieces and painted from the furthest to the nearest.
  const bands = spanBands(spanYears);
  const steps = Math.ceil(path.length / 0.03);
  const random = seeded(3);
  const pieces: Piece[] = [];
  const edge = (f: number, side: number): Point3 => {
    const c = path.pointAt(f);
    const a = path.across(f);
    const w = path.widthAt(f) / 2;
    return { x: c.x + side * w * a.x, y: c.y + path.widthAt(f) * 0.1, z: c.z + side * w * a.z };
  };
  let depthMin = Infinity;
  let depthMax = -Infinity;
  for (let i = 0; i < steps; i++) {
    const f0 = i / steps;
    const f1 = Math.min(1, (i + 1.15) / steps); // a sliver of overlap hides seams
    const points = [edge(f0, -1), edge(f0, 1), edge(f1, 1), edge(f1, -1)].map(project);
    const depth = points.reduce((sum, p) => sum + p.depth, 0) / 4;
    depthMin = Math.min(depthMin, depth);
    depthMax = Math.max(depthMax, depth);
    const colour = colourAt(bands, (f0 + f1) / 2);
    pieces.push({ points, depth, f: f0, colour, cosmos: colour === COSMOS_COLOR });
  }
  pieces.sort((a, b) => b.depth - a.depth);
  const ribbon = svg.append('g').attr('class', 'ribbon2d').attr('aria-hidden', 'true');
  for (const piece of pieces) {
    const far = (piece.depth - depthMin) / (depthMax - depthMin || 1);
    const fill = dim(piece.colour, 0.35 * far);
    const polygon = ribbon
      .append('polygon')
      .attr('class', journey ? null : 'seg')
      .attr('points', piece.points.map((p) => `${px(p.x)},${px(p.y)}`).join(' '))
      .attr('fill', fill)
      .attr('stroke', fill)
      .attr('stroke-width', 0.6)
      .style('animation-delay', delay(piece.f * DRAW_SECONDS));
    hideUntil(polygon.node(), piece.f);
    // Stardust on the time before the Earth (decoration, not data).
    if (piece.cosmos && random() < 0.28) {
      const p = piece.points[0];
      if (p) {
        const speck = ribbon
          .append('circle')
          .attr('class', journey ? null : 'seg')
          .attr('cx', px(p.x + (random() - 0.5) * 6))
          .attr('cy', px(p.y + (random() - 0.5) * 4))
          .attr('r', (0.5 + random() * 0.8).toFixed(2))
          .attr('fill', '#efeaff')
          .style('animation-delay', delay(piece.f * DRAW_SECONDS));
        hideUntil(speck.node(), piece.f);
      }
    }
  }

  // The journey's glowing stretches (e.g. all the dinosaurs), over the ribbon.
  for (const h of journey?.highlights ?? []) {
    const n = Math.max(2, Math.ceil(((h.to - h.from) * path.length) / 0.01));
    const points = Array.from({ length: n + 1 }, (_, i) =>
      project(path.pointAt(h.from + ((h.to - h.from) * i) / n)),
    );
    svg
      .append('polyline')
      .attr('class', 'journey-glow')
      .attr('points', points.map((p) => `${px(p.x)},${px(p.y)}`).join(' '))
      .attr('aria-hidden', 'true')
      .style('animation-delay', delay(h.start))
      .style('animation-duration', `${h.seconds.toFixed(2)}s`);
  }

  // Glows: Now at the start, the Big Bang at the bottom tip; "You are here" just left of Now, where
  // nothing is drawn (the ribbon starts at Now).
  const scale = (p: Projected): number => height / 2 / Math.tan((FOV * Math.PI) / 360) / p.depth;
  const glow = (at: Point3, size: number, id: string, appear: number | null = null): void => {
    const p = project(at);
    const group = svg.append('g');
    if (appear !== null) {
      group
        .attr('class', journey ? null : 'seg')
        .style('animation-delay', delay(appear * DRAW_SECONDS));
      hideUntil(group.node(), appear);
    }
    group
      .append('circle')
      .attr('class', 'pulse')
      .attr('cx', px(p.x))
      .attr('cy', px(p.y))
      .attr('r', px((size / 2) * scale(p)))
      .attr('fill', `url(#${id})`)
      .attr('aria-hidden', 'true');
  };
  const now = path.pointAt(0);
  glow(now, 0.34, 'glow-now');
  glow(path.pointAt(1), 0.75, 'glow-bang', 1);
  const you = project({ x: now.x - YOU_GAP, y: now.y, z: now.z });
  svg
    .append('text')
    .attr('class', 'you-label')
    .attr('x', px(you.x))
    .attr('y', px(you.y))
    .attr('dy', '0.35em')
    .attr('aria-hidden', 'true')
    .text(t('spiral.you'));

  // Flags: a pole on the exact spot, the picture on top.
  const size = stickerSize(width, height);
  const flags = svg.append('g').attr('class', 'events');
  for (const p of placed) {
    const foot = project(p.foot);
    const top = project(p.top);
    flags
      .append('line')
      .attr('x1', px(foot.x))
      .attr('y1', px(foot.y))
      .attr('x2', px(top.x))
      .attr('y2', px(top.y))
      .attr('stroke', p.look.ring)
      .attr('aria-hidden', 'true')
      .attr('data-event', p.look.id)
      .attr('class', journey ? 'pointer waiting' : 'pointer seg')
      .style('animation-delay', delay(p.flag.f * DRAW_SECONDS));
  }
  for (const p of placed) {
    flagButton(flags, p, project(p.top), size, journey ? null : p.flag.f * DRAW_SECONDS, onSelect);
  }

  if (!journey) return null;
  waiting.sort((a, b) => a.f - b.f);
  let shown = 0;
  const flagElements = flags.selectAll<SVGElement, unknown>('[data-event]').nodes();
  return (f, popped) => {
    while (shown < waiting.length && (waiting[shown]?.f ?? Infinity) <= f) {
      waiting[shown]?.element.removeAttribute('visibility');
      shown += 1;
    }
    for (const element of flagElements) {
      const id = element.getAttribute('data-event') ?? '';
      if (element.classList.contains('waiting') && popped.includes(id)) {
        element.classList.remove('waiting');
      }
    }
  };
}
