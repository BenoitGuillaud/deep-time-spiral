import { event as findEvent, resolveAge } from '../data';
import type { HelixPath } from '../geometry/helix';
import { t } from '../i18n/i18n';
import { flagLook, flagsForSpan } from '../render/flags';
import { formatSpan } from '../render/format';
import { spanBands } from '../render/span-colours';
import { clusterCard, eventCard } from '../ui/card';

/**
 * The landing journey: a spark draws the corkscrew from Now back to the Big Bang, stopping at each
 * picture to explain it. Time passes at one steady speed while it travels (equal time = equal
 * seconds), so people and dinosaurs flash by and the long time before the Earth takes ages: that
 * is the point. Pure: a list of steps and the state at any moment, no DOM.
 */

/** Travel speed: milliseconds of journey per billion years. */
export const MS_PER_GYR = 1000;
const OPEN_MS = 3000;
const STOP_MS = 4500;
const TURN_MS = 5000;
const FINALE_MS = 3000;

export interface Caption {
  title?: string;
  age?: string;
  text: string;
}

export type JourneyStep =
  | {
      kind: 'hold';
      /** Where the spark waits (fraction of the path). */
      f: number;
      ms: number;
      caption?: Caption;
      /** A flag (`data-event` id) that pops up at the start of this stop. */
      pop?: string;
      /** A stretch of ribbon (fractions) that pulses during this stop. */
      highlight?: [number, number];
      /** The Big Bang's flash of light. */
      flash?: boolean;
    }
  | { kind: 'travel'; from: number; to: number; ms: number; caption?: Caption }
  /** The camera pulls out to the whole view. */
  | { kind: 'finale'; ms: number; caption: Caption };

const yearsOf = (id: string): number => resolveAge(findEvent(id)).years;

/** The steps of the journey through a corkscrew showing `spanYears` (Now → the Big Bang). */
export function buildJourney(path: HelixPath, spanYears: number, speed = 1): JourneyStep[] {
  const steps: JourneyStep[] = [];
  const ms = (n: number): number => n / speed;
  const travelMs = (from: number, to: number): number =>
    ms((((to - from) * spanYears) / 1e9) * MS_PER_GYR);
  const at = (years: number): number => Math.min(1, years / spanYears);
  let f = 0;
  const travel = (to: number, caption?: Caption): void => {
    if (to <= f) return;
    steps.push({ kind: 'travel', from: f, to, ms: travelMs(f, to), ...(caption && { caption }) });
    f = to;
  };

  steps.push({ kind: 'hold', f: 0, ms: ms(OPEN_MS), caption: { text: t('journey.now') } });

  const flags = flagsForSpan(spanYears);
  const cluster = flags.find((flag) => flag.kind === 'cluster');
  if (cluster) {
    // Its flag stands at Now, but it covers everything back to its oldest member: draw that bit.
    const end = at(cluster.years);
    travel(end);
    const card = clusterCard(cluster.members, cluster.years);
    steps.push({
      kind: 'hold',
      f,
      ms: ms(STOP_MS),
      pop: 'cluster',
      highlight: [0, end],
      caption: { title: card.title, age: card.age, text: card.text },
    });
  }

  // What one turn means: the whole top coil, with all the dinosaurs glowing in a little slice of it.
  // (Computed from the cited ages and the geometry, not a new fact.)
  const turn = path.fractionAtTurn(1);
  const next = flags.find((flag) => flag.kind === 'event' && flag.f > f);
  if (turn > f && (!next || turn < next.f)) {
    travel(turn);
    const dinosaurs: [number, number] = [
      at(yearsOf('last-dinosaurs')),
      at(yearsOf('first-dinosaurs')),
    ];
    steps.push({
      kind: 'hold',
      f,
      ms: ms(TURN_MS),
      ...(dinosaurs[1] <= 1 && { highlight: dinosaurs }),
      caption: {
        title: t('journey.turn.title'),
        text: t('journey.turn.text', { span: formatSpan(turn * spanYears) }),
      },
    });
  }

  // The time before the Earth: no ICS colour, only stardust. Travelling through it gets captions.
  const cosmos = spanBands(spanYears).find((band) => band.unitId === null);
  for (const flag of flags) {
    if (flag.kind !== 'event') continue;
    if (cosmos && f >= cosmos.from - 1e-9 && flag.f > f) {
      const [from, to] = [f, flag.f];
      const span = formatSpan((to - from) * spanYears);
      travel(from + (to - from) / 3, { text: t('journey.cosmos.1') });
      travel(from + ((to - from) * 2) / 3, { text: t('journey.cosmos.2') });
      travel(to, { text: t('journey.cosmos.3', { span }) });
    } else {
      travel(flag.f);
    }
    const card = eventCard(flag.marker);
    const beforeEarth = cosmos !== undefined && Math.abs(flag.f - cosmos.from) < 1e-6;
    steps.push({
      kind: 'hold',
      f,
      ms: ms(STOP_MS),
      pop: flagLook(flag).id,
      ...(flag.f >= 1 && { flash: true }),
      caption: {
        title: card.title,
        age: card.age,
        text: beforeEarth ? `${card.text} ${t('journey.noEarth')}` : card.text,
      },
    });
  }

  steps.push({ kind: 'finale', ms: ms(FINALE_MS), caption: { text: t('journey.end') } });
  return steps;
}

