import { select, type Selection } from 'd3';
import { event as findEvent, resolveAge, unit, unitsOfRank } from '../data';
import {
  evenSpiralLength,
  evenSpiralPoint,
  linearMapping,
  polarToCartesian,
  type EvenSpiral,
  type Point,
  type TimeMapping,
} from '../geometry/spiral';
import { isMessageKey, t } from '../i18n/i18n';
import { formatAgo, formatSpanMillions } from './format';
import { drawBadge, type IllustrationKind } from './illustrations/icons';
import { beamPolygon, computeLayout, type Layout } from './layout';

type Group = Selection<SVGGElement, unknown, null, undefined>;

export interface EventMarker {
  id: string;
  art: IllustrationKind;
  ring: string;
}

/** Events on the main spiral (Big Bang → now). */
export const MAIN_EVENTS: EventMarker[] = [
  { id: 'big-bang', art: 'big-bang', ring: '#ffd166' },
  { id: 'solar-system', art: 'solar-system', ring: '#ffb347' },
  { id: 'first-life', art: 'first-life', ring: '#5fe3b1' },
];

/** Events inside the zoom lens (the Phanerozoic, 538.8 million years ago → now). */
export const LENS_EVENTS: EventMarker[] = [
  { id: 'animals-with-shells', art: 'trilobite', ring: '#9ad9dd' },
  { id: 'first-dinosaurs', art: 'herrerasaurus', ring: '#f4a261' },
  { id: 'last-dinosaurs', art: 'tyrannosaurus', ring: '#ff8a7a' },
  { id: 'first-people', art: 'people', ring: '#ffd166' },
];

/** Not an ICS colour: the time before the Earth existed. */
const COSMOS_COLOR = '#3b2f8f';
const DRAW_SECONDS = 2.8;

export interface SceneOptions {
  width: number;
  height: number;
  animate: boolean;
  onSelect: (marker: EventMarker) => void;
}

export interface SceneInfo {
  layout: Layout;
  /** How many times more path length one year gets inside the lens than on the main spiral. */
  zoom: number;
}

/** Small seeded random generator, so the star field is the same on every visit. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const px = (n: number): string => n.toFixed(1);

interface SpiralFrame {
  spiral: EvenSpiral;
  center: Point;
  mapping: TimeMapping;
  length: number;
}

function pointAt(frame: SpiralFrame, u: number): Point {
  const p = polarToCartesian(evenSpiralPoint(u, frame.spiral));
  return { x: frame.center.x + p.x, y: frame.center.y + p.y };
}

/** One coloured stretch of the ribbon, from u0 (younger) to u1 (older). */
function ribbonSegment(
  g: Group,
  frame: SpiralFrame,
  u0: number,
  u1: number,
  color: string,
  width: number,
  timing: { delay: number; duration: number },
): void {
  // Overlap the next stretch by about a pixel so no hairline gap shows between colours.
  const end = Math.min(1, u1 + 1 / frame.length);
  const steps = Math.max(2, Math.ceil(((end - u0) * frame.length) / 3));
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    // Clamp: adding up fractions can overshoot `end` by a rounding error (1.0000000000000002).
    const p = pointAt(frame, Math.min(end, u0 + ((end - u0) * i) / steps));
    return `${px(p.x)},${px(p.y)}`;
  });
  g.append('path')
    .attr('class', 'draw')
    .attr('d', `M${points.join('L')}`)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', width)
    .attr('pathLength', 1)
    .style('animation-delay', `${timing.delay.toFixed(2)}s`)
    .style('animation-duration', `${Math.max(0.05, timing.duration).toFixed(2)}s`);
}

