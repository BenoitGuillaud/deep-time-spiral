import { journeyLength, journeyState, type JourneyState, type JourneyStep } from './journey';

/** Plays the journey's steps on the animation clock, handing each frame's state to the views. */

export interface JourneyPlayer {
  /** Milliseconds played so far. */
  elapsed(): number;
  /** Jumps to the end (and finishes). */
  skip(): void;
}

export function playJourney(
  steps: JourneyStep[],
  onFrame: (state: JourneyState) => void,
  onDone: () => void,
): JourneyPlayer {
  const total = journeyLength(steps);
  let start = performance.now();
  let raf = 0;
  let finished = false;
  const tick = (): void => {
    raf = 0;
    const state = journeyState(steps, performance.now() - start);
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
    elapsed: () => Math.min(total, performance.now() - start),
    skip() {
      if (finished) return;
      cancelAnimationFrame(raf);
      start = performance.now() - total;
      tick();
    },
  };
}