export function journeyLength(steps: JourneyStep[]): number {
  return steps.reduce((sum, step) => sum + step.ms, 0);
}

/** Everything the views need to draw one moment of the journey. */
export interface JourneyState {
  /** Index of the current step. */
  step: number;
  /** How far the spark has drawn the ribbon (fraction of the path). */
  f: number;
  /** The latest caption, and the index of the step that set it (to notice a change). */
  caption: Caption | undefined;
  captionStep: number;
  /** Flags popped so far. */
  popped: string[];
  highlight: [number, number] | null;
  /** Milliseconds since the current step started. */
  stepMs: number;
  travelling: boolean;
  /** The Big Bang's flash, 0 → 1 → 0. */
  flash: number;
  /** How far the camera has pulled out to the whole view, 0 → 1. */
  finale: number;
  done: boolean;
}

/** The state `elapsed` milliseconds into the journey. */
export function journeyState(steps: JourneyStep[], elapsed: number): JourneyState {
  const state: JourneyState = {
    step: 0,
    f: 0,
    caption: undefined,
    captionStep: -1,
    popped: [],
    highlight: null,
    stepMs: 0,
    travelling: false,
    flash: 0,
    finale: 0,
    done: false,
  };
  let start = 0;
  for (const [i, step] of steps.entries()) {
    const local = elapsed - start;
    if (local < 0) break;
    const progress = step.ms > 0 ? Math.min(1, local / step.ms) : 1;
    state.step = i;
    state.stepMs = local;
    state.highlight = null;
    state.travelling = false;
    state.flash = 0;
    if (step.caption) {
      state.caption = step.caption;
      state.captionStep = i;
    }
    if (step.kind === 'travel') {
      state.f = step.from + (step.to - step.from) * progress;
      state.travelling = progress < 1;
    } else if (step.kind === 'hold') {
      state.f = step.f;
      if (step.pop && !state.popped.includes(step.pop)) state.popped.push(step.pop);
      if (step.highlight) state.highlight = step.highlight;
      // A quick burst of light that fades over the first half of the stop.
      if (step.flash)
        state.flash = progress < 0.06 ? progress / 0.06 : Math.max(0, 1 - (progress - 0.06) / 0.5);
    } else {
      state.f = 1;
      state.finale = progress;
    }
    start += step.ms;
  }
  state.done = elapsed >= journeyLength(steps);
  return state;
}

/** Milliseconds into the journey when the spark reaches `f` (for the 2D view's timed drawing). */
export function timeAtFraction(steps: JourneyStep[], f: number): number {
  let start = 0;
  for (const step of steps) {
    if (step.kind === 'travel' && f <= step.to) {
      return start + (step.ms * Math.max(0, f - step.from)) / (step.to - step.from);
    }
    start += step.ms;
  }
  return start;
}

/** Milliseconds into the journey when a flag pops up. */
export function timeOfPop(steps: JourneyStep[], id: string): number {
  let start = 0;
  for (const step of steps) {
    if (step.kind === 'hold' && step.pop === id) return start;
    start += step.ms;
  }
  return 0;
}

/** Every stretch of ribbon that glows during a stop, with when (ms into the journey) and how long. */
export function journeyHighlights(
  steps: JourneyStep[],
): { from: number; to: number; start: number; ms: number }[] {
  const out: { from: number; to: number; start: number; ms: number }[] = [];
  let start = 0;
  for (const step of steps) {
    if (step.kind === 'hold' && step.highlight) {
      out.push({ from: step.highlight[0], to: step.highlight[1], start, ms: step.ms });
    }
    start += step.ms;
  }
  return out;
}
