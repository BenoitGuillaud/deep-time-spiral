import { describe, expect, it } from 'vitest';
import { event, events, ics, resolveAge } from '../../src/data';
import { validateEvents } from '../../src/data/validate';

describe('events.json', () => {
  it('gives every event a source: a full citation, or an ICS boundary', () => {
    for (const e of events) {
      const { source } = resolveAge(e);
      expect(source.citation, e.id).not.toBe('');
      expect(source.url, e.id).toMatch(/^https:\/\//);
      expect(source.detail, e.id).not.toBe('');
      expect(source.accessed, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('fails validation when a cited age has no source', () => {
    const broken = [
      { id: 'x', age: { kind: 'cited', years: 1, plusMinusYears: null, qualifier: 'about' } },
    ];
    expect(() => validateEvents(broken, ics)).toThrow(/needs a source/);
  });

  it('fails validation when a source has no URL', () => {
    const broken = [
      {
        id: 'x',
        age: {
          kind: 'cited',
          years: 1,
          plusMinusYears: null,
          qualifier: 'about',
          source: { citation: 'A book', url: '', detail: 'p. 1', accessed: '2026-10-22' },
        },
      },
    ];
    expect(() => validateEvents(broken, ics)).toThrow(/https URL/);
  });

  it('takes ICS ages from the chart rather than copying them', () => {
    expect(resolveAge(event('last-dinosaurs'))).toMatchObject({ years: 66e6, qualifier: 'exact' });
    expect(resolveAge(event('ice-age-ends')).years).toBeCloseTo(11_700, 6);
    expect(resolveAge(event('animals-with-shells'))).toMatchObject({
      years: 538.8e6,
      plusMinusYears: 0.6e6,
      qualifier: 'about',
    });
  });

  it('puts the events in the right order, oldest first', () => {
    const order = [
      'big-bang',
      'solar-system',
      'earth',
      'first-life',
      'animals-with-shells',
      'first-dinosaurs',
      'last-dinosaurs',
      'first-people',
      'ice-age-ends',
    ];
    const byAge = [...events].sort((a, b) => resolveAge(b).years - resolveAge(a).years);
    expect(byAge.map((e) => e.id)).toEqual(order);
  });

  it('keeps the universe older than the Earth, and the Earth older than life', () => {
    const years = (id: string): number => resolveAge(event(id)).years;
    expect(years('big-bang') / years('earth')).toBeGreaterThan(3);
    expect(years('earth')).toBeGreaterThan(years('first-life'));
  });
});
