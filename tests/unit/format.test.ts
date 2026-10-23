import { describe, expect, it } from 'vitest';
import { event, resolveAge } from '../../src/data';
import { isMessageKey } from '../../src/i18n/i18n';
import { formatAgo, formatSpanMillions } from '../../src/render/format';
import { eventName, LENS_EVENTS, MAIN_EVENTS } from '../../src/render/scene';

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

  it('formats the lens span', () => {
    expect(formatSpanMillions(538.8e6)).toBe('539 million years');
  });
});

describe('event texts', () => {
  it.each([...MAIN_EVENTS, ...LENS_EVENTS].map((m) => m.id))(
    '%s has a label, a title and a text',
    (id) => {
      for (const part of ['label', 'title', 'text']) {
        expect(isMessageKey(`event.${id}.${part}`), `event.${id}.${part}`).toBe(true);
      }
    },
  );
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
