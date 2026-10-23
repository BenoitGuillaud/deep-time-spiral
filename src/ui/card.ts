import { select } from 'd3';
import { event as findEvent, resolveAge } from '../data';
import { isMessageKey, locale, t } from '../i18n/i18n';
import { eventLabel, type EventMarker } from '../render/events';
import type { Flag } from '../render/flags';
import { formatAgo, formatSpan } from '../render/format';
import { drawBadge, type IllustrationKind } from '../render/illustrations/icons';

/** What a card shows: a picture, a title, how long ago, a short text, and where the number comes from. */
export interface CardContent {
  art: IllustrationKind;
  ring: string;
  title: string;
  age: string;
  text: string;
  extra?: string;
  source?: { url: string; citation: string };
}

const message = (key: string): string => (isMessageKey(key) ? t(key) : '');

export function eventCard(marker: EventMarker): CardContent {
  const resolved = resolveAge(findEvent(marker.id));
  return {
    art: marker.art,
    ring: marker.ring,
    title: message(`event.${marker.id}.title`),
    age: formatAgo(resolved),
    text: message(`event.${marker.id}.text`),
    // The Sun and the Earth share one picture; the card gives both ages.
    ...(marker.id === 'solar-system' && {
      extra: `${t('event.earth.title')}: ${formatAgo(resolveAge(findEvent('earth')))}`,
    }),
    source: { url: resolved.source.url, citation: resolved.source.citation },
  };
}

/** The "zoom in" flag: everything squeezed into the last bit of time next to Now. */
export function clusterCard(members: EventMarker[], years: number): CardContent {
  const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    members.map((m) => eventLabel(m.id)),
  );
  return {
    art: 'zoom',
    ring: '#ffd166',
    title: t('cluster.title'),
    age: t('cluster.age', { span: formatSpan(years) }),
    text: t('cluster.text', { names }),
  };
}

export function flagCard(flag: Flag): CardContent {
  return flag.kind === 'cluster' ? clusterCard(flag.members, flag.years) : eventCard(flag.marker);
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

/** Creates the card dialog and returns a function that opens it with some content. */
export function createCard(parent: HTMLElement): (content: CardContent) => void {
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

  return (content) => {
    art.selectAll('*').remove();
    drawBadge(art.append('g'), content.art, 104, content.ring);
    title.textContent = content.title;
    age.textContent = content.age;
    text.textContent = content.text;
    extra.textContent = content.extra ?? '';
    extra.hidden = content.extra === undefined;
    source.hidden = content.source === undefined;
    if (content.source) {
      source.href = content.source.url;
      source.title = content.source.citation;
    }
    dialog.showModal();
  };
}
