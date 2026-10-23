import { describe, expect, it } from 'vitest';
import { event, resolveAge } from '../../src/data';
import { CORKSCREW, createHelixPath } from '../../src/geometry/helix';
import { flagLook, flagsForSpan } from '../../src/render/flags';
import { journeyPose } from '../../src/render3d/camera';
import {
  buildJourney,
  journeyHighlights,
  journeyLength,
  journeyState,
  MS_PER_GYR,
  timeAtFraction,
  timeOfPop,
} from '../../src/tour/journey';

const path = createHelixPath(CORKSCREW);
const span = resolveAge(event('big-bang')).years;
const steps = buildJourney(path, span);

describe('the landing journey', () => {
  it('lasts about 40 seconds', () => {
    expect(journeyLength(steps)).toBeGreaterThan(38_000);
    expect(journeyLength(steps)).toBeLessThan(48_000);
  });

  it('travels from Now to the Big Bang without going back', () => {
    let f = 0;
    for (const step of steps) {
      if (step.kind === 'travel') {
        expect(step.from).toBeCloseTo(f, 12);
        expect(step.to).toBeGreaterThan(step.from);
        f = step.to;
      } else if (step.kind === 'hold') {
        expect(step.f).toBeCloseTo(f, 12);
      }
    }
    expect(f).toBe(1);
  });

  it('travels at one steady speed in time (equal time = equal seconds)', () => {
    for (const step of steps) {
      if (step.kind !== 'travel') continue;
      const gyr = ((step.to - step.from) * span) / 1e9;
      expect(step.ms / gyr).toBeCloseTo(MS_PER_GYR, 6);
    }
  });

  it('pops every flag exactly once, in order from Now to the Big Bang', () => {
    const pops = steps.flatMap((step) => (step.kind === 'hold' && step.pop ? [step.pop] : []));
    expect(pops).toEqual(flagsForSpan(span).map((flag) => flagLook(flag).id));
    expect(pops.at(-1)).toBe('big-bang');
  });

  it('explains one turn and makes all the dinosaurs glow inside it', () => {
    const turn = steps.find(
      (step) => step.kind === 'hold' && step.caption?.title === 'One turn of the spiral',
    );
    expect(turn?.caption?.text).toContain('1.8 billion years');
    const dinosaurs = journeyHighlights(steps).find((h) => h.from > 0);
    expect(dinosaurs?.from).toBeCloseTo(resolveAge(event('last-dinosaurs')).years / span, 9);
    expect(dinosaurs?.to).toBeCloseTo(resolveAge(event('first-dinosaurs')).years / span, 9);
  });

  it('counts the time before the Earth from the cited ages', () => {
    const last = steps.findLast((step) => step.kind === 'travel');
    expect(last?.caption?.text).toContain('9.2 billion years');
  });

  it('ends with everything drawn and popped, and flashes only at the Big Bang', () => {
    const end = journeyState(steps, journeyLength(steps));
    expect(end.done).toBe(true);
    expect(end.f).toBe(1);
    expect(end.finale).toBe(1);
    expect(end.popped).toHaveLength(flagsForSpan(span).length);
    const bang = timeOfPop(steps, 'big-bang');
    expect(journeyState(steps, bang - 100).flash).toBe(0);
    expect(journeyState(steps, bang + 200).flash).toBeGreaterThan(0.5);
  });

  it('shows a picture only once the spark has reached it', () => {
    const firstLife = timeOfPop(steps, 'first-life');
    expect(journeyState(steps, firstLife - 50).popped).not.toContain('first-life');
    expect(journeyState(steps, firstLife + 50).popped).toContain('first-life');
    expect(timeAtFraction(steps, 0.5)).toBeLessThan(timeAtFraction(steps, 0.9));
  });

  it('plays faster for tests', () => {
    expect(journeyLength(buildJourney(path, span, 10))).toBeCloseTo(journeyLength(steps) / 10, 6);
  });
});

describe('journeyPose', () => {
  const samples = Array.from({ length: 2001 }, (_, i) => i / 2000);

  it.each([1.4, 0.7])('moves smoothly with the spark (aspect %d)', (aspect) => {
    let previous = journeyPose(path, 0, aspect);
    for (const f of samples.slice(1)) {
      const pose = journeyPose(path, f, aspect);
      const jump = Math.hypot(
        pose.position.x - previous.position.x,
        pose.position.y - previous.position.y,
        pose.position.z - previous.position.z,
      );
      expect(jump, `at ${String(f)}`).toBeLessThan(0.05);
      previous = pose;
    }
  });

  it('never puts the camera inside the ribbon', () => {
    const ribbon = Array.from({ length: 4001 }, (_, i) => path.pointAt(i / 4000));
    for (const f of samples.filter((_, i) => i % 20 === 0)) {
      const { position } = journeyPose(path, f, 1.2);
      const nearest = Math.min(
        ...ribbon.map((p) => Math.hypot(p.x - position.x, p.y - position.y, p.z - position.z)),
      );
      expect(nearest, `at ${String(f)}`).toBeGreaterThan(0.12);
    }
  });
});
