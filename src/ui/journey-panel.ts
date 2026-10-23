import { t } from '../i18n/i18n';
import type { Caption } from '../tour/journey';

/**
 * The journey's side panel: one caption at a time, fading in slowly, a "years ago" counter while
 * the spark travels, and a Skip button (or Next, when motion is reduced and the child steps
 * through at their own pace). On the right in landscape, along the bottom in portrait.
 */

export interface JourneyPanel {
  element: HTMLElement;
  show(mode: 'auto' | 'steps'): void;
  setCaption(caption: Caption | undefined): void;
  /** The counter's text, or null to hide it. */
  setCounter(text: string | null): void;
  hide(): void;
  /** Screen space the panel covers, so the views can frame the spiral beside it. */
  inset(): { right: number; bottom: number };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  parent.append(el);
  return el;
}

export function createJourneyPanel(
  parent: HTMLElement,
  handlers: { onSkip: () => void; onNext: () => void },
): JourneyPanel {
  const panel = element('section', 'journey-panel', parent);
  panel.setAttribute('aria-label', t('journey.label'));
  panel.hidden = true;

  // Announced by screen readers as each caption arrives.
  const words = element('div', 'journey-words', panel);
  words.setAttribute('aria-live', 'polite');
  const counter = element('p', 'journey-counter', panel);
  counter.setAttribute('aria-hidden', 'true');

  const buttons = element('div', 'journey-buttons', panel);
  const skip = element('button', 'journey-button journey-skip', buttons);
  skip.type = 'button';
  skip.textContent = t('journey.skip');
  skip.addEventListener('click', handlers.onSkip);
  const next = element('button', 'journey-button journey-next', buttons);
  next.type = 'button';
  next.textContent = t('journey.next');
  next.addEventListener('click', handlers.onNext);

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') handlers.onSkip();
  };

  let shown: Caption | undefined;
  return {
    element: panel,
    show(mode) {
      panel.hidden = false;
      panel.classList.remove('leaving');
      next.hidden = mode === 'auto';
      shown = undefined;
      words.replaceChildren();
      counter.textContent = '';
      window.addEventListener('keydown', onKey);
    },
    setCaption(caption) {
      if (caption === shown || caption === undefined) return;
      shown = caption;
      // A fresh element each time, so the slow fade-in plays again.
      const block = document.createElement('div');
      block.className = 'journey-caption';
      if (caption.title) element('h2', 'journey-title', block).textContent = caption.title;
      if (caption.age) element('p', 'journey-age', block).textContent = caption.age;
      element('p', 'journey-text', block).textContent = caption.text;
      words.replaceChildren(block);
    },
    setCounter(text) {
      // Called every frame: touch the page only when the words change.
      if (text !== null && counter.textContent !== text) counter.textContent = text;
      if (counter.classList.contains('on') !== (text !== null)) counter.classList.toggle('on');
    },
    hide() {
      window.removeEventListener('keydown', onKey);
      panel.classList.add('leaving');
      window.setTimeout(() => {
        if (panel.classList.contains('leaving')) panel.hidden = true;
      }, 700);
    },
    inset() {
      if (panel.hidden) return { right: 0, bottom: 0 };
      const box = panel.getBoundingClientRect();
      const portrait = window.innerHeight >= window.innerWidth; // as in the CSS
      return portrait
        ? { right: 0, bottom: window.innerHeight - box.top }
        : { right: window.innerWidth - box.left, bottom: 0 };
    },
  };
}
