import './styles.css';
import { t } from './i18n/i18n';
import { event as findEvent, resolveAge } from './data';
import { renderHelix2d } from './render/helix-2d';
import type { HelixView } from './render3d/helix-view';
import { webglAvailable } from './render3d/support';
import { createCard, flagCard } from './ui/card';
import { createViewBar } from './ui/view-bar';

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector} element`);
  return element;
}

const app = required('#app');

document.title = t('app.title');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** How long the 2D spiral takes to draw itself in before it lifts into 3D. */
const INTRO_2D_MS = 3000;

const header = document.createElement('header');
header.className = 'masthead';
const heading = document.createElement('h1');
heading.textContent = t('app.title');
const tagline = document.createElement('p');
tagline.textContent = t('app.tagline');
header.append(heading, tagline);

// Two layers: the 2D SVG scene paints first and stays as the fallback; the 3D vortex fades in on top.
const stage2d = document.createElement('div');
stage2d.className = 'stage stage-2d';
const stage3d = document.createElement('div');
stage3d.className = 'stage stage-3d';
stage3d.hidden = true;

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
const bar = createViewBar({
  onView: (view) => view3d?.setView(view),
  onMove: (on) => view3d?.setMoveMode(on),
  onToggle: () => {
    if (app.dataset.view === '3d') show2d();
    else void show3d();
  },
});

app.append(header, stage2d, stage3d, bar.element, credits);
app.dataset.view = '2d';

let drawn = { width: 0, height: 0 };
function draw2d(animate: boolean): void {
  const width = stage2d.clientWidth;
  const height = stage2d.clientHeight;
  // Phone address bars grow and shrink while scrolling; ignore those small changes.
  if (Math.abs(width - drawn.width) < 2 && Math.abs(height - drawn.height) < 60) return;
  drawn = { width, height };
  stage2d.replaceChildren();
  renderHelix2d(stage2d, {
    width,
    height,
    // The whole story, Now → Big Bang. (The Zoom Ladder, M3, will change this span.)
    spanYears: resolveAge(findEvent('big-bang')).years,
    animate,
    onSelect: (flag) => {
      openCard(flagCard(flag));
    },
  });
}

function show2d(): void {
  stage2d.hidden = false;
  draw2d(false);
  stage3d.hidden = true;
  stage3d.classList.remove('shown');
  app.dataset.view = '2d';
  bar.setMode('2d');
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
  bar.setMode('3d');
}

draw2d(true);

// Upgrade to 3D after the 2D spiral has drawn itself in, in idle time, if the browser draws WebGL
// with real graphics hardware. (Even the check is slow where WebGL is drawn in software, so it must
// not hold up the first paint.) ?view=2d stays flat; ?view=3d forces 3D even on software WebGL.
const requested = new URLSearchParams(window.location.search).get('view');
if (requested !== '2d') {
  const start = (): void => {
    if (!webglAvailable(requested === '3d')) return;
    bar.element.hidden = false;
    show3d().catch((error: unknown) => {
      console.warn('3D view unavailable, staying in 2D', error);
      show2d();
    });
  };
  // Older Safari has no requestIdleCallback.
  const win: Partial<Window> = window;
  const whenIdle = (): void => {
    if (win.requestIdleCallback) win.requestIdleCallback(start, { timeout: 1500 });
    else start();
  };
  window.setTimeout(whenIdle, reducedMotion || requested === '3d' ? 0 : INTRO_2D_MS);
}

let timer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (app.dataset.view === '3d') view3d?.resize();
    else draw2d(false);
  }, 150);
});
