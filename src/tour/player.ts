import { journeyLength, journeyState, type JourneyState, type JourneyStep } from './journey';

/** Plays the journey's steps on the animation clock, handing each frame's state to the views. */

export interface JourneyPlayer {
  /** Milliseconds played so far. */
  elapsed(): number;
  /** Jumps to the end (and finishes). */
  skip(): void;
}

/**
 * The journey's own clock. It follows real time, but:
 * - it never moves past the end of a step while `busy` (the voice is still reading), so the spark
 *   waits for the words;
 * - it crosses at most one step boundary per frame, so every stop and its caption is shown, even
 *   on a slow device.
 * Pure, for tests.
 */
export function advanceClock(
  steps: JourneyStep[],
  elapsed: number,
  dt: number,
  busy = false,
): number {
  const next = elapsed + Math.max(0, dt);
  let end = 0;
  for (const [i, step] of steps.entries()) {
    end += step.ms;
    if (elapsed < end) {
      if (busy) return Math.min(next, end - 1e-3);
      const following = steps[i + 1];
      return following ? Math.min(next, end + following.ms - 1e-3) : next;
    }
  }
  return next;
}

export function playJourney(
  steps: JourneyStep[],
  onFrame: (state: JourneyState) => void,
  onDone: () => void,
  busy: () => boolean = () => false,
): JourneyPlayer {
  const total = journeyLength(steps);
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let finished = false;
  const tick = (): void => {
    raf = 0;
    const now = performance.now();
    elapsed = advanceClock(steps, elapsed, now - last, busy());
    last = now;
    const state = journeyState(steps, elapsed);
    onFrame(state);
    if (state.done) {
      finished = true;
      onDone();
    } else {
      raf = requestAnimationFrame(tick);
    }
  };
  tick();
  return {
    elapsed: () => Math.min(total, elapsed),
    skip() {
      if (finished) return;
      cancelAnimationFrame(raf);
      elapsed = total;
      last = performance.now();
      tick();
    },
  };
}
