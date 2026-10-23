import { select } from 'd3';
import { event as findEvent, resolveAge } from '../data';
import { isMessageKey, locale, t } from '../i18n/i18n';
import { eventLabel, type EventMarker } from '../render/events';
import type { Flag } from '../render/flags';
import { formatAgo, formatSpan } from '../render/format';
import { drawBadge, type IllustrationKind } from '../render/illustrations/icons';
import type { Voice } from '../voice/speech';

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

/** What the voice reads for a card (or a journey caption): title, age, then the text. */
export function spokenText(content: {
  title?: string;
  age?: string;
  text: string;
  extra?: string;
}): string {
  // A full stop after each part, so the voice pauses between them.
  return [content.title, content.age, content.text, content.extra]
    .filter((part): part is string => Boolean(part))
    .map((part) => (/[.!?…]$/.test(part) ? part : `${part}.`))
    .join(' ');
}

/**
 * Creates the card dialog and returns a function that opens it with some content. The card reads
 * itself aloud when it opens, and again with its speaker button.
 */
export function createCard(parent: HTMLElement, voice: Voice): (content: CardContent) => void {
  const dialog = element('dialog', 'card', parent);
  dialog.setAttribute('aria-labelledby', 'card-title');
  dialog.addEventListener('close', () => {
    voice.cancel();
  });

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

  const listen = element('button', 'card-listen', dialog);
  listen.type = 'button';
  listen.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const listenText = document.createElement('span');
  listenText.textContent = t('card.listen');
  listen.append(listenText);
  let spoken = '';
  listen.addEventListener('click', () => {
    void voice.say(spoken);
  });
  const updateListen = (): void => {
    listen.disabled = !voice.available() || voice.muted();
    listen.title = voice.available() ? '' : t('voice.missing');
  };
  voice.onChange(updateListen);
  updateListen();

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
    spoken = spokenText(content);
    void voice.say(spoken);
  };
}
