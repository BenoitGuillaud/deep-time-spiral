import { select } from 'd3';
import { event as findEvent, resolveAge } from '../data';
import { isMessageKey, t } from '../i18n/i18n';
import { formatAgo } from '../render/format';
import { drawBadge } from '../render/illustrations/icons';
import type { EventMarker } from '../render/events';

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

const message = (key: string): string => (isMessageKey(key) ? t(key) : '');

/** Creates the event card dialog and returns a function that opens it for an event. */
export function createCard(parent: HTMLElement): (marker: EventMarker) => void {
  const dialog = element('dialog', 'card', parent);
  dialog.setAttribute('aria-labelledby', 'card-title');

  const close = element('button', 'card-close', dialog);
  close.type = 'button';
  close.setAttribute('aria-label', t('card.close'));
  close.textContent = '×';
  close.addEventListener('click', () => {
    dialog.close();
  });
  // A tap on the dark backdrop outside the card closes it too.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  const art = select(dialog)
    .append('svg')
    .attr('class', 'card-art')
    .attr('viewBox', '-64 -64 128 128')
    .attr('aria-hidden', 'true');
  const title = element('h2', 'card-title', dialog);
  title.id = 'card-title';
  const age = element('p', 'card-age', dialog);
  const text = element('p', 'card-text', dialog);
  const extra = element('p', 'card-extra', dialog);
  const source = element('a', 'card-source', dialog);
  // A real link from the start (the chart data); each card points it at its own source.
  source.href = 'https://stratigraphy.org/chart';
  source.target = '_blank';
  source.rel = 'noopener';
  source.textContent = t('card.source');

  return (marker) => {
    const resolved = resolveAge(findEvent(marker.id));
    art.selectAll('*').remove();
    drawBadge(art.append('g'), marker.art, 104, marker.ring);
    title.textContent = message(`event.${marker.id}.title`);
    age.textContent = formatAgo(resolved);
    text.textContent = message(`event.${marker.id}.text`);
    // The Sun and the Earth share one picture; the card gives both ages.
    if (marker.id === 'solar-system') {
      extra.textContent = `${t('event.earth.title')}: ${formatAgo(resolveAge(findEvent('earth')))}`;
      extra.hidden = false;
    } else {
      extra.hidden = true;
    }
    source.href = resolved.source.url;
    source.title = resolved.source.citation;
    dialog.showModal();
  };
}
