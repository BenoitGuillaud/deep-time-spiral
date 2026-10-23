import './styles.css';
import { t } from './i18n/i18n';
import { event as findEvent, resolveAge } from './data';
import { CORKSCREW, createHelixPath } from './geometry/helix';
import { formatAgo } from './render/format';
import { renderHelix2d, type Reveal2d } from './render/helix-2d';
import type { HelixView } from './render3d/helix-view';
import { webglAvailable } from './render3d/support';
import {
  buildJourney,
  journeyHighlights,
  type JourneyState,
  type JourneyStep,
} from './tour/journey';
import { playJourney, type JourneyPlayer } from './tour/player';
import { createCard, flagCard } from './ui/card';
import { createJourneyPanel } from './ui/journey-panel';
import { createViewBar } from './ui/view-bar';

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector} element`);
  return element;
}

const app = required('#app');

document.title = t('app.title');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(window.location.search);
// ?view=2d stays flat; ?view=3d forces 3D even on software WebGL.
const requested = params.get('view');
// ?journey=0 opens straight on the spiral; ?journey=fast plays it 12× faster (both for tests).
const journeyParam = params.get('journey');
const JOURNEY_SPEED = journeyParam === 'fast' ? 12 : 1;
/** How long the 2D view plays alone (the journey's opening, or the draw-in) before 3D takes over. */
const INTRO_2D_MS = 3000;

// The whole story, Now → Big Bang. (The Zoom Ladder, M3, will change this span.)
const spanYears = resolveAge(findEvent('big-bang')).years;
const helixPath = createHelixPath(CORKSCREW);

const header = document.createElement('header');
header.className = 'masthead';
const heading = document.createElement('h1');
heading.textContent = t('app.title');
const tagline = document.createElement('p');
tagline.textContent = t('app.tagline');
header.append(heading, tagline);

// Two layers: the 2D SVG scene paints first and stays as the fallback; the 3D view fades in on top.
const stage2d = document.createElement('div');
stage2d.className = 'stage stage-2d';
const stage3d = document.createElement('div');
stage3d.className = 'stage stage-3d';
stage3d.hidden = true;
const flash = document.createElement('div');
flash.className = 'journey-flash';
flash.setAttribute('aria-hidden', 'true');

// The data (ICS) and some pictures (PhyloPic) are CC BY: credit them from the app itself.
// A full credits page comes in M6.
const credits = document.createElement('a');
credits.className = 'credits-link';
credits.href = 'https://github.com/BenoitGuillaud/deep-time-spiral/blob/main/CREDITS.md';
credits.target = '_blank';
credits.rel = 'noopener';
credits.textContent = t('app.credits');

const openCard = createCard(document.body);
let view3d: HelixView | null = null;
let has3d = false;
const bar = createViewBar({
  onView: (view) => view3d?.setView(view),
  onMove: (on) => view3d?.setMoveMode(on),
  onToggle: () => {
    if (app.dataset.view === '3d') show2d();
    else void show3d();
  },
  onJourney: () => {
    startJourney();
  },
});
bar.element.hidden = true;

app.append(header, stage2d, stage3d, flash, bar.element, credits);
app.dataset.view = '2d';

interface RunningJourney {
  steps: JourneyStep[];
  /** Null when stepping through with Next (reduced motion). */
  player: JourneyPlayer | null;
  state: JourneyState | null;
  skip: () => void;
  next: () => void;
}
// The journey in progress, if any, and the screen space its panel covers.
let journey: RunningJourney | null = null;
let inset = { right: 0, bottom: 0 };
const panel = createJourneyPanel(app, {
  onSkip: () => journey?.skip(),
  onNext: () => journey?.next(),
});

let drawn = { width: 0, height: 0 };
// During the journey in 2D: shows the ribbon and pictures as the spark reaches them.
let reveal2d: Reveal2d | null = null;
function draw2d(animate: boolean, force = false): void {
  const width = stage2d.clientWidth;
  const height = stage2d.clientHeight;
  // Phone address bars grow and shrink while scrolling; ignore those small changes.
  if (!force && Math.abs(width - drawn.width) < 2 && Math.abs(height - drawn.height) < 60) return;
  drawn = { width, height };
  stage2d.replaceChildren();
  // During the journey, the 2D spiral is revealed as the spark goes, beside the panel.
  const steps = journey?.player ? journey.steps : null;
  const elapsed = journey?.player?.elapsed() ?? 0;
  reveal2d = renderHelix2d(stage2d, {
    width,
    height,
    spanYears,
    animate: animate || steps !== null,
    onSelect: (flag) => {
      openCard(flagCard(flag));
    },
    // Beside the caption panel while it shows (also when stepping through with Next).
    ...(journey && { inset: panel.inset() }),
    ...(steps && {
      journey: {
        highlights: journeyHighlights(steps).map((h) => ({
          from: h.from,
          to: h.to,
          start: (h.start - elapsed) / 1000,
          seconds: h.ms / 1000,
        })),
      },
    }),
  });
  if (reveal2d && journey?.state) reveal2d(journey.state.f, journey.state.popped);
}

function show2d(): void {
  stage2d.hidden = false;
  draw2d(false, true);
  stage3d.hidden = true;
  stage3d.classList.remove('shown');
  app.dataset.view = '2d';
  bar.setMode('2d', has3d);
}

async function show3d(): Promise<void> {
  stage3d.hidden = false;
  if (view3d) {
    view3d.resize();
  } else {
    const { mountHelixView } = await import('./render3d/helix-view');
    view3d = await mountHelixView(stage3d, {
      onSelect: (flag) => {
        openCard(flagCard(flag));
      },
      reducedMotion,
    });
  }
  // Joining a journey already under way: draw its current moment before fading in.
  if (journey?.state) view3d.journey({ ...journey.state, inset });
  // Cross-fade: the 2D corkscrew stays visible underneath while the 3D one fades in on top.
  // Measuring the layer first makes the browser apply the starting opacity, so the fade runs
  // without waiting for an animation frame.
  stage3d.getBoundingClientRect();
  stage3d.classList.add('shown');
  window.setTimeout(
    () => {
      if (app.dataset.view === '3d') stage2d.hidden = true;
    },
    reducedMotion ? 0 : 900,
  );
  app.dataset.view = '3d';
  bar.setMode('3d', has3d);
}

/**
 * The landing journey: a spark draws the corkscrew from Now back to the Big Bang while the panel
 * explains each stop. With reduced motion, everything is drawn at once and the child steps through
 * the captions with Next.
 */
function startJourney(): void {
  if (journey) return;
  const steps = buildJourney(helixPath, spanYears, JOURNEY_SPEED);
  app.classList.add('journeying');
  bar.element.hidden = true;
  panel.show(reducedMotion ? 'steps' : 'auto');

  const finish = (): void => {
    journey = null;
    app.classList.remove('journeying');
    panel.hide();
    panel.setCounter(null);
    flash.style.opacity = '0';
    view3d?.journey(null);
    if (app.dataset.view === '2d') draw2d(false, true);
    bar.element.hidden = false;
    bar.setMode(app.dataset.view === '3d' ? '3d' : '2d', has3d);
  };

  if (reducedMotion) {
    const captions = steps.flatMap((step) => (step.caption ? [step.caption] : []));
    let index = 0;
    panel.setCaption(captions[0]);
    journey = {
      steps,
      player: null,
      state: null,
      skip: finish,
      next: () => {
        index += 1;
        if (index >= captions.length) finish();
        else panel.setCaption(captions[index]);
      },
    };
    if (app.dataset.view === '2d') draw2d(false, true);
    return;
  }

  const running: RunningJourney = {
    steps,
    player: null,
    state: null,
    skip: () => running.player?.skip(),
    next: () => undefined,
  };
  journey = running;
  // Measured once (and again on resize), not every frame: measuring forces a layout.
  inset = panel.inset();
  let flashShown = 0;
  running.player = playJourney(
    steps,
    (state) => {
      running.state = state;
      panel.setCaption(state.caption);
      panel.setCounter(
        state.travelling ? formatAgo({ years: state.f * spanYears, qualifier: 'exact' }) : null,
      );
      const glare = Math.round(state.flash * 0.75 * 100) / 100;
      if (glare !== flashShown) flash.style.opacity = String((flashShown = glare));
      if (app.dataset.view === '3d') view3d?.journey({ ...state, inset });
      else reveal2d?.(state.f, state.popped);
    },
    finish,
  );
  if (app.dataset.view === '2d') draw2d(true, true);
}

const playJourneyOnLanding = journeyParam !== '0';
if (playJourneyOnLanding) startJourney();
else draw2d(true);

// Upgrade to 3D, in idle time, if the browser draws WebGL with real graphics hardware. (Even the
// check is slow where WebGL is drawn in software, so it must not hold up the first paint.) During
// the journey this happens in its quiet opening, and the 3D view joins it where it has got to.
if (requested !== '2d') {
  const start = (): void => {
    has3d = webglAvailable(requested === '3d');
    if (!journey) bar.element.hidden = false;
    bar.setMode('2d', has3d);
    if (!has3d) return;
    show3d().catch((error: unknown) => {
      console.warn('3D view unavailable, staying in 2D', error);
      has3d = false;
      show2d();
    });
  };
  // Older Safari has no requestIdleCallback.
  const win: Partial<Window> = window;
  const whenIdle = (): void => {
    if (win.requestIdleCallback) win.requestIdleCallback(start, { timeout: 1500 });
    else start();
  };
  // Waiting until the journey's quiet opening is over keeps the 3D set-up (heavy) out of the first,
  // most important seconds; the 3D view then joins the journey where it has got to.
  const wait = reducedMotion || requested === '3d' ? 0 : INTRO_2D_MS;
  window.setTimeout(whenIdle, wait);
} else {
  bar.element.hidden = playJourneyOnLanding;
  bar.setMode('2d', false);
}

let timer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (journey) inset = panel.inset();
    if (app.dataset.view === '3d') view3d?.resize();
    else draw2d(false);
  }, 150);
});