function defs(svg: Selection<SVGSVGElement, unknown, null, undefined>): void {
  const d = svg.append('defs');
  const space = d.append('radialGradient').attr('id', 'space').attr('cx', '50%').attr('cy', '40%');
  space.append('stop').attr('offset', '0%').attr('stop-color', '#1a2a4a');
  space.append('stop').attr('offset', '100%').attr('stop-color', '#060a14');

  for (const [id, color] of [
    ['nebula-violet', '#7b4fd6'],
    ['nebula-teal', '#1fb5a8'],
  ] as const) {
    const g = d.append('radialGradient').attr('id', id);
    g.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.35);
    g.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);
  }

  const glass = d
    .append('radialGradient')
    .attr('id', 'lens-glass')
    .attr('cx', '40%')
    .attr('cy', '35%');
  glass
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#24365c')
    .attr('stop-opacity', 0.95);
  glass
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#0a1222')
    .attr('stop-opacity', 0.95);

  const bang = d.append('radialGradient').attr('id', 'big-bang-glow');
  bang.append('stop').attr('offset', '0%').attr('stop-color', '#fff3c4').attr('stop-opacity', 0.75);
  bang.append('stop').attr('offset', '45%').attr('stop-color', '#ffb347').attr('stop-opacity', 0.3);
  bang.append('stop').attr('offset', '100%').attr('stop-color', '#ff7b54').attr('stop-opacity', 0);

  const beam = d.append('linearGradient').attr('id', 'beam');
  beam.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.16);
  beam
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#ffffff')
    .attr('stop-opacity', 0.04);

  // The time before Earth: a deep violet ribbon sprinkled with stars.
  const cosmos = d
    .append('pattern')
    .attr('id', 'cosmos')
    .attr('width', 18)
    .attr('height', 18)
    .attr('patternUnits', 'userSpaceOnUse');
  cosmos.append('rect').attr('width', 18).attr('height', 18).attr('fill', COSMOS_COLOR);
  for (const [x, y, r] of [
    [3, 4, 1.1],
    [12, 9, 0.8],
    [7, 15, 0.9],
    [15, 2, 0.6],
  ] as const) {
    cosmos.append('circle').attr('cx', x).attr('cy', y).attr('r', r).attr('fill', '#e8e2ff');
  }

  const glow = d
    .append('filter')
    .attr('id', 'glow')
    .attr('x', '-20%')
    .attr('y', '-20%')
    .attr('width', '140%')
    .attr('height', '140%');
  glow.append('feGaussianBlur').attr('stdDeviation', 5).attr('result', 'blur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');
}

function starField(g: Group, width: number, height: number): void {
  const random = seeded(42);
  const count = Math.min(600, Math.round((width * height) / 1800));
  for (let i = 0; i < count; i++) {
    const star = g
      .append('circle')
      .attr('cx', px(random() * width))
      .attr('cy', px(random() * height))
      .attr('r', (0.4 + random() * 1.2).toFixed(2))
      .attr('fill', '#ffffff')
      .attr('opacity', (0.25 + random() * 0.7).toFixed(2));
    if (random() < 0.18) {
      star
        .attr('class', 'twinkle')
        .style('animation-delay', `${(random() * 4).toFixed(2)}s`)
        .style('animation-duration', `${(2 + random() * 3).toFixed(2)}s`);
    }
  }
}

function eventTitle(id: string): string {
  const key = `event.${id}.title`;
  return isMessageKey(key) ? t(key) : id;
}

function eventLabel(id: string): string {
  const key = `event.${id}.label`;
  return isMessageKey(key) ? t(key) : eventTitle(id);
}

/**
 * Accessible name: the title and age, starting with the visible label when the title does not
 * already contain it, so voice control ("tap T. rex") finds the button.
 */
export function eventName(id: string, ago: string): string {
  const label = eventLabel(id);
  const title = eventTitle(id);
  const named = title.toLowerCase().includes(label.toLowerCase()) ? title : `${label}: ${title}`;
  return `${named}, ${ago}`;
}

interface ButtonOptions {
  /** The exact spot on the spiral. */
  at: Point;
  /** Where to draw the badge, if not on the spot itself; a pointer line then joins the two. */
  badgeAt?: Point;
  size: number;
  /** Seconds before the badge pops in. */
  delay: number;
  /** Put the label on the side facing away from this point (a crowded centre). */
  labelAwayFrom?: Point;
  /** Screen width, so labels never run off the edge. */
  screenWidth: number;
  onSelect: (marker: EventMarker) => void;
}

