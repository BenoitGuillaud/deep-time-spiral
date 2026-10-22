import { line, range, select } from 'd3';
import { polarToCartesian, unitToPolar, type Point, type SpiralShape } from '../geometry/spiral';
import { t } from '../i18n/i18n';

const SHAPE: SpiralShape = { turns: 3, innerRadius: 0, outerRadius: 420 };
const SAMPLES = 600;
const MARGIN = 80;

/** Draws the "hello spiral": the path from Now (centre) out to long ago (outer end). */
export function renderSpiral(container: HTMLElement): void {
  const half = SHAPE.outerRadius + MARGIN;
  const svg = select(container)
    .append('svg')
    .attr('class', 'spiral')
    .attr('viewBox', `${String(-half)} ${String(-half)} ${String(2 * half)} ${String(2 * half)}`)
    .attr('role', 'img')
    .attr('aria-labelledby', 'spiral-title');

  svg.append('title').attr('id', 'spiral-title').text(t('spiral.label'));

  const points = range(SAMPLES + 1).map((i) => polarToCartesian(unitToPolar(i / SAMPLES, SHAPE)));
  const path = line<Point>()
    .x((p) => p.x)
    .y((p) => p.y);
  svg
    .append('path')
    .attr('class', 'spiral-path')
    .attr('pathLength', 1)
    .attr('d', path(points) ?? '');

  const now = svg.append('g').attr('class', 'now');
  now.append('circle').attr('class', 'now-glow').attr('r', 30);
  now.append('circle').attr('class', 'now-dot').attr('r', 14);
  now.append('text').attr('class', 'now-label').attr('y', 66).text(t('spiral.now'));

  const end = polarToCartesian(unitToPolar(1, SHAPE));
  svg
    .append('text')
    .attr('class', 'long-ago-label')
    .attr('x', end.x)
    .attr('y', end.y - 30)
    .text(t('spiral.longAgo'));
}
