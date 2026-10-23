import './styles.css';
import { t } from './i18n/i18n';
import { renderScene } from './render/scene';
import { createCard } from './ui/card';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element');

document.title = t('app.title');

const header = document.createElement('header');
header.className = 'masthead';
const heading = document.createElement('h1');
heading.textContent = t('app.title');
const tagline = document.createElement('p');
tagline.textContent = t('app.tagline');
header.append(heading, tagline);

const stage = document.createElement('div');
stage.className = 'stage';
// The data (ICS) and some pictures (PhyloPic) are CC BY: credit them from the app itself.
// A full credits page comes in M6.
const credits = document.createElement('a');
credits.className = 'credits-link';
credits.href = 'https://github.com/BenoitGuillaud/deep-time-spiral/blob/main/CREDITS.md';
credits.target = '_blank';
credits.rel = 'noopener';
credits.textContent = t('app.credits');

app.append(header, stage, credits);

const openCard = createCard(document.body);

let drawn = { width: 0, height: 0 };
function draw(animate: boolean): void {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  // Phone address bars grow and shrink while scrolling; ignore those small changes.
  if (Math.abs(width - drawn.width) < 2 && Math.abs(height - drawn.height) < 60) return;
  drawn = { width, height };
  stage.replaceChildren();
  renderScene(stage, { width, height, animate, onSelect: openCard });
}

draw(true);
let timer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    draw(false);
  }, 150);
});