/** A tappable badge for one event. */
function eventButton(g: Group, marker: EventMarker, options: ButtonOptions): void {
  const { at, size, delay, onSelect } = options;
  const badgeAt = options.badgeAt ?? at;
  const ago = formatAgo(resolveAge(findEvent(marker.id)));
  if (options.badgeAt) {
    g.append('line')
      .attr('class', 'pointer fade-in')
      .attr('x1', px(at.x))
      .attr('y1', px(at.y))
      .attr('x2', px(badgeAt.x))
      .attr('y2', px(badgeAt.y))
      .attr('stroke', marker.ring)
      .style('animation-delay', `${delay.toFixed(2)}s`);
    g.append('circle')
      .attr('class', 'pointer-dot')
      .attr('cx', px(at.x))
      .attr('cy', px(at.y))
      .attr('r', 3.5)
      .attr('fill', marker.ring);
  }
  const button = g
    .append('g')
    .attr('class', 'event')
    .attr('data-event', marker.id)
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', eventName(marker.id, ago))
    .attr('transform', `translate(${px(badgeAt.x)},${px(badgeAt.y)})`)
    .on('click', () => {
      onSelect(marker);
    })
    .on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(marker);
      }
    });
  const pop = button
    .append('g')
    .attr('class', 'pop')
    .style('animation-delay', `${delay.toFixed(2)}s`);
  // Invisible hit area: at least 48 × 48 px even when the badge is drawn smaller.
  pop
    .append('circle')
    .attr('r', Math.max(24, size / 2 + 4))
    .attr('fill', 'transparent');
  pop
    .append('circle')
    .attr('class', 'focus-ring')
    .attr('r', size / 2 + 7);
  drawBadge(pop, marker.art, size, marker.ring);
  const text = eventLabel(marker.id);
  const label = pop.append('text').attr('class', 'event-label').text(text);
  placeLabel(label, text, badgeAt, options);
}

/** Rough width of a label in the 14 px label font, to keep it on screen. */
const labelWidth = (text: string): number => text.length * 7.8;

/**
 * Puts a badge's label below it or, given a crowded centre to avoid, on the side facing away from
 * it so labels never pile up in the middle. Falls back to below when a side label would leave the
 * screen.
 */
function placeLabel(
  label: Selection<SVGTextElement, unknown, null, undefined>,
  text: string,
  badgeAt: Point,
  { size, labelAwayFrom, screenWidth }: ButtonOptions,
): void {
  const below = (): void => {
    label.attr('y', size / 2 + 18);
  };
  if (!labelAwayFrom) {
    below();
    return;
  }
  const dx = badgeAt.x - labelAwayFrom.x;
  const dy = badgeAt.y - labelAwayFrom.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const gap = size / 2 + 10;
  const fits =
    ux > 0
      ? badgeAt.x + gap + labelWidth(text) < screenWidth - 4
      : badgeAt.x - gap - labelWidth(text) > 4;
  if (Math.abs(ux) > 0.5 && fits) {
    label
      .attr('x', ux * gap)
      .attr('y', uy * gap + 5)
      .style('text-anchor', ux > 0 ? 'start' : 'end');
  } else if (uy < 0) {
    label.attr('y', -size / 2 - 10);
  } else {
    below();
  }
}

