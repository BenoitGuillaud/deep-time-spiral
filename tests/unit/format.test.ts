import { describe, expect, it } from 'vitest';
import { event, resolveAge } from '../../src/data';
import { isMessageKey } from '../../src/i18n/i18n';
import { formatAgo, formatSpan } from '../../src/render/format';
import { eventName, EVENTS } from '../../src/render/events';

describe('formatAgo', () => {
  it.each([
    ['big-bang', 'about 13.8 billion years ago'],
    ['solar-system', 'about 4.6 billion years ago'],
    ['earth', 'about 4.5 billion years ago'],
    ['first-life', 'at least 3.5 billion years ago'],
    ['animals-with-shells', 'about 539 million years ago'],
    ['first-dinosaurs', 'about 230 million years ago'],
    ['last-dinosaurs', '66 million years ago'],
    ['first-people', 'about 315,000 years ago'],
    ['ice-age-ends', '11,700 years ago'],
  ])('%s → "%s"', (id, expected) => {
    expect(formatAgo(resolveAge(event(id)))).toBe(expected);
  });

  it.each([
    [13.787e9, '13.8 billion years'],
    [538.8e6, '539 million years'],
    [315_000, '315,000 years'],
  ])('formats the span %d as "%s"', (years, expected) => {
    expect(formatSpan(years)).toBe(expected);
  });
});

describe('event texts', () => {
  it.each(EVENTS.map((m) => m.id))('%s has a label, a title and a text', (id) => {
    for (const part of ['label', 'title', 'text']) {
      expect(isMessageKey(`event.${id}.${part}`), `event.${id}.${part}`).toBe(true);
    }
  });
});

describe('eventName', () => {
  it('starts with the visible label when the title does not contain it (WCAG 2.5.3)', () => {
    expect(eventName('last-dinosaurs', '66 million years ago')).toBe(
      'T. rex: The last big dinosaurs, 66 million years ago',
    );
    expect(eventName('big-bang', 'about 13.8 billion years ago')).toBe(
      'The Big Bang, about 13.8 billion years ago',
    );
  });
});