/** Renders the whole Deep Time Spiral scene into `container`. */
export function renderScene(container: HTMLElement, options: SceneOptions): SceneInfo {
  const { width, height, onSelect } = options;
  const layout = computeLayout(width, height);
  const { main, lens } = layout;

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
  const sky = svg.append('g').attr('class', 'sky').attr('aria-hidden', 'true');
  sky
    .append('ellipse')
    .attr('cx', main.x)
    .attr('cy', main.y)
    .attr('rx', main.r * 1.25)
    .attr('ry', main.r * 0.95)
    .attr('fill', 'url(#nebula-violet)');
  sky
    .append('ellipse')
    .attr('cx', lens.x)
    .attr('cy', lens.y)
    .attr('rx', lens.r * 1.3)
    .attr('ry', lens.r * 1.1)
    .attr('fill', 'url(#nebula-teal)');
  starField(sky, width, height);

  // Time spans: the main spiral runs from now back to the Big Bang; the lens shows the Phanerozoic.
  const bigBang = resolveAge(findEvent('big-bang')).years;
  const phanerozoic = unit('Phanerozoic').begin.ma * 1e6;
  const mainSpiral: EvenSpiral = { turns: main.turns, outerRadius: main.r };
  const lensSpiral: EvenSpiral = { turns: lens.turns, outerRadius: lens.spiralRadius };
  const mainFrame: SpiralFrame = {
    spiral: mainSpiral,
    center: { x: main.x, y: main.y },
    mapping: linearMapping(bigBang),
    length: evenSpiralLength(mainSpiral),
  };
  const lensFrame: SpiralFrame = {
    spiral: lensSpiral,
    center: { x: lens.x, y: lens.y },
    mapping: linearMapping(phanerozoic),
    length: evenSpiralLength(lensSpiral),
  };
  const zoom = lensFrame.length / phanerozoic / (mainFrame.length / bigBang);

  // Magnifier around the Phanerozoic (the middle of the main spiral) and the beam to the lens.
  const uPhanerozoic = mainFrame.mapping.toUnit(phanerozoic);
  const magnifier = {
    x: main.x,
    y: main.y,
    r: evenSpiralPoint(uPhanerozoic, mainSpiral).r + main.ribbon / 2 + 6,
  };
  const beam = beamPolygon(magnifier, lens);
  const zoomLayer = svg.append('g').attr('class', 'zoom fade-in').attr('aria-hidden', 'true');
  zoomLayer.style('animation-delay', '0.3s');
  if (beam.length > 0) {
    zoomLayer
      .append('polygon')
      .attr('points', beam.map(([x, y]) => `${px(x)},${px(y)}`).join(' '))
      .attr('fill', 'url(#beam)');
  }

  // Main spiral ribbon: cosmos before Earth, then the four eons in their ICS colours.
  const mainRibbon = svg.append('g').attr('class', 'ribbon').attr('filter', 'url(#glow)');
  mainRibbon.attr('aria-hidden', 'true');
  const toU = (years: number): number => mainFrame.mapping.toUnit(Math.min(years, bigBang));
  const earthStart = unit('Hadean').begin.ma * 1e6;
  const stretches = [
    ...unitsOfRank('eon').map((eon) => ({
      young: eon.end.ma * 1e6,
      old: eon.begin.ma * 1e6,
      color: eon.color,
    })),
    { young: earthStart, old: bigBang, color: 'url(#cosmos)' },
  ].sort((a, b) => a.young - b.young);
  for (const s of stretches) {
    const u0 = toU(s.young);
    const u1 = toU(s.old);
    ribbonSegment(mainRibbon, mainFrame, u0, u1, s.color, main.ribbon, {
      delay: u0 * DRAW_SECONDS,
      duration: (u1 - u0) * DRAW_SECONDS,
    });
  }
  // A soft glow where it all began, at the outer end of the main spiral.
  const start = pointAt(mainFrame, 1);
  svg
    .insert('circle', '.ribbon')
    .attr('class', 'big-bang-glow')
    .attr('cx', px(start.x))
    .attr('cy', px(start.y))
    .attr('r', px(main.badge * 1.6))
    .attr('fill', 'url(#big-bang-glow)')
    .attr('aria-hidden', 'true');

  const nowDot = svg.append('g').attr('aria-hidden', 'true');
  nowDot
    .append('circle')
    .attr('class', 'pulse')
    .attr('cx', main.x)
    .attr('cy', main.y)
    .attr('r', 9)
    .attr('fill', '#ffd166');

  zoomLayer
    .append('circle')
    .attr('class', 'magnifier')
    .attr('cx', magnifier.x)
    .attr('cy', magnifier.y)
    .attr('r', magnifier.r);

  // The lens: a glass disc with the Phanerozoic spiral inside, coloured by ICS period.
  const lensGroup = svg.append('g').attr('class', 'lens fade-in').style('animation-delay', '0.3s');
  lensGroup
    .append('circle')
    .attr('cx', lens.x)
    .attr('cy', lens.y)
    .attr('r', lens.r)
    .attr('fill', 'url(#lens-glass)')
    .attr('class', 'lens-rim');
  const lensRibbon = lensGroup.append('g').attr('class', 'ribbon').attr('filter', 'url(#glow)');
  lensRibbon.attr('aria-hidden', 'true');
  const periods = unitsOfRank('period').filter((p) => p.begin.ma <= unit('Phanerozoic').begin.ma);
  const lensStart = 0.5;
  const lensSeconds = DRAW_SECONDS - 0.6;
  for (const period of [...periods].reverse()) {
    const u0 = lensFrame.mapping.toUnit(period.end.ma * 1e6);
    const u1 = lensFrame.mapping.toUnit(period.begin.ma * 1e6);
    ribbonSegment(lensRibbon, lensFrame, u0, u1, period.color, lens.ribbon, {
      delay: lensStart + u0 * lensSeconds,
      duration: (u1 - u0) * lensSeconds,
    });
  }

  // "You are here" at the very middle of the lens.
  const you = lensGroup.append('g').attr('aria-hidden', 'true');
  you
    .append('circle')
    .attr('class', 'pulse')
    .attr('cx', lens.x)
    .attr('cy', lens.y)
    .attr('r', 10)
    .attr('fill', '#ffd166');
  you
    .append('text')
    .attr('class', 'you-label')
    .attr('x', lens.x)
    .attr('y', lens.y + Math.max(36, lens.spiralRadius * 0.25))
    .text(t('spiral.you'));

  // Zoom badge and caption on the lens rim.
  const zoomText = String(Math.max(2, Math.round(zoom)));
  const span = formatSpanMillions(phanerozoic);
  lensGroup.attr('aria-label', t('lens.label', { zoom: zoomText, span })).attr('role', 'group');
  const pill = (y: number, text: string, cls: string): void => {
    const p = lensGroup.append('g').attr('class', cls).attr('aria-hidden', 'true');
    const w = Math.max(84, text.length * 8.6 + 28);
    p.append('rect')
      .attr('x', lens.x - w / 2)
      .attr('y', y - 15)
      .attr('width', w)
      .attr('height', 30)
      .attr('rx', 15);
    p.append('text')
      .attr('x', lens.x)
      .attr('y', y + 5)
      .text(text);
  };
  pill(lens.y - lens.r, t('lens.title', { zoom: zoomText }), 'pill pill-zoom');
  pill(lens.y + lens.r, t('lens.caption', { span }), 'pill');

  // Event badges, popping in as the ribbon reaches them.
  const badges = svg.append('g').attr('class', 'events');
  for (const marker of MAIN_EVENTS) {
    const u = toU(resolveAge(findEvent(marker.id)).years);
    eventButton(badges, marker, {
      at: pointAt(mainFrame, u),
      size: main.badge,
      delay: u * DRAW_SECONDS,
      screenWidth: width,
      onSelect,
    });
  }
  const lensCenter = { x: lens.x, y: lens.y };
  for (const marker of LENS_EVENTS) {
    const u = lensFrame.mapping.toUnit(resolveAge(findEvent(marker.id)).years);
    const at = pointAt(lensFrame, u);
    const atRim = Math.hypot(at.x - lens.x, at.y - lens.y) > lens.spiralRadius * 0.85;
    eventButton(badges, marker, {
      at,
      // People are so close to now that their spot is inside the "you are here" dot:
      // draw their badge off to the side with a pointer to the exact place.
      ...(marker.id === 'first-people' && {
        badgeAt: { x: lens.x + lens.spiralRadius * 0.34, y: lens.y - lens.spiralRadius * 0.3 },
      }),
      size: lens.badge,
      delay: lensStart + u * lensSeconds + 0.1,
      // Labels face away from the crowded middle, except at the rim where they would leave the lens.
      ...(!atRim && { labelAwayFrom: lensCenter }),
      screenWidth: width,
      onSelect,
    });
  }

  return { layout, zoom };
}
